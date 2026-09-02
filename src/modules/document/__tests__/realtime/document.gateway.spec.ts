import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { DocumentGateway } from '../../realtime/document.gateway';
import { DocumentManagerService } from '../../services/document-manager.service';
import { DocumentService } from '../../services/document.service';
import { EditorPresenceService } from '../../realtime/editor-presence.service';
import { WorkspaceService } from '../../../workspace/services/workspace.service';
import { DOC_WS } from '../../constants';
import { DocumentSavedEvent } from '../../events/document.events';

const DOC = '00000000-0000-4000-8000-000000000001';
const WS = '00000000-0000-4000-8000-000000000002';
const USER = {
  sub: '00000000-0000-4000-8000-000000000003',
  email: 'a@b.c',
  displayName: 'Alice',
  avatarUrl: null,
  isEmailVerified: true,
  iat: 0,
  exp: 9,
  iss: 'syncboard',
  jti: 'jti',
};

function mkSocket(data: Record<string, unknown> = {}): DeepMockProxy<Socket> {
  const socket = mockDeep<Socket>();
  socket.id = 'sock-1';
  socket.join.mockResolvedValue(undefined);
  const room = { emit: jest.fn() };
  socket.to.mockReturnValue(room as never);
  socket.leave.mockResolvedValue(undefined);
  (socket as any).data = data;
  (socket as any).__room = room;
  return socket;
}

describe('DocumentGateway', () => {
  let gateway: DocumentGateway;
  let manager: DeepMockProxy<DocumentManagerService>;
  let documentService: DeepMockProxy<DocumentService>;
  let editorPresence: DeepMockProxy<EditorPresenceService>;
  let workspaceService: DeepMockProxy<WorkspaceService>;

  beforeEach(() => {
    manager = mockDeep<DocumentManagerService>();
    documentService = mockDeep<DocumentService>();
    editorPresence = mockDeep<EditorPresenceService>();
    workspaceService = mockDeep<WorkspaceService>();
    gateway = new DocumentGateway(
      manager,
      documentService,
      editorPresence,
      workspaceService,
    );
  });

  describe('handleJoin', () => {
    it('joins the room, registers presence and acks with full state + editors', async () => {
      const socket = mkSocket({ user: USER });
      documentService.findById.mockResolvedValue({
        id: DOC,
        workspaceId: WS,
      } as any);
      workspaceService.isUserMember.mockResolvedValue(true);
      editorPresence.assignColor.mockReturnValue('#E11D48');
      editorPresence.getEditors.mockReturnValue([
        {
          userId: USER.sub,
          displayName: 'Alice',
          avatarUrl: null,
          color: '#E11D48',
        },
      ]);

      const ack = await gateway.handleJoin(socket, {
        documentId: DOC,
        workspaceId: WS,
      });

      expect(socket.join).toHaveBeenCalledWith(`document:${DOC}`);
      expect(manager.getOrLoad).toHaveBeenCalledWith(DOC);
      expect(manager.addConnection).toHaveBeenCalledWith(DOC, 'sock-1');
      expect(editorPresence.addEditor).toHaveBeenCalledWith(DOC, 'sock-1', {
        userId: USER.sub,
        displayName: 'Alice',
        avatarUrl: null,
        color: '#E11D48',
      });
      expect((socket as any).__room.emit).toHaveBeenCalledWith(
        DOC_WS.EDITOR_JOINED,
        {
          userId: USER.sub,
          displayName: 'Alice',
          avatarUrl: null,
          color: '#E11D48',
        },
      );
      expect(socket.emit).toHaveBeenCalledWith(DOC_WS.JOINED, {
        documentId: DOC,
        state: undefined,
        editors: [
          {
            userId: USER.sub,
            displayName: 'Alice',
            avatarUrl: null,
            color: '#E11D48',
          },
        ],
      });
      expect(ack.editors).toHaveLength(1);
      expect(ack.documentId).toBe(DOC);
    });

    it('performs leave cleanup when switching documents', async () => {
      const socket = mkSocket({ user: USER, currentDocumentId: 'old-doc' });
      documentService.findById.mockResolvedValue({
        id: DOC,
        workspaceId: WS,
      } as any);
      workspaceService.isUserMember.mockResolvedValue(true);

      await gateway.handleJoin(socket, { documentId: DOC, workspaceId: WS });

      expect(manager.removeConnection).toHaveBeenCalledWith(
        'old-doc',
        'sock-1',
      );
      expect(socket.leave).toHaveBeenCalledWith('document:old-doc');
    });

    it('throws TOKEN_INVALID without an authenticated user', async () => {
      const socket = mkSocket({});

      await expect(
        gateway.handleJoin(socket, { documentId: DOC, workspaceId: WS }),
      ).rejects.toThrow(WsException);
    });

    it('maps an inaccessible document to DOCUMENT_NOT_FOUND', async () => {
      const socket = mkSocket({ user: USER });
      documentService.findById.mockRejectedValue(new Error('nope'));

      const error: WsException = await gateway
        .handleJoin(socket, { documentId: DOC, workspaceId: WS })
        .catch((e) => e);

      expect(error).toBeInstanceOf(WsException);
      expect(error.getError()).toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
    });

    it('rejects joins where the workspace does not match the document', async () => {
      const socket = mkSocket({ user: USER });
      documentService.findById.mockRejectedValue(new Error('scoped miss'));

      await expect(
        gateway.handleJoin(socket, {
          documentId: DOC,
          workspaceId: '00000000-0000-4000-8000-000000000099',
        }),
      ).rejects.toThrow(WsException);
      expect(documentService.findById).toHaveBeenCalledWith(
        DOC,
        '00000000-0000-4000-8000-000000000099',
      );
    });

    it('throws DOCUMENT_ACCESS_DENIED for non-members', async () => {
      const socket = mkSocket({ user: USER });
      documentService.findById.mockResolvedValue({
        id: DOC,
        workspaceId: WS,
      } as any);
      workspaceService.isUserMember.mockResolvedValue(false);

      const error: WsException = await gateway
        .handleJoin(socket, { documentId: DOC, workspaceId: WS })
        .catch((e) => e);

      expect(error.getError()).toMatchObject({
        code: 'DOCUMENT_ACCESS_DENIED',
      });
      expect(manager.getOrLoad).not.toHaveBeenCalled();
    });
  });

  describe('handleUpdate', () => {
    it('applies the binary update and relays the raw envelope', async () => {
      const socket = mkSocket({ user: USER });
      const update = Buffer.from([1, 2, 3]);

      await gateway.handleUpdate(socket, { documentId: DOC, update });

      expect(manager.applyUpdate).toHaveBeenCalledWith(
        DOC,
        new Uint8Array([1, 2, 3]),
      );
      expect((socket as any).__room.emit).toHaveBeenCalledWith(DOC_WS.UPDATE, {
        documentId: DOC,
        update,
      });
    });

    it('rejects non-binary update payloads without touching the manager', async () => {
      const socket = mkSocket({ user: USER });

      await expect(
        gateway.handleUpdate(socket, { documentId: DOC, update: 'not-binary' }),
      ).rejects.toThrow(WsException);
      const error: WsException = await gateway
        .handleUpdate(socket, { documentId: DOC, update: 'not-binary' })
        .catch((e) => e);
      expect(error.getError()).toMatchObject({ code: 'INVALID_PAYLOAD' });
      expect(manager.applyUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleAwareness', () => {
    it('relays opaque awareness bytes to the other editors', async () => {
      const socket = mkSocket({ user: USER });
      const data = Buffer.from([9, 8, 7]);

      await gateway.handleAwareness(socket, { documentId: DOC, data });

      expect((socket as any).__room.emit).toHaveBeenCalledWith(
        DOC_WS.AWARENESS,
        { documentId: DOC, data },
      );
      expect(manager.applyUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleLeave / handleDisconnect', () => {
    it('cleans up presence on leave and broadcasts editor-left', async () => {
      const socket = mkSocket({ user: USER, currentDocumentId: DOC });
      editorPresence.removeEditor.mockReturnValue({
        userId: USER.sub,
        displayName: 'Alice',
        avatarUrl: null,
        color: '#E11D48',
      });

      await gateway.handleLeave(socket, { documentId: DOC });

      expect(socket.leave).toHaveBeenCalledWith(`document:${DOC}`);
      expect(manager.removeConnection).toHaveBeenCalledWith(DOC, 'sock-1');
      expect(editorPresence.removeEditor).toHaveBeenCalledWith(DOC, 'sock-1');
      expect((socket as any).__room.emit).toHaveBeenCalledWith(
        DOC_WS.EDITOR_LEFT,
        {
          userId: USER.sub,
          displayName: 'Alice',
          avatarUrl: null,
          color: '#E11D48',
        },
      );
      expect((socket as any).data.currentDocumentId).toBeUndefined();
    });

    it('skips the broadcast when the socket had no presence entry', async () => {
      const socket = mkSocket({ user: USER });
      editorPresence.removeEditor.mockReturnValue(null);

      await gateway.handleLeave(socket, { documentId: DOC });

      expect((socket as any).__room.emit).not.toHaveBeenCalled();
    });

    it('cleans up on disconnect when the socket is in a document room', () => {
      const socket = mkSocket({ user: USER, currentDocumentId: DOC });
      editorPresence.removeEditor.mockReturnValue(null);

      gateway.handleDisconnect(socket);

      expect(manager.removeConnection).toHaveBeenCalledWith(DOC, 'sock-1');
    });

    it('does nothing on disconnect when no document room was joined', () => {
      const socket = mkSocket({ user: USER });

      expect(() => gateway.handleDisconnect(socket)).not.toThrow();
      expect(manager.removeConnection).not.toHaveBeenCalled();
    });
  });

  describe('handleDocumentSaved', () => {
    it('relays the saved event to the document room', () => {
      const room = { emit: jest.fn() };
      (gateway as any).server = {
        to: jest.fn().mockReturnValue(room),
      };
      const savedAt = new Date();

      gateway.handleDocumentSaved(new DocumentSavedEvent(DOC, savedAt));

      expect((gateway as any).server.to).toHaveBeenCalledWith(
        `document:${DOC}`,
      );
      expect(room.emit).toHaveBeenCalledWith(DOC_WS.SAVED, {
        documentId: DOC,
        savedAt,
      });
    });

    it('no-ops when the server is not yet attached', () => {
      expect(() =>
        gateway.handleDocumentSaved(new DocumentSavedEvent(DOC, new Date())),
      ).not.toThrow();
    });
  });

  it('logs gateway initialization', () => {
    const logSpy = jest.spyOn(gateway['logger'], 'log').mockImplementation();
    gateway.afterInit();
    expect(logSpy).toHaveBeenCalled();
  });

  it('allows any origin via the gateway cors callback', () => {
    const gatewayMetadata = Reflect.getMetadata(
      'websockets:gateway_options',
      DocumentGateway,
    );
    const cb = jest.fn();
    gatewayMetadata.cors.origin('http://example.com', cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });
});
