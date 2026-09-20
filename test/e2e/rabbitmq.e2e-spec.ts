import { createTestApp, type TestApp } from '../helpers/app';
import { RabbitPublisherService } from '../../src/common/rabbitmq/publisher.service';
import { consumeOnce } from '../../src/common/rabbitmq/idempotency.util';
import { BoardService } from '../../src/modules/board/core/services/board.service';
import { CardService } from '../../src/modules/board/card/services/card.service';
import { MembershipService } from '../../src/modules/workspace/services/membership.service';
import {
  createVerifiedUser,
  createWorkspace,
  createBoard,
  createList,
  createCard,
  type TestUser,
} from '../helpers/factories';
import { req } from '../helpers/http';

describe('RabbitMQ & Messaging Foundation (e2e)', () => {
  let app: TestApp;
  let publisher: RabbitPublisherService;
  let boardService: BoardService;
  let cardService: CardService;
  let membershipService: MembershipService;
  let user: TestUser | undefined;
  let workspaceId: string | undefined;
  let boardId: string | undefined;
  let cardId: string | undefined;
  let hasInfra = false;

  beforeAll(async () => {
    app = await createTestApp();
    publisher = app.app.get<RabbitPublisherService>(RabbitPublisherService);
    boardService = app.app.get<BoardService>(BoardService);
    cardService = app.app.get<CardService>(CardService);
    membershipService = app.app.get<MembershipService>(MembershipService);

    try {
      await app.prisma.$queryRaw`SELECT 1`;
      await app.redis.ping();
      hasInfra = true;
    } catch {
      hasInfra = false;
    }

    if (hasInfra) {
      user = await createVerifiedUser(app, 'async-rmq');
      const ws = await createWorkspace(app, user);
      workspaceId = ws.id;

      const board = await createBoard(
        app,
        user,
        workspaceId,
        'Async RMQ Board',
      );
      boardId = board.id;

      const list = await createList(
        app,
        user,
        workspaceId,
        boardId,
        'Async List',
      );
      const card = await createCard(
        app,
        user,
        workspaceId,
        boardId,
        list.id,
        'Async Card',
      );
      cardId = card.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('RabbitPublisherService', () => {
    it('should be globally provided and injectable', () => {
      expect(publisher).toBeDefined();
      expect(typeof publisher.publish).toBe('function');
      expect(typeof publisher.publishRetry).toBe('function');
    });

    it('should fail-open without throwing when publishing even if broker is unavailable', async () => {
      await expect(
        publisher.publish(
          'notification.exchange',
          'notification.card.assigned',
          {
            cardId: cardId ?? 'mock-card-id',
          },
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('Idempotency (consumeOnce with Redis)', () => {
    it('should claim message on first call and reject on subsequent call', async () => {
      if (!hasInfra) {
        const mockRedis = {
          set: jest
            .fn()
            .mockResolvedValueOnce('OK')
            .mockResolvedValueOnce(null),
        } as any;
        expect(await consumeOnce(mockRedis, 'msg-1', 60)).toBe(true);
        expect(await consumeOnce(mockRedis, 'msg-1', 60)).toBe(false);
        return;
      }
      const msgId = `e2e-msg-${Date.now()}`;
      const first = await consumeOnce(app.redis, msgId, 60);
      const second = await consumeOnce(app.redis, msgId, 60);

      expect(first).toBe(true);
      expect(second).toBe(false);
    });
  });

  describe('Health Endpoint', () => {
    it('should query /api/health and report rabbitmq indicator status', async () => {
      const res = await req(app.app.getHttpServer()).get('/api/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toBeDefined();
      if (res.status === 200) {
        expect(res.body.data?.details?.rabbitmq).toBeDefined();
      } else {
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe('Cross-cutting Service Helpers', () => {
    it('BoardService.findWorkspaceIdByBoardId should resolve workspace for active board', async () => {
      if (!hasInfra || !boardId) return;
      const resolvedWs = await boardService.findWorkspaceIdByBoardId(boardId);
      expect(resolvedWs).toBe(workspaceId);
    });

    it('BoardService.findWorkspaceIdByBoardId should resolve workspace even after board is archived', async () => {
      if (!hasInfra || !user || !workspaceId) return;
      const tempBoard = await createBoard(
        app,
        user,
        workspaceId,
        'Board to Archive',
      );
      await boardService.archiveBoard(workspaceId, tempBoard.id, user.id);

      const resolvedWs = await boardService.findWorkspaceIdByBoardId(
        tempBoard.id,
      );
      expect(resolvedWs).toBe(workspaceId);
    });

    it('BoardService.findWorkspaceIdByBoardId should return null for non-existent board', async () => {
      if (!hasInfra) return;
      const resolved = await boardService.findWorkspaceIdByBoardId(
        '00000000-0000-0000-0000-000000000000',
      );
      expect(resolved).toBeNull();
    });

    it('CardService.findTitleById should return card title for active card and null for missing', async () => {
      if (!hasInfra || !cardId) return;
      const title = await cardService.findTitleById(cardId);
      expect(title).toBe('Async Card');

      const missing = await cardService.findTitleById(
        '00000000-0000-0000-0000-000000000000',
      );
      expect(missing).toBeNull();
    });

    it('CardService.findAssigneeIdsByCardId should return assignees for card', async () => {
      if (!hasInfra || !cardId || !user) return;
      await cardService.assignUser(cardId, user.id);

      const assignees = await cardService.findAssigneeIdsByCardId(cardId);
      expect(assignees).toContain(user.id);
    });

    it('MembershipService.findUserIdsByEmails should resolve member email to userId', async () => {
      if (!hasInfra || !workspaceId || !user) return;
      const resolved = await membershipService.findUserIdsByEmails(
        workspaceId,
        [user.email.toUpperCase(), 'nonexistent@example.com'],
      );

      expect(resolved.size).toBe(1);
      expect(resolved.get(user.email.toLowerCase())).toBe(user.id);
    });

    it('MembershipService.findUserIdsByEmails should return empty map for empty/whitespace input without DB query', async () => {
      const resolved = await membershipService.findUserIdsByEmails(
        '00000000-0000-0000-0000-000000000000',
        ['   ', ''],
      );
      expect(resolved.size).toBe(0);
    });
  });
});
