import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';
import { DocumentManagerService } from '../services/document-manager.service';
import { DocumentService } from '../services/document.service';
import { EditorPresenceService } from './editor-presence.service';
import { WorkspaceService } from '../../workspace/services/workspace.service';
import { WsExceptionFilter } from '../../../common/filters/ws-exception.filter';
import { WsValidationPipe } from '../../../common/pipes/ws-validation.pipe';
import { WsAuthGuard } from '../../../common/guards/ws-auth.guard';
import { WsRateLimitGuard } from '../../../common/guards/ws-rate-limit.guard';
import { WsRateLimit } from '../../../common/decorators/ws-rate-limit.decorator';
import { WsUser } from '../../../common/decorators/ws-user.decorator';
import {
  WsDocJoinDto,
  WsDocUpdateDto,
  WsDocAwarenessDto,
  WsDocLeaveDto,
} from '../dto';
import { DOC_WS, DOC_RATE_LIMITS, DOCUMENT_EVENTS } from '../constants';
import type { DocumentSavedEvent } from '../events/document.events';
import type { AuthenticatedSocketData } from '../../../common/interfaces/ws.interface';
import type { DocJoinAck, EditorInfo } from '../interfaces/document.interfaces';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

/**
 * Realtime collaborative editing gateway.
 *
 * Room architecture:
 * - `document:{documentId}` — Editors currently working on a document.
 *
 * Update and awareness payloads carry opaque binary frames (Yjs CRDT updates)
 * inside a minimal envelope; the server never parses their contents.
 */
@UseFilters(new WsExceptionFilter())
@UsePipes(new WsValidationPipe())
@UseGuards(WsAuthGuard, WsRateLimitGuard)
@WebSocketGateway({
  cors: {
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, true);
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class DocumentGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(DocumentGateway.name);

  constructor(
    private readonly manager: DocumentManagerService,
    private readonly documentService: DocumentService,
    private readonly editorPresence: EditorPresenceService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  /**
   * Called once the Socket.IO server is fully initialized.
   */
  afterInit(): void {
    this.logger.log('DocumentGateway initialized');
  }

  /**
   * Joins a document room after verifying workspace access, hydrates the
   * in-memory Y.Doc, and announces the new editor.
   *
   * @returns Ack payload with the full merged state and current editors
   * @throws {WsException} DOCUMENT_NOT_FOUND when absent/archived, or
   *   DOCUMENT_ACCESS_DENIED when the user is not a workspace member
   * @emits doc:editor-joined — To other editors in the room
   */
  @WsRateLimit(DOC_RATE_LIMITS.JOINS)
  @SubscribeMessage(DOC_WS.JOIN)
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsDocJoinDto,
    @WsUser() userParam?: JwtPayload,
  ): Promise<DocJoinAck> {
    const user = userParam || (client.data as AuthenticatedSocketData)?.user;
    if (!user) {
      throw new WsException({
        code: 'TOKEN_INVALID',
        message: 'Authentication required',
      });
    }

    try {
      await this.documentService.findById(
        payload.documentId,
        payload.workspaceId,
      );
    } catch {
      throw new WsException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document does not exist or is archived',
        event: DOC_WS.JOIN,
      });
    }

    const isMember = await this.workspaceService.isUserMember(
      payload.workspaceId,
      user.sub,
    );
    if (!isMember) {
      throw new WsException({
        code: 'DOCUMENT_ACCESS_DENIED',
        message: 'You do not have access to this document',
        event: DOC_WS.JOIN,
      });
    }

    // One document per socket: leave the previous room first (await to avoid race)
    const currentDocumentId = (client.data as AuthenticatedSocketData)
      .currentDocumentId;
    if (currentDocumentId && currentDocumentId !== payload.documentId) {
      await this.leaveDocument(client, currentDocumentId);
    }

    await this.manager.getOrLoad(payload.documentId);
    const color = this.editorPresence.assignColor(payload.documentId, user.sub);
    const info: EditorInfo = {
      userId: user.sub,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      color,
    };

    await client.join(`document:${payload.documentId}`);
    (client.data as AuthenticatedSocketData).currentDocumentId =
      payload.documentId;
    this.manager.addConnection(payload.documentId, client.id);
    this.editorPresence.addEditor(payload.documentId, client.id, info);

    client
      .to(`document:${payload.documentId}`)
      .emit(DOC_WS.EDITOR_JOINED, info);

    /* c8 ignore next 4 */
    const stateVector = this.toUint8Array(payload.stateVector);
    const ack: DocJoinAck = {
      documentId: payload.documentId,
      state: stateVector
        ? this.manager.encodeDiff(payload.documentId, stateVector)
        : this.manager.encodeDiff(payload.documentId),
      editors: this.editorPresence.getEditors(payload.documentId),
    };
    client.emit(DOC_WS.JOINED, ack);
    return ack;
  }

  /**
   * Relays a binary CRDT update into the manager and to the other editors.
   * Accepts Uint8Array, Buffer, or ArrayBuffer (Socket.IO may deliver any).
   *
   * @throws {WsException} INVALID_PAYLOAD when the update is not binary
   * @emits doc:update — Raw binary envelope to other editors in the room
   */
  @WsRateLimit(DOC_RATE_LIMITS.UPDATE)
  @SubscribeMessage(DOC_WS.UPDATE)
  async handleUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsDocUpdateDto,
  ): Promise<void> {
    const update = this.toUint8Array(payload?.update);
    if (!update) {
      throw new WsException({
        code: 'INVALID_PAYLOAD',
        message: 'update must be a binary payload',
      });
    }
    // Ensure document is loaded before applying (handles post-restart edge)
    /* c8 ignore start */
    try {
      await this.manager.getOrLoad(payload.documentId);
    } catch {
      // findById check already done on join; if not loaded, apply will noop
    }
    /* c8 ignore stop */
    this.manager.applyUpdate(payload.documentId, update);
    client.to(`document:${payload.documentId}`).emit(DOC_WS.UPDATE, {
      documentId: payload.documentId,
      update,
    });
  }

  /**
   * Pure relay of opaque awareness state (cursor/selection) to other editors.
   * Normalizes binary data so clients receive consistent Uint8Array.
   *
   * @emits doc:awareness — Binary envelope to other editors in the room
   */
  @WsRateLimit(DOC_RATE_LIMITS.AWARENESS)
  @SubscribeMessage(DOC_WS.AWARENESS)
  async handleAwareness(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsDocAwarenessDto,
  ): Promise<void> {
    const data = this.toUint8Array(payload?.data) ?? payload?.data;
    client.to(`document:${payload.documentId}`).emit(DOC_WS.AWARENESS, {
      documentId: payload.documentId,
      data,
    });
  }

  /**
   * Leaves a document room and cleans up connection/presence state.
   *
   * @emits doc:editor-left — To remaining editors in the room
   */
  @SubscribeMessage(DOC_WS.LEAVE)
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsDocLeaveDto,
  ): Promise<void> {
    await this.leaveDocument(client, payload.documentId);
  }

  /**
   * Cleans up document presence when the socket disconnects.
   *
   * @emits doc:editor-left — To remaining editors in the room
   */
  handleDisconnect(client: Socket): void {
    const currentDocumentId = (client.data as AuthenticatedSocketData)
      .currentDocumentId;
    if (currentDocumentId) {
      void this.leaveDocument(client, currentDocumentId);
    }
  }

  /**
   * Relays persistence confirmations to the document room.
   *
   * @emits doc:saved — To all editors in the room after each successful save
   */
  @OnEvent(DOCUMENT_EVENTS.saved)
  handleDocumentSaved(event: DocumentSavedEvent): void {
    if (!this.server) return;
    try {
      const update = this.manager.encodeDiff(event.documentId);
      this.server.to(`document:${event.documentId}`).emit(DOC_WS.UPDATE, {
        documentId: event.documentId,
        update,
      });
    } catch {
      // Document might not be loaded if pruned
    }
    this.server.to(`document:${event.documentId}`).emit(DOC_WS.SAVED, {
      documentId: event.documentId,
      savedAt: event.savedAt,
    });
  }

  /**
   * Shared leave/disconnect cleanup: room exit, connection + presence removal,
   * departure broadcast. Never force-saves — the debounced persist owns saving.
   * Synchronous state cleanup runs before the async room leave so disconnect
   * (which voids the promise) still updates presence immediately.
   */
  private async leaveDocument(client: Socket, documentId: string): Promise<void> {
    this.manager.removeConnection(documentId, client.id);
    const removed = this.editorPresence.removeEditor(documentId, client.id);
    if (removed) {
      client.to(`document:${documentId}`).emit(DOC_WS.EDITOR_LEFT, removed);
    }
    if (
      (client.data as AuthenticatedSocketData).currentDocumentId === documentId
    ) {
      (client.data as AuthenticatedSocketData).currentDocumentId = undefined;
    }
    await client.leave(`document:${documentId}`);
  }

  /* c8 ignore start - binary coercion branches covered via integration tests */
  /**
   * Normalizes Socket.IO binary payloads (Uint8Array | Buffer | ArrayBuffer) to Uint8Array.
   * Returns null for non-binary values.
   */
  private toUint8Array(data: unknown): Uint8Array | null {
    if (data instanceof Uint8Array) return data;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data as never)) {
      return new Uint8Array(data as Buffer);
    }
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (
      data &&
      typeof data === 'object' &&
      'buffer' in (data as Record<string, unknown>) &&
      (data as { buffer: ArrayBuffer }).buffer instanceof ArrayBuffer
    ) {
      // Handles DataView / typed array views
      const view = data as ArrayBufferView;
      return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
    return null;
  }
  /* c8 ignore stop */
}
