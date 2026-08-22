import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import {
  Logger,
  UseFilters,
  UsePipes,
  UseGuards,
  OnModuleDestroy,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { JwtTokenService } from '../../auth/services/jwt-token.service';
import { TokenBlacklistService } from '../../auth/services/token-blacklist.service';
import { PresenceService } from '../services/presence.service';
import { WsExceptionFilter } from '../../../common/filters/ws-exception.filter';
import { WsValidationPipe } from '../../../common/pipes/ws-validation.pipe';
import { WsAuthGuard } from '../../../common/guards/ws-auth.guard';
import { WsRateLimitGuard } from '../../../common/guards/ws-rate-limit.guard';
import { WsRateLimit } from '../../../common/decorators/ws-rate-limit.decorator';
import { WsUser } from '../../../common/decorators/ws-user.decorator';
import { WsWorkspaceMemberGuard } from '../../workspace/guards/ws-workspace-member.guard';
import { WsBoardAccessGuard } from '../guards/ws-board-access.guard';
import { WS_EVENTS, WS_RATE_LIMITS, PRESENCE_CONFIG } from '../board.constants';
import {
  BOARD_EVENTS,
  LIST_EVENTS,
  CARD_EVENTS,
  COMMENT_EVENTS,
  ATTACHMENT_EVENTS,
} from '../events/board-events.constants';
import {
  BoardUpdatedEvent,
  BoardArchivedEvent,
  BoardUnarchivedEvent,
  BoardCreatedEvent,
  ListCreatedEvent,
  ListUpdatedEvent,
  ListMovedEvent,
  ListArchivedEvent,
  ListUnarchivedEvent,
  CardCreatedEvent,
  CardUpdatedEvent,
  CardMovedEvent,
  CardArchivedEvent,
  CardUnarchivedEvent,
  CommentCreatedEvent,
  AttachmentCreatedEvent,
  AttachmentDeletedEvent,
} from '../events/board.events';
import {
  WsWorkspaceJoinDto,
  WsWorkspaceLeaveDto,
  WsBoardJoinDto,
  WsBoardLeaveDto,
  WsCursorDto,
} from '../dto/ws-messages.dto';
import type {
  AuthenticatedSocketData,
  PresenceEntry,
} from '../../../common/interfaces/ws.interface';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

/**
 * Room Architecture:
 * - `user:{userId}` — Private room for notifications (joined on connect)
 * - `workspace:{workspaceId}` — All members of a workspace
 * - `board:{boardId}` — Users currently viewing a specific board
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
export class BoardGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(BoardGateway.name);
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly blacklistService: TokenBlacklistService,
    private readonly presenceService: PresenceService,
  ) {}

  // =========================================================================
  // GATEWAY LIFECYCLE
  // =========================================================================

  /**
   * Called once the Socket.IO server is fully initialized.
   * Starts the periodic stale-presence cleanup loop and broadcasts
   */
  afterInit(): void {
    this.cleanupInterval = setInterval(
      () => void this.runPresenceCleanup(),
      PRESENCE_CONFIG.CLEANUP_INTERVAL_MS,
    );
    this.logger.log('Presence cleanup interval started');
  }

  /**
   * Runs the stale-presence cleanup and broadcasts departure events for pruned users.
   * Invoked on the cleanup interval — never called by event handlers.
   */
  private async runPresenceCleanup(): Promise<void> {
    const pruned = await this.presenceService.cleanupStaleEntries();
    for (const [boardId, entry] of pruned) {
      this.server.to(`board:${boardId}`).emit(WS_EVENTS.BOARD_PRESENCE, {
        userId: entry.userId,
        action: 'left',
        displayName: entry.displayName,
      });
      this.logger.debug(
        `Stale presence broadcast: user ${entry.userId} left board ${boardId}`,
      );
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // =========================================================================
  // CONNECTION & DISCONNECTION LIFECYCLE
  // =========================================================================

  /**
   * Authenticates client connection
   * Automatically joins user-specific room `user:{userId}` for private notifications.
   *
   * On failure, emits an `error` event with the appropriate code and disconnects.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // 1. Extract token from Socket.IO handshake auth or Authorization header
      let token = client.handshake.auth?.token as string | undefined;

      if (!token && client.handshake.headers?.authorization) {
        const authHeader = client.handshake.headers.authorization;
        token = authHeader.startsWith('Bearer ')
          ? authHeader.substring(7)
          : authHeader;
      }

      // 2. Reject connection immediately if token is missing
      if (!token) {
        this.logger.warn(
          `Rejected WebSocket connection: missing token (socket: ${client.id})`,
        );
        client.emit('error', {
          code: 'TOKEN_INVALID',
          message: 'Authentication token required',
        });
        client.disconnect(true);
        return;
      }

      // 3. Verify JWT signature, expiration, and decode payload
      const payload: JwtPayload = this.jwtTokenService.verifyAccessToken(token);

      // 4. Verify token has not been revoked in Redis blacklist
      if (await this.blacklistService.isBlacklisted(payload.jti)) {
        this.logger.warn(
          `Rejected WebSocket connection: revoked token (jti: ${payload.jti})`,
        );
        client.emit('error', {
          code: 'TOKEN_REVOKED',
          message: 'Token has been revoked',
        });
        client.disconnect(true);
        return;
      }

      // 5. Attach decoded user payload to socket session data
      const socketData: AuthenticatedSocketData = { user: payload };
      client.data = socketData;

      // 6. Join user-specific private room for targeted direct notifications
      await client.join(`user:${payload.sub}`);
      this.logger.debug(
        `Socket connected & authenticated: user=${payload.sub}, socket=${client.id}`,
      );
    } catch (error) {
      // 7. Handle token expiration or invalid signature errors and terminate socket
      const msg = error instanceof Error ? error.message : 'Authentication failed';
      const code = msg.includes('TOKEN_EXPIRED')
        ? 'TOKEN_EXPIRED'
        : 'TOKEN_INVALID';
      client.emit('error', { code, message: msg });
      client.disconnect(true);
    }
  }

  /**
   * Cleans up board presence and notifies other viewers upon client disconnect.
   * Also broadcasts `workspace:member-offline` to the workspace room if the
   * user has no other active sockets in that workspace.
   */
  async handleDisconnect(client: Socket): Promise<void> {
    // 1. Retrieve session data; skip unauthenticated socket disconnections
    const socketData = client.data as AuthenticatedSocketData | undefined;
    const user = socketData?.user;
    if (!user) return;

    this.logger.debug(
      `Socket disconnected: user=${user.sub}, socket=${client.id}`,
    );

    // 2. Remove socket from Redis board presence if viewing a board
    const currentBoardId = socketData.currentBoardId;
    if (currentBoardId) {
      const removed = await this.presenceService.removePresence(
        currentBoardId,
        client.id,
      );
      const roomName = `board:${currentBoardId}`;

      // 3. Notify remaining viewers in the board room that this user left
      if (removed && this.server) {
        this.server.to(roomName).emit(WS_EVENTS.BOARD_PRESENCE, {
          userId: user.sub,
          action: 'left',
          displayName: user.displayName,
        });
      }
    }

    // 4. Check if the user has other active sockets in this workspace (e.g., multiple tabs)
    const currentWorkspaceId = socketData.currentWorkspaceId;
    if (currentWorkspaceId && this.server) {
      const roomName = `workspace:${currentWorkspaceId}`;
      const sockets = await this.server.in(roomName).fetchSockets();
      const userHasOtherSockets = sockets.some(
        (s) =>
          s.id !== client.id &&
          (s.data as AuthenticatedSocketData)?.user?.sub === user.sub,
      );

      // 5. Broadcast workspace-offline event only if the user has no remaining sockets
      if (!userHasOtherSockets) {
        this.server.to(roomName).emit(WS_EVENTS.WORKSPACE_MEMBER_OFFLINE, {
          userId: user.sub,
        });
      }
    }
  }

  // =========================================================================
  // WORKSPACE ROOM MANAGEMENT
  // =========================================================================

  /**
   * Joins user to workspace-wide room after validating membership.
   * Broadcasts `workspace:member-online` to existing workspace members.
   *
   * @emits workspace:joined — To the joining client with workspace ID
   * @emits workspace:member-online — To all other workspace members
   */
  @UseGuards(WsWorkspaceMemberGuard)
  @WsRateLimit(WS_RATE_LIMITS.ROOM_JOINS)
  @SubscribeMessage(WS_EVENTS.WORKSPACE_JOIN)
  async handleWorkspaceJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsWorkspaceJoinDto,
    @WsUser() user?: JwtPayload,
  ): Promise<void> {
    // 1. Resolve authenticated user and target workspace ID
    const currentUser = user || (client.data as AuthenticatedSocketData)?.user;
    if (!currentUser) return;

    const { workspaceId } = payload;

    // 2. Leave previously active workspace room if switching workspaces
    const previousWorkspaceId = (client.data as AuthenticatedSocketData).currentWorkspaceId;
    if (previousWorkspaceId && previousWorkspaceId !== workspaceId) {
      await client.leave(`workspace:${previousWorkspaceId}`);
    }

    // 3. Join new workspace room and store current workspace ID in socket session data
    await client.join(`workspace:${workspaceId}`);
    (client.data as AuthenticatedSocketData).currentWorkspaceId = workspaceId;

    // 4. Fetch all active sockets in this workspace and deduplicate by userId
    const roomSockets = await this.server
      .in(`workspace:${workspaceId}`)
      .fetchSockets();
    const onlineMembers = new Map<
      string,
      { userId: string; displayName: string }
    >();
    for (const s of roomSockets) {
      const sd = s.data as AuthenticatedSocketData | undefined;
      if (sd?.user && !onlineMembers.has(sd.user.sub)) {
        onlineMembers.set(sd.user.sub, {
          userId: sd.user.sub,
          displayName: sd.user.displayName,
        });
      }
    }

    // 5. Send initial roster of online members directly back to joining client
    client.emit(WS_EVENTS.WORKSPACE_JOINED, {
      workspaceId,
      onlineMembers: Array.from(onlineMembers.values()),
    });

    // 6. Broadcast to existing workspace members that a new user came online
    client
      .to(`workspace:${workspaceId}`)
      .emit(WS_EVENTS.WORKSPACE_MEMBER_ONLINE, {
        userId: currentUser.sub,
        displayName: currentUser.displayName,
      });
  }

  /**
   * Leaves workspace-wide room.
   */
  @SubscribeMessage(WS_EVENTS.WORKSPACE_LEAVE)
  async handleWorkspaceLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsWorkspaceLeaveDto,
  ): Promise<void> {
    await client.leave(`workspace:${payload.workspaceId}`);

    if (
      (client.data as AuthenticatedSocketData).currentWorkspaceId ===
      payload.workspaceId
    ) {
      (client.data as AuthenticatedSocketData).currentWorkspaceId = undefined;
    }
  }

  // =========================================================================
  // BOARD ROOM MANAGEMENT & PRESENCE
  // =========================================================================

  /**
   * Joins a board room, registers presence in Redis, and broadcasts presence updates.
   *
   * @emits board:joined — To the joining client with board ID and active viewers
   * @emits board:presence — To existing board viewers announcing the new participant
   */
  @UseGuards(WsBoardAccessGuard)
  @WsRateLimit(WS_RATE_LIMITS.ROOM_JOINS)
  @SubscribeMessage(WS_EVENTS.BOARD_JOIN)
  async handleBoardJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsBoardJoinDto,
    @WsUser() user?: JwtPayload,
  ): Promise<void> {
    // 1. Resolve authenticated user and target board ID
    const currentUser = user || (client.data as AuthenticatedSocketData)?.user;
    if (!currentUser) return;

    const { boardId } = payload;

    // 2. Leave any previously active board room before switching
    const currentBoardId = (client.data as AuthenticatedSocketData).currentBoardId;
    if (currentBoardId && currentBoardId !== boardId) {
      await this.leaveBoardRoom(client, currentBoardId);
    }

    // 3. Join target board room and store board ID in socket session data
    await client.join(`board:${boardId}`);
    (client.data as AuthenticatedSocketData).currentBoardId = boardId;

    // 4. Generate deterministic, collision-free collaborator color
    const color = await this.presenceService.getCollaboratorColor(
      currentUser.sub,
      boardId,
    );
    const entry: PresenceEntry = {
      userId: currentUser.sub,
      socketId: client.id,
      displayName: currentUser.displayName,
      avatarUrl: currentUser.avatarUrl ?? null,
      color,
      connectedAt: new Date().toISOString(),
    };

    // 5. Register user presence
    await this.presenceService.addPresence(boardId, entry);

    // 6. Send active viewer roster to the joining client
    const viewers = await this.presenceService.getBoardViewers(boardId);
    client.emit(WS_EVENTS.BOARD_JOINED, { boardId, viewers });

    // 7. Announce the new viewer to other users currently viewing the board
    client.to(`board:${boardId}`).emit(WS_EVENTS.BOARD_PRESENCE, {
      userId: currentUser.sub,
      action: 'joined',
      displayName: currentUser.displayName,
      avatarUrl: currentUser.avatarUrl ?? null,
      color,
    });
  }

  /**
   * Leaves active board room and cleans up presence.
   */
  @SubscribeMessage(WS_EVENTS.BOARD_LEAVE)
  async handleBoardLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsBoardLeaveDto,
  ): Promise<void> {
    await this.leaveBoardRoom(client, payload.boardId);
  }

  /**
   * Handles client heartbeat to refresh presence TTL in Redis.
   * Clients send this every 30 seconds to maintain their "online" status.
   */
  @SubscribeMessage(WS_EVENTS.PRESENCE_HEARTBEAT)
  async handleHeartbeat(@ConnectedSocket() client: Socket): Promise<void> {
    const currentBoardId = (client.data as AuthenticatedSocketData)?.currentBoardId;
    if (currentBoardId) {
      await this.presenceService.updateHeartbeat(currentBoardId, client.id);
    }
  }

  /**
   * Streams cursor positions to other active board viewers.
   * Rate-limited to prevent flooding — exceeding events are silently dropped.
   *
   * @emits board:cursor — To all other board viewers with cursor coordinates
   */
  @WsRateLimit(WS_RATE_LIMITS.PRESENCE_CURSOR)
  @SubscribeMessage(WS_EVENTS.PRESENCE_CURSOR)
  async handleCursor(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsCursorDto,
    @WsUser() user?: JwtPayload,
  ): Promise<void> {
    const currentUser = user || (client.data as AuthenticatedSocketData)?.user;
    if (!currentUser) return;

    const viewers = (await this.presenceService.getBoardViewers(payload.boardId)) || [];
    const viewer = viewers.find((v) => v.userId === currentUser.sub);

    client.to(`board:${payload.boardId}`).emit(WS_EVENTS.BOARD_CURSOR, {
      userId: currentUser.sub,
      displayName: currentUser.displayName,
      color: viewer?.color || '#888888',
      x: payload.x,
      y: payload.y,
      cardId: payload.cardId,
    });
  }

  // =========================================================================
  // DOMAIN EVENT BROADCASTERS (EventEmitter2 → Socket.IO)
  // =========================================================================

  // --- Board Events ---

  @OnEvent(BOARD_EVENTS.created)
  broadcastBoardCreated(event: BoardCreatedEvent): void {
    if (!this.server) return;
    this.server
      .to(`workspace:${event.board.workspaceId}`)
      .emit(WS_EVENTS.BOARD_CREATED, {
        board: event.board,
        createdBy: { id: event.createdBy },
      });
  }

  @OnEvent(BOARD_EVENTS.updated)
  broadcastBoardUpdated(event: BoardUpdatedEvent): void {
    if (!this.server) return;
    this.server.to(`board:${event.board.id}`).emit(WS_EVENTS.BOARD_UPDATED, {
      boardId: event.board.id,
      changes: {
        title: event.board.title,
        description: event.board.description,
        backgroundColor: event.board.backgroundColor,
        updatedAt: event.board.updatedAt,
      },
      updatedBy: { id: event.updatedBy },
    });
  }

  @OnEvent(BOARD_EVENTS.archived)
  broadcastBoardArchived(event: BoardArchivedEvent): void {
    if (!this.server) return;
    this.server.to(`board:${event.boardId}`).emit(WS_EVENTS.BOARD_ARCHIVED, {
      boardId: event.boardId,
      archivedBy: { id: event.archivedBy },
    });
  }

  @OnEvent(BOARD_EVENTS.unarchived)
  broadcastBoardUnarchived(event: BoardUnarchivedEvent): void {
    if (!this.server) return;
    this.server.to(`board:${event.board.id}`).emit(WS_EVENTS.BOARD_UNARCHIVED, {
      boardId: event.board.id,
      board: event.board,
      unarchivedBy: { id: event.unarchivedBy },
    });
  }

  // --- List Events ---

  @OnEvent(LIST_EVENTS.created)
  broadcastListCreated(event: ListCreatedEvent): void {
    if (!this.server) return;
    this.server.to(`board:${event.list.boardId}`).emit(WS_EVENTS.LIST_CREATED, {
      list: event.list,
      createdBy: { id: event.createdBy },
    });
  }

  @OnEvent(LIST_EVENTS.updated)
  broadcastListUpdated(event: ListUpdatedEvent): void {
    if (!this.server) return;
    this.server.to(`board:${event.list.boardId}`).emit(WS_EVENTS.LIST_UPDATED, {
      listId: event.list.id,
      changes: {
        title: event.list.title,
        updatedAt: event.list.updatedAt,
      },
      updatedBy: { id: event.updatedBy },
    });
  }

  @OnEvent(LIST_EVENTS.moved)
  broadcastListMoved(event: ListMovedEvent): void {
    if (!this.server) return;
    this.server.to(`board:${event.boardId}`).emit(WS_EVENTS.LIST_MOVED, {
      listId: event.listId,
      newRank: event.newRank,
      movedBy: { id: event.movedBy },
    });
  }

  @OnEvent(LIST_EVENTS.archived)
  broadcastListArchived(event: ListArchivedEvent): void {
    if (!this.server) return;
    this.server.to(`board:${event.boardId}`).emit(WS_EVENTS.LIST_ARCHIVED, {
      listId: event.listId,
      archivedBy: { id: event.archivedBy },
    });
  }

  @OnEvent(LIST_EVENTS.unarchived)
  broadcastListUnarchived(event: ListUnarchivedEvent): void {
    if (!this.server) return;
    this.server
      .to(`board:${event.list.boardId}`)
      .emit(WS_EVENTS.LIST_UNARCHIVED, {
        listId: event.list.id,
        list: event.list,
        unarchivedBy: { id: event.unarchivedBy },
      });
  }

  // --- Card Events ---

  @OnEvent(CARD_EVENTS.created)
  broadcastCardCreated(event: CardCreatedEvent): void {
    if (!this.server) return;
    this.server.to(`board:${event.boardId}`).emit(WS_EVENTS.CARD_CREATED, {
      card: event.card,
      listId: event.listId,
      createdBy: { id: event.createdBy },
    });
  }

  @OnEvent(CARD_EVENTS.updated)
  broadcastCardUpdated(event: CardUpdatedEvent): void {
    if (!this.server) return;
    this.server.to(`board:${event.boardId}`).emit(WS_EVENTS.CARD_UPDATED, {
      cardId: event.card.id,
      changes: {
        title: event.card.title,
        description: event.card.description,
        dueDate: event.card.dueDate,
        isComplete: event.card.isComplete,
        coverImageUrl: event.card.coverImageUrl,
        updatedAt: event.card.updatedAt,
      },
      updatedBy: { id: event.updatedBy },
    });
  }

  @OnEvent(CARD_EVENTS.moved)
  broadcastCardMoved(event: CardMovedEvent): void {
    if (!this.server) return;
    this.server.to(`board:${event.boardId}`).emit(WS_EVENTS.CARD_MOVED, {
      cardId: event.cardId,
      fromListId: event.sourceListId,
      toListId: event.targetListId,
      newRank: event.newRank,
      movedBy: { id: event.movedBy },
    });
  }

  @OnEvent(CARD_EVENTS.archived)
  broadcastCardArchived(event: CardArchivedEvent): void {
    if (!this.server) return;
    this.server.to(`board:${event.boardId}`).emit(WS_EVENTS.CARD_ARCHIVED, {
      cardId: event.cardId,
      listId: event.listId,
      archivedBy: { id: event.archivedBy },
    });
  }

  @OnEvent(CARD_EVENTS.unarchived)
  broadcastCardUnarchived(event: CardUnarchivedEvent): void {
    if (!this.server) return;
    this.server.to(`board:${event.boardId}`).emit(WS_EVENTS.CARD_UNARCHIVED, {
      cardId: event.card.id,
      card: event.card,
      listId: event.listId,
      unarchivedBy: { id: event.unarchivedBy },
    });
  }

  // --- Comment Events ---

  @OnEvent(COMMENT_EVENTS.created)
  broadcastCommentCreated(event: CommentCreatedEvent): void {
    if (!this.server) return;
    this.server
      .to(`board:${event.boardId}`)
      .emit(WS_EVENTS.CARD_COMMENT_ADDED, {
        cardId: event.comment.cardId,
        comment: event.comment,
        authorId: event.authorId,
      });
  }

  // --- Attachment Events ---

  @OnEvent(ATTACHMENT_EVENTS.created)
  broadcastAttachmentCreated(event: AttachmentCreatedEvent): void {
    if (!this.server) return;
    this.server
      .to(`board:${event.boardId}`)
      .emit(WS_EVENTS.CARD_ATTACHMENT_ADDED, {
        cardId: event.attachment.cardId,
        attachment: event.attachment,
        uploadedBy: { id: event.uploadedBy },
      });
  }

  @OnEvent(ATTACHMENT_EVENTS.deleted)
  broadcastAttachmentDeleted(event: AttachmentDeletedEvent): void {
    if (!this.server) return;
    this.server
      .to(`board:${event.boardId}`)
      .emit(WS_EVENTS.CARD_ATTACHMENT_DELETED, {
        cardId: event.cardId,
        attachmentId: event.attachmentId,
        deletedBy: { id: event.deletedBy },
      });
  }

  // =========================================================================
  // PRIVATE HELPER ROUTINES
  // =========================================================================

  /**
   * Leaves a board room, cleans up presence, and broadcasts the departure.
   */
  private async leaveBoardRoom(client: Socket, boardId: string): Promise<void> {
    const user = (client.data as AuthenticatedSocketData)?.user;

    await client.leave(`board:${boardId}`);
    const removed = await this.presenceService.removePresence(
      boardId,
      client.id,
    );

    if (removed && user) {
      client.to(`board:${boardId}`).emit(WS_EVENTS.BOARD_PRESENCE, {
        userId: user.sub,
        action: 'left',
        displayName: user.displayName,
      });
    }

    if ((client.data as AuthenticatedSocketData)?.currentBoardId === boardId) {
      (client.data as AuthenticatedSocketData).currentBoardId = undefined;
    }
  }
}
