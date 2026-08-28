import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { UnauthorizedException } from '@nestjs/common';
import { BoardGateway } from '../../gateways/board.gateway';
import { JwtTokenService } from '../../../../auth/services/jwt-token.service';
import { TokenBlacklistService } from '../../../../auth/services/token-blacklist.service';
import { WorkspaceMemberRepository } from '../../../../workspace/repositories/workspace-member.repository';
import { BoardRepository } from '../../../board/repositories/board.repository';
import { PresenceService } from '../../services/presence.service';
import { BroadcastRelayService } from '../../services/broadcast-relay.service';
import { WsRateLimiterService } from '../../services/ws-rate-limiter.service';
import { WsWorkspaceMemberGuard } from '../../../../workspace/guards/ws-workspace-member.guard';
import { WsBoardAccessGuard } from '../../guards/ws-board-access.guard';
import { WS_EVENTS, PRESENCE_CONFIG } from '../../ws-events.constants';
import { GATEWAY_OPTIONS } from '@nestjs/websockets/constants';
import {
  BoardCreatedEvent,
  BoardUpdatedEvent,
  BoardArchivedEvent,
  BoardUnarchivedEvent,
} from '../../../board/events/board.events';
import {
  ListCreatedEvent,
  ListUpdatedEvent,
  ListMovedEvent,
  ListArchivedEvent,
  ListUnarchivedEvent,
} from '../../../list/events/list.events';
import {
  CardCreatedEvent,
  CardUpdatedEvent,
  CardMovedEvent,
  CardArchivedEvent,
  CardUnarchivedEvent,
} from '../../../card/events/card.events';
import { CommentCreatedEvent } from '../../../comment/events/comment.events';
import {
  AttachmentCreatedEvent,
  AttachmentDeletedEvent,
} from '../../../attachment/events/attachment.events';
import type { Server, Socket } from 'socket.io';
import {
  ChecklistCreatedEvent,
  ChecklistUpdatedEvent,
  ChecklistDeletedEvent,
} from '../../../checklist/events/checklist.events';

describe('BoardGateway', () => {
  let gateway: BoardGateway;
  let jwtTokenService: DeepMockProxy<JwtTokenService>;
  let blacklistService: DeepMockProxy<TokenBlacklistService>;
  let workspaceMemberRepo: DeepMockProxy<WorkspaceMemberRepository>;
  let boardRepo: DeepMockProxy<BoardRepository>;
  let presenceService: DeepMockProxy<PresenceService>;
  let rateLimiter: DeepMockProxy<WsRateLimiterService>;
  let mockServer: any;
  let mockSocket: any;

  const validJwtPayload = {
    sub: '123e4567-e89b-42d3-a456-426614174000',
    email: 'alice@example.com',
    displayName: 'Alice',
    jti: 'token-jti-123',
    iat: 1234567,
    exp: 2345678,
    iss: 'syncboard',
  };

  beforeEach(async () => {
    jwtTokenService = mockDeep<JwtTokenService>();
    blacklistService = mockDeep<TokenBlacklistService>();
    workspaceMemberRepo = mockDeep<WorkspaceMemberRepository>();
    boardRepo = mockDeep<BoardRepository>();
    presenceService = mockDeep<PresenceService>();
    rateLimiter = mockDeep<WsRateLimiterService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardGateway,
        { provide: JwtTokenService, useValue: jwtTokenService },
        { provide: TokenBlacklistService, useValue: blacklistService },
        { provide: WorkspaceMemberRepository, useValue: workspaceMemberRepo },
        { provide: BoardRepository, useValue: boardRepo },
        { provide: PresenceService, useValue: presenceService },
        BroadcastRelayService,
        { provide: WsRateLimiterService, useValue: rateLimiter },
      ],
    }).compile();

    gateway = module.get<BoardGateway>(BoardGateway);

    // Mock Socket.IO Server and Socket
    mockServer = {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      fetchSockets: jest.fn().mockResolvedValue([]),
    };
    gateway.server = mockServer as Server;

    mockSocket = {
      id: 'socket-123',
      handshake: {
        auth: {},
        headers: {},
      },
      data: {},
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      disconnect: jest.fn(),
    };
  });

  afterEach(() => {
    gateway.onModuleDestroy();
  });

  describe('CORS Configuration', () => {
    it('should allow all origins in cors callback', () => {
      const options = Reflect.getMetadata(GATEWAY_OPTIONS, BoardGateway);
      expect(options).toBeDefined();
      const corsOrigin = options.cors.origin;
      const callback = jest.fn();
      corsOrigin('https://localhost:3000', callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });
  });

  describe('Lifecycle', () => {
    it('should start cleanup interval in afterInit and clear in onModuleDestroy', () => {
      jest.useFakeTimers();
      gateway.afterInit();
      expect((gateway as any).cleanupInterval).toBeDefined();

      gateway.onModuleDestroy();
      expect((gateway as any).cleanupInterval).toBeNull();
      jest.useRealTimers();
    });

    it('should run presence cleanup when the interval ticks', async () => {
      jest.useFakeTimers();
      try {
        presenceService.cleanupStaleEntries.mockResolvedValue(new Map());
        gateway.afterInit();
        await jest.advanceTimersByTimeAsync(
          PRESENCE_CONFIG.CLEANUP_INTERVAL_MS,
        );
        expect(presenceService.cleanupStaleEntries).toHaveBeenCalled();
      } finally {
        gateway.onModuleDestroy();
        jest.useRealTimers();
      }
    });

    it('should broadcast left events for pruned stale presence entries in runPresenceCleanup', async () => {
      const prunedMap = new Map([
        ['b-1', { userId: 'u-1', displayName: 'Stale User' }],
      ]);
      presenceService.cleanupStaleEntries.mockResolvedValue(prunedMap as any);

      await (gateway as any).runPresenceCleanup();

      expect(mockServer.to).toHaveBeenCalledWith('board:b-1');
      expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.BOARD_PRESENCE, {
        userId: 'u-1',
        action: 'left',
        displayName: 'Stale User',
      });
    });
  });

  describe('handleConnection', () => {
    it('should authenticate client with token in handshake.auth and join user room', async () => {
      mockSocket.handshake.auth = { token: 'valid-token' };
      jwtTokenService.verifyAccessToken.mockReturnValue(validJwtPayload);
      blacklistService.isBlacklisted.mockResolvedValue(false);

      await gateway.handleConnection(mockSocket as Socket);

      expect(mockSocket.data).toEqual({ user: validJwtPayload });
      expect(mockSocket.join).toHaveBeenCalledWith(
        `user:${validJwtPayload.sub}`,
      );
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should authenticate client with Bearer token in headers', async () => {
      mockSocket.handshake.headers = { authorization: 'Bearer header-token' };
      jwtTokenService.verifyAccessToken.mockReturnValue(validJwtPayload);
      blacklistService.isBlacklisted.mockResolvedValue(false);

      await gateway.handleConnection(mockSocket as Socket);

      expect(jwtTokenService.verifyAccessToken).toHaveBeenCalledWith(
        'header-token',
      );
      expect(mockSocket.join).toHaveBeenCalledWith(
        `user:${validJwtPayload.sub}`,
      );
    });

    it('should reject and disconnect when token is missing', async () => {
      await gateway.handleConnection(mockSocket as Socket);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        code: 'TOKEN_INVALID',
        message: 'Authentication token required',
      });
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject and disconnect when token is blacklisted', async () => {
      mockSocket.handshake.auth = { token: 'blacklisted-token' };
      jwtTokenService.verifyAccessToken.mockReturnValue(validJwtPayload);
      blacklistService.isBlacklisted.mockResolvedValue(true);

      await gateway.handleConnection(mockSocket as Socket);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        code: 'TOKEN_REVOKED',
        message: 'Token has been revoked',
      });
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject and emit TOKEN_EXPIRED when JWT verification throws TOKEN_EXPIRED', async () => {
      mockSocket.handshake.auth = { token: 'expired-token' };
      jwtTokenService.verifyAccessToken.mockImplementation(() => {
        throw new UnauthorizedException('TOKEN_EXPIRED');
      });

      await gateway.handleConnection(mockSocket as Socket);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        code: 'TOKEN_EXPIRED',
        message: 'TOKEN_EXPIRED',
      });
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up board presence and broadcast left event to board room', async () => {
      mockSocket.data = {
        user: validJwtPayload,
        currentBoardId: '123e4567-e89b-42d3-a456-426614174000',
      };
      presenceService.removePresence.mockResolvedValue({
        userId: validJwtPayload.sub,
        socketId: mockSocket.id,
        displayName: validJwtPayload.displayName,
        avatarUrl: null,
        color: '#E74C3C',
        connectedAt: '2026-08-18T10:00:00.000Z',
      });

      await gateway.handleDisconnect(mockSocket as Socket);

      expect(presenceService.removePresence).toHaveBeenCalledWith(
        '123e4567-e89b-42d3-a456-426614174000',
        mockSocket.id,
      );
      expect(mockServer.to).toHaveBeenCalledWith(
        'board:123e4567-e89b-42d3-a456-426614174000',
      );
      expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.BOARD_PRESENCE, {
        userId: validJwtPayload.sub,
        action: 'left',
        displayName: validJwtPayload.displayName,
      });
    });

    it('should broadcast workspace:member-offline if user has no remaining sockets in workspace', async () => {
      mockSocket.data = {
        user: validJwtPayload,
        currentWorkspaceId: '123e4567-e89b-42d3-a456-426614174001',
      };

      // Server in workspace returns only other users' sockets
      mockServer.fetchSockets.mockResolvedValue([
        {
          id: 'other-sock',
          data: { user: { sub: '123e4567-e89b-42d3-a456-426614174002' } },
        },
      ]);

      await gateway.handleDisconnect(mockSocket as Socket);

      expect(mockServer.to).toHaveBeenCalledWith(
        'workspace:123e4567-e89b-42d3-a456-426614174001',
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        WS_EVENTS.WORKSPACE_MEMBER_OFFLINE,
        {
          userId: validJwtPayload.sub,
        },
      );
    });

    it('should do nothing if socket was not authenticated', async () => {
      mockSocket.data = {};

      await gateway.handleDisconnect(mockSocket as Socket);

      expect(presenceService.removePresence).not.toHaveBeenCalled();
    });
  });

  describe('handleWorkspaceJoin', () => {
    const validWorkspaceId = '123e4567-e89b-42d3-a456-426614174000';

    beforeEach(() => {
      mockSocket.data = { user: validJwtPayload };
      rateLimiter.checkRateLimit.mockResolvedValue(true);
    });

    it('should allow workspace member to join workspace room and emit joined and member-online events', async () => {
      workspaceMemberRepo.findMember.mockResolvedValue({
        id: '123e4567-e89b-42d3-a456-426614174003',
        workspaceId: validWorkspaceId,
        userId: validJwtPayload.sub,
        role: 'member',
        joinedAt: new Date(),
      } as any);

      mockServer.fetchSockets.mockResolvedValue([
        {
          id: mockSocket.id,
          data: { user: validJwtPayload },
        },
      ]);

      await gateway.handleWorkspaceJoin(mockSocket as Socket, {
        workspaceId: validWorkspaceId,
      });

      expect(mockSocket.join).toHaveBeenCalledWith(
        `workspace:${validWorkspaceId}`,
      );
      expect(mockSocket.emit).toHaveBeenCalledWith(WS_EVENTS.WORKSPACE_JOINED, {
        workspaceId: validWorkspaceId,
        onlineMembers: [
          {
            userId: validJwtPayload.sub,
            displayName: validJwtPayload.displayName,
          },
        ],
      });
      expect(mockSocket.to).toHaveBeenCalledWith(
        `workspace:${validWorkspaceId}`,
      );
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WS_EVENTS.WORKSPACE_MEMBER_ONLINE,
        {
          userId: validJwtPayload.sub,
          displayName: validJwtPayload.displayName,
        },
      );
    });

    it('should have WsWorkspaceMemberGuard and WsRateLimit decorators applied', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        gateway.handleWorkspaceJoin,
      );
      expect(guards).toContain(WsWorkspaceMemberGuard);

      const rateLimit = Reflect.getMetadata(
        'ws_rate_limit',
        gateway.handleWorkspaceJoin,
      );
      expect(rateLimit).toEqual(
        expect.objectContaining({
          category: 'join',
          limit: 10,
        }),
      );
    });

    it('should leave previous workspace room when switching workspaces', async () => {
      mockSocket.data.currentWorkspaceId =
        '123e4567-e89b-42d3-a456-426614174099';
      workspaceMemberRepo.findMember.mockResolvedValue({} as any);

      await gateway.handleWorkspaceJoin(mockSocket as Socket, {
        workspaceId: validWorkspaceId,
      });

      expect(mockSocket.leave).toHaveBeenCalledWith(
        'workspace:123e4567-e89b-42d3-a456-426614174099',
      );
      expect(mockSocket.join).toHaveBeenCalledWith(
        `workspace:${validWorkspaceId}`,
      );
    });
  });

  describe('handleWorkspaceLeave', () => {
    it('should leave workspace room and clear currentWorkspaceId', async () => {
      const workspaceId = '123e4567-e89b-42d3-a456-426614174000';
      mockSocket.data = {
        user: validJwtPayload,
        currentWorkspaceId: workspaceId,
      };

      await gateway.handleWorkspaceLeave(mockSocket as Socket, { workspaceId });

      expect(mockSocket.leave).toHaveBeenCalledWith(`workspace:${workspaceId}`);
      expect(mockSocket.data.currentWorkspaceId).toBeUndefined();
    });
  });

  describe('handleBoardJoin', () => {
    const validBoardId = '123e4567-e89b-42d3-a456-426614174000';
    const workspaceId = '123e4567-e89b-42d3-a456-426614174001';

    beforeEach(() => {
      mockSocket.data = { user: validJwtPayload };
      rateLimiter.checkRateLimit.mockResolvedValue(true);
    });

    it('should join board room, register presence in Redis, and broadcast presence update', async () => {
      boardRepo.findById.mockResolvedValue({
        id: validBoardId,
        workspaceId,
        title: 'Sprint Board',
        archivedAt: null,
      } as any);

      workspaceMemberRepo.findMember.mockResolvedValue({
        id: 'member-1',
        workspaceId,
        userId: validJwtPayload.sub,
      } as any);

      presenceService.getCollaboratorColor.mockResolvedValue('#3498DB');
      presenceService.getBoardViewers.mockResolvedValue([
        {
          userId: validJwtPayload.sub,
          displayName: validJwtPayload.displayName,
          avatarUrl: null,
          color: '#3498DB',
          connectedAt: '2026-08-18T10:00:00.000Z',
        },
      ]);

      await gateway.handleBoardJoin(mockSocket as Socket, {
        boardId: validBoardId,
      });

      expect(mockSocket.join).toHaveBeenCalledWith(`board:${validBoardId}`);
      expect(presenceService.addPresence).toHaveBeenCalledWith(
        validBoardId,
        expect.objectContaining({
          userId: validJwtPayload.sub,
          socketId: mockSocket.id,
          color: '#3498DB',
        }),
      );
      expect(mockSocket.emit).toHaveBeenCalledWith(WS_EVENTS.BOARD_JOINED, {
        boardId: validBoardId,
        viewers: expect.any(Array),
      });
      expect(mockSocket.to).toHaveBeenCalledWith(`board:${validBoardId}`);
      expect(mockSocket.emit).toHaveBeenCalledWith(WS_EVENTS.BOARD_PRESENCE, {
        userId: validJwtPayload.sub,
        action: 'joined',
        displayName: validJwtPayload.displayName,
        avatarUrl: null,
        color: '#3498DB',
      });
    });

    it('should leave the previous board room when switching boards', async () => {
      const previousBoardId = '123e4567-e89b-42d3-a456-426614174002';
      mockSocket.data = {
        user: validJwtPayload,
        currentBoardId: previousBoardId,
      };
      boardRepo.findById.mockResolvedValue({
        id: validBoardId,
        workspaceId,
        title: 'Sprint Board',
        archivedAt: null,
      } as any);
      workspaceMemberRepo.findMember.mockResolvedValue({
        id: 'member-1',
        workspaceId,
        userId: validJwtPayload.sub,
      } as any);
      presenceService.getCollaboratorColor.mockResolvedValue('#3498DB');
      presenceService.getBoardViewers.mockResolvedValue([]);
      presenceService.removePresence.mockResolvedValue({} as any);

      await gateway.handleBoardJoin(mockSocket as Socket, {
        boardId: validBoardId,
      });

      expect(mockSocket.leave).toHaveBeenCalledWith(`board:${previousBoardId}`);
      expect(presenceService.removePresence).toHaveBeenCalledWith(
        previousBoardId,
        mockSocket.id,
      );
      expect(mockSocket.join).toHaveBeenCalledWith(`board:${validBoardId}`);
    });

    it('should have WsBoardAccessGuard and WsRateLimit decorators applied', () => {
      const guards = Reflect.getMetadata('__guards__', gateway.handleBoardJoin);
      expect(guards).toContain(WsBoardAccessGuard);

      const rateLimit = Reflect.getMetadata(
        'ws_rate_limit',
        gateway.handleBoardJoin,
      );
      expect(rateLimit).toEqual(
        expect.objectContaining({
          category: 'join',
          limit: 10,
        }),
      );
    });
  });

  describe('handleBoardLeave', () => {
    it('should leave board room and remove presence', async () => {
      const boardId = '123e4567-e89b-42d3-a456-426614174000';
      mockSocket.data = { user: validJwtPayload, currentBoardId: boardId };
      presenceService.removePresence.mockResolvedValue({} as any);

      await gateway.handleBoardLeave(mockSocket as Socket, { boardId });

      expect(mockSocket.leave).toHaveBeenCalledWith(`board:${boardId}`);
      expect(presenceService.removePresence).toHaveBeenCalledWith(
        boardId,
        mockSocket.id,
      );
      expect(mockSocket.data.currentBoardId).toBeUndefined();
    });
  });

  describe('handleHeartbeat', () => {
    it('should update presence heartbeat if current board is joined', async () => {
      mockSocket.data = {
        user: validJwtPayload,
        currentBoardId: '123e4567-e89b-42d3-a456-426614174000',
      };

      await gateway.handleHeartbeat(mockSocket as Socket);

      expect(presenceService.updateHeartbeat).toHaveBeenCalledWith(
        '123e4567-e89b-42d3-a456-426614174000',
        mockSocket.id,
      );
    });

    it('should do nothing if no board is joined', async () => {
      mockSocket.data = { user: validJwtPayload };

      await gateway.handleHeartbeat(mockSocket as Socket);

      expect(presenceService.updateHeartbeat).not.toHaveBeenCalled();
    });
  });

  describe('handleCursor', () => {
    const validBoardId = '123e4567-e89b-42d3-a456-426614174000';

    it('should broadcast cursor position to board room when within rate limit', async () => {
      mockSocket.data = { user: validJwtPayload };
      rateLimiter.checkRateLimit.mockResolvedValue(true);
      presenceService.getBoardViewers.mockResolvedValue([
        {
          userId: validJwtPayload.sub,
          displayName: validJwtPayload.displayName,
          avatarUrl: null,
          color: '#1ABC9C',
          connectedAt: '2026-08-18T10:00:00.000Z',
        },
      ]);

      await gateway.handleCursor(mockSocket as Socket, {
        boardId: validBoardId,
        x: 100,
        y: 250,
      });

      expect(mockSocket.to).toHaveBeenCalledWith(`board:${validBoardId}`);
      expect(mockSocket.emit).toHaveBeenCalledWith(WS_EVENTS.BOARD_CURSOR, {
        userId: validJwtPayload.sub,
        displayName: validJwtPayload.displayName,
        color: '#1ABC9C',
        x: 100,
        y: 250,
        cardId: undefined,
      });
    });

    it('should have WsRateLimit decorator applied with silent mode', () => {
      const rateLimit = Reflect.getMetadata(
        'ws_rate_limit',
        gateway.handleCursor,
      );
      expect(rateLimit).toEqual(
        expect.objectContaining({
          category: 'cursor',
          limit: 600,
          silent: true,
        }),
      );
    });
  });
});
