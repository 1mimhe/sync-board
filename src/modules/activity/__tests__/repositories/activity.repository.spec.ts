import type { Activity } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException } from '@nestjs/common';
import { ActivityRepository } from '../../repositories/activity.repository';
import { PrismaService } from '../../../../common/database/prisma.service';
import { encodeActivityCursor } from '../../utils/activity-cursor.util';

describe('ActivityRepository', () => {
  let repository: ActivityRepository;
  let prismaService: DeepMockProxy<PrismaService>;

  const row = (
    id: bigint,
    createdAt = '2026-09-01T00:00:00.000Z',
  ): Activity => ({
    id,
    createdAt: new Date(createdAt),
    workspaceId: 'ws-1',
    boardId: 'b-1',
    entityType: 'card',
    entityId: 'c-1',
    action: 'created',
    actorId: 'u-1',
    payload: {},
    metadata: null,
  });

  beforeEach(() => {
    prismaService = mockDeep<PrismaService>();
    repository = new ActivityRepository(prismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('record', () => {
    it('should append an activity with defaults', async () => {
      prismaService.activity.create.mockResolvedValue(row(1n));

      await repository.record({
        workspaceId: 'ws-1',
        boardId: null,
        entityType: 'workspace',
        entityId: 'ws-1',
        action: 'created',
        actorId: 'u-1',
      });

      expect(prismaService.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: 'ws-1',
          boardId: null,
          entityType: 'workspace',
          action: 'created',
          actorId: 'u-1',
          payload: {},
        }),
      });
    });

    it('should pass payload and metadata through', async () => {
      prismaService.activity.create.mockResolvedValue(row(1n));

      await repository.record({
        workspaceId: 'ws-1',
        boardId: 'b-1',
        entityType: 'card',
        entityId: 'c-1',
        action: 'moved',
        actorId: 'u-1',
        payload: { fromListId: 'l-1', toListId: 'l-2' },
        metadata: { source: 'test' },
      });

      expect(prismaService.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: { fromListId: 'l-1', toListId: 'l-2' },
          metadata: { source: 'test' },
        }),
      });
    });
  });

  describe('getWorkspacePage', () => {
    it('should fetch limit+1 and compute hasMore with iso|id cursor', async () => {
      prismaService.activity.findMany.mockResolvedValue([row(5n), row(4n)]);

      const result = await repository.getWorkspacePage(
        'ws-1',
        {},
        undefined,
        1,
      );

      expect(prismaService.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2 }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.cursor).toBe(
        encodeActivityCursor(new Date('2026-09-01T00:00:00.000Z'), '5'),
      );
    });

    it('should apply cursor boundary via OR predicate', async () => {
      prismaService.activity.findMany.mockResolvedValue([]);
      const cursor = encodeActivityCursor(
        new Date('2026-09-01T00:00:00.000Z'),
        '42',
      );

      await repository.getWorkspacePage('ws-1', {}, cursor, 20);

      expect(prismaService.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: 'ws-1',
            OR: [
              { createdAt: { lt: new Date('2026-09-01T00:00:00.000Z') } },
              {
                createdAt: new Date('2026-09-01T00:00:00.000Z'),
                id: { lt: 42n },
              },
            ],
          }),
        }),
      );
    });

    it('should throw BadRequestException on invalid cursor', async () => {
      await expect(
        repository.getWorkspacePage('ws-1', {}, 'not-a-cursor', 20),
      ).rejects.toThrow(BadRequestException);
      expect(prismaService.activity.findMany).not.toHaveBeenCalled();
    });

    it('should reject cursor with out-of-range bigint id', async () => {
      await expect(
        repository.getWorkspacePage(
          'ws-1',
          {},
          '2026-09-01T00:00:00.000Z|99999999999999999999999',
          20,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass each filter through', async () => {
      prismaService.activity.findMany.mockResolvedValue([]);

      await repository.getWorkspacePage(
        'ws-1',
        { boardId: 'b-1', entityType: 'card', entityId: 'c-1', actorId: 'u-1' },
        undefined,
        20,
      );

      expect(prismaService.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: 'ws-1',
            boardId: 'b-1',
            entityType: 'card',
            entityId: 'c-1',
            actorId: 'u-1',
          }),
        }),
      );
    });
  });

  it('delegates partition maintenance to the database function', async () => {
    prismaService.$executeRaw.mockResolvedValue(1);
    await repository.ensurePartitions();
    expect(prismaService.$executeRaw).toHaveBeenCalled();
  });
});
