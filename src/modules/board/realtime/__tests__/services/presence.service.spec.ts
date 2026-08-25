import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PresenceService } from '../../services/presence.service';
import { RedisService } from '../../../../../common/redis/redis.service';
import { COLLABORATOR_COLORS } from '../../ws-events.constants';
import type { PresenceEntry } from '../../../../../common/interfaces/ws.interface';

describe('PresenceService', () => {
  let service: PresenceService;
  let redisService: DeepMockProxy<RedisService>;
  let mockPipeline: any;

  beforeEach(async () => {
    mockPipeline = {
      sadd: jest.fn().mockReturnThis(),
      srem: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      zrem: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      hset: jest.fn().mockReturnThis(),
      hget: jest.fn().mockReturnThis(),
      hdel: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 1],
        [null, 1],
        [null, 1],
        [null, 1],
      ]),
    };

    redisService = mockDeep<RedisService>();
    redisService.pipeline.mockReturnValue(mockPipeline);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
  });

  describe('addPresence', () => {
    it('should add presence entry using dual-key pipeline (ZSET active + HASH meta + SET active_boards)', async () => {
      const entry: PresenceEntry = {
        userId: 'user-1',
        socketId: 'sock-1',
        displayName: 'Alice',
        avatarUrl: null,
        color: '#E74C3C',
        connectedAt: '2026-08-18T10:00:00.000Z',
      };

      await service.addPresence('board-1', entry);

      expect(redisService.pipeline).toHaveBeenCalled();
      expect(mockPipeline.sadd).toHaveBeenCalledWith('presence:active_boards', 'board-1');
      expect(mockPipeline.zadd).toHaveBeenCalledWith(
        'presence:board:board-1:active',
        expect.any(Number),
        'sock-1',
      );
      expect(mockPipeline.hset).toHaveBeenCalledWith(
        'presence:board:board-1:meta',
        'sock-1',
        JSON.stringify(entry),
      );
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('removePresence', () => {
    it('should remove socket entry from active ZSET and meta HASH via pipeline, returning the entry', async () => {
      const entry: PresenceEntry = {
        userId: 'user-1',
        socketId: 'sock-1',
        displayName: 'Alice',
        avatarUrl: null,
        color: '#E74C3C',
        connectedAt: '2026-08-18T10:00:00.000Z',
      };

      mockPipeline.exec.mockResolvedValue([
        [null, JSON.stringify(entry)], // hget
        [null, 1], // zrem
        [null, 1], // hdel
        [null, 1], // zcard (1 remaining)
      ]);

      const result = await service.removePresence('board-1', 'sock-1');

      expect(result).toEqual(entry);
      expect(mockPipeline.hget).toHaveBeenCalledWith('presence:board:board-1:meta', 'sock-1');
      expect(mockPipeline.zrem).toHaveBeenCalledWith('presence:board:board-1:active', 'sock-1');
      expect(mockPipeline.hdel).toHaveBeenCalledWith('presence:board:board-1:meta', 'sock-1');
      expect(redisService.srem).not.toHaveBeenCalled();
    });

    it('should remove board from active_boards set if remaining count reaches 0', async () => {
      const entry: PresenceEntry = {
        userId: 'user-1',
        socketId: 'sock-1',
        displayName: 'Alice',
        avatarUrl: null,
        color: '#E74C3C',
        connectedAt: '2026-08-18T10:00:00.000Z',
      };

      mockPipeline.exec.mockResolvedValue([
        [null, JSON.stringify(entry)],
        [null, 1],
        [null, 1],
        [null, 0], // zcard = 0 remaining
      ]);

      await service.removePresence('board-1', 'sock-1');

      expect(redisService.srem).toHaveBeenCalledWith('presence:active_boards', 'board-1');
    });

    it('should return null when removing non-existent socketId', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, null], // hget returns null
        [null, 0],
        [null, 0],
        [null, 0],
      ]);

      const result = await service.removePresence('board-1', 'non-existent-socket');

      expect(result).toBeNull();
    });

    it('should return null when entry in redis is corrupted/invalid JSON', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 'INVALID_JSON_CORRUPTED'],
        [null, 1],
        [null, 1],
        [null, 1],
      ]);

      const result = await service.removePresence('board-1', 'corrupted-socket');

      expect(result).toBeNull();
    });
  });

  describe('removeUserPresence', () => {
    it('should remove ALL sockets for a given userId and srem active_boards if empty', async () => {
      const entry1: PresenceEntry = {
        userId: 'user-1',
        socketId: 'sock-tab-1',
        displayName: 'Alice',
        avatarUrl: null,
        color: '#E74C3C',
        connectedAt: '2026-08-18T10:00:00.000Z',
      };

      redisService.hgetall.mockResolvedValue({
        'sock-tab-1': JSON.stringify(entry1),
      });

      mockPipeline.exec.mockResolvedValue([
        [null, 1], // zrem
        [null, 1], // hdel
        [null, 0], // zcard (0 remaining)
      ]);

      const removed = await service.removeUserPresence('board-1', 'user-1');

      expect(removed).toHaveLength(1);
      expect(redisService.srem).toHaveBeenCalledWith('presence:active_boards', 'board-1');
    });

    it('should return empty array when user has no presence entries', async () => {
      redisService.hgetall.mockResolvedValue({});

      const removed = await service.removeUserPresence('board-1', 'user-unknown');
      expect(removed).toEqual([]);
      expect(mockPipeline.exec).not.toHaveBeenCalled();
    });
  });

  describe('updateHeartbeat', () => {
    it('should update timestamp score in active ZSET in O(log N) without JSON parsing', async () => {
      redisService.zadd.mockResolvedValue(0);

      await service.updateHeartbeat('board-1', 'sock-1');

      expect(redisService.zadd).toHaveBeenCalledWith(
        'presence:board:board-1:active',
        expect.any(Number),
        'sock-1',
      );
    });
  });

  describe('getBoardViewers', () => {
    it('should query active socketIds by score and fetch metadata in a single HMGET batch, deduplicating users', async () => {
      const entryTab1: PresenceEntry = {
        userId: 'user-1',
        socketId: 'sock-1',
        displayName: 'Alice',
        avatarUrl: 'https://example.com/alice.png',
        color: '#E74C3C',
        connectedAt: '2026-08-18T10:00:00.000Z',
      };
      const entryTab2: PresenceEntry = {
        userId: 'user-1',
        socketId: 'sock-2',
        displayName: 'Alice',
        avatarUrl: 'https://example.com/alice.png',
        color: '#E74C3C',
        connectedAt: '2026-08-18T10:01:00.000Z',
      };
      const entryBob: PresenceEntry = {
        userId: 'user-2',
        socketId: 'sock-3',
        displayName: 'Bob',
        avatarUrl: null,
        color: '#3498DB',
        connectedAt: '2026-08-18T10:02:00.000Z',
      };

      redisService.zrangebyscore.mockResolvedValue(['sock-1', 'sock-2', 'sock-3']);
      redisService.hmget.mockResolvedValue([
        JSON.stringify(entryTab1),
        JSON.stringify(entryTab2),
        JSON.stringify(entryBob),
      ]);

      const viewers = await service.getBoardViewers('board-1');

      expect(redisService.zrangebyscore).toHaveBeenCalledWith(
        'presence:board:board-1:active',
        expect.any(Number),
        '+inf',
      );
      expect(redisService.hmget).toHaveBeenCalledWith(
        'presence:board:board-1:meta',
        'sock-1',
        'sock-2',
        'sock-3',
      );

      expect(viewers).toHaveLength(2);
      expect(viewers[0]).toEqual({
        userId: 'user-1',
        displayName: 'Alice',
        avatarUrl: 'https://example.com/alice.png',
        color: '#E74C3C',
        connectedAt: '2026-08-18T10:00:00.000Z',
      });
      expect(viewers[1]).toEqual({
        userId: 'user-2',
        displayName: 'Bob',
        avatarUrl: null,
        color: '#3498DB',
        connectedAt: '2026-08-18T10:02:00.000Z',
      });
      expect((viewers[0] as any).socketId).toBeUndefined();
    });

    it('should return empty array for boards with zero active viewers', async () => {
      redisService.zrangebyscore.mockResolvedValue([]);

      const viewers = await service.getBoardViewers('board-empty');
      expect(viewers).toEqual([]);
      expect(redisService.hmget).not.toHaveBeenCalled();
    });
  });

  describe('getCollaboratorColor', () => {
    it('should assign a color deterministically using FNV-1a hash', async () => {
      redisService.zrangebyscore.mockResolvedValue([]);

      const color1 = await service.getCollaboratorColor('user-uuid-1', 'board-1');
      const color2 = await service.getCollaboratorColor('user-uuid-1', 'board-1');

      expect(COLLABORATOR_COLORS).toContain(color1);
      expect(color1).toBe(color2);
    });

    it('should avoid colors already taken by active viewers on the same board', async () => {
      const activeViewer: PresenceEntry = {
        userId: 'other-user',
        socketId: 'sock-1',
        displayName: 'Viewer',
        avatarUrl: null,
        color: COLLABORATOR_COLORS[0],
        connectedAt: '2026-08-18T10:00:00.000Z',
      };

      redisService.zrangebyscore.mockResolvedValue(['sock-1']);
      redisService.hmget.mockResolvedValue([JSON.stringify(activeViewer)]);

      const color = await service.getCollaboratorColor('user-1', 'board-1');
      expect(color).not.toBe(activeViewer.color);
    });

    it('should fall back to a golden-ratio HSL color when all 16 palette slots are taken', async () => {
      const allTakenEntries: PresenceEntry[] = [...COLLABORATOR_COLORS].map((color, idx) => ({
        userId: `filler-${idx}`,
        socketId: `filler-sock-${idx}`,
        displayName: `Filler ${idx}`,
        avatarUrl: null,
        color,
        connectedAt: '2026-08-18T10:00:00.000Z',
      }));

      redisService.zrangebyscore.mockResolvedValue(allTakenEntries.map((e) => e.socketId));
      redisService.hmget.mockResolvedValue(allTakenEntries.map((e) => JSON.stringify(e)));

      const color = await service.getCollaboratorColor('overflow-user', 'board-full');

      expect(COLLABORATOR_COLORS as readonly string[]).not.toContain(color);
      expect(color).toMatch(/^hsl\(\d+, 75%, 50%\)$/);
    });

    it('should reuse existing color for a user who already has active presence on the board (multi-tab)', async () => {
      const activeViewer: PresenceEntry = {
        userId: 'user-tab-1',
        socketId: 'sock-tab-1',
        displayName: 'Tab User',
        avatarUrl: null,
        color: '#EA580C',
        connectedAt: '2026-08-18T10:00:00.000Z',
      };

      redisService.zrangebyscore.mockResolvedValue(['sock-tab-1']);
      redisService.hmget.mockResolvedValue([JSON.stringify(activeViewer)]);

      const color = await service.getCollaboratorColor('user-tab-1', 'board-1');
      expect(color).toBe('#EA580C');
    });
  });

  describe('cleanupStaleEntries', () => {
    const makeCheckPipeline = (execResult: any[][]) => ({
      zrangebyscore: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(execResult),
    });

    const makePrunePipeline = (execResult: any[][]) => ({
      hmget: jest.fn().mockReturnThis(),
      zrem: jest.fn().mockReturnThis(),
      hdel: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(execResult),
    });

    it('should catch and log error if redis throws in cleanupStaleEntries', async () => {
      redisService.smembers.mockRejectedValue(new Error('Redis connection down'));

      const result = await service.cleanupStaleEntries();
      expect(result).toEqual([]);
    });

    it('should return empty array if active_boards set is empty', async () => {
      redisService.smembers.mockResolvedValue([]);

      const result = await service.cleanupStaleEntries();
      expect(result).toEqual([]);
      expect(redisService.pipeline).not.toHaveBeenCalled();
    });

    it('should return empty array if checkPipeline returns null', async () => {
      redisService.smembers.mockResolvedValue(['board-1']);
      const checkPipeline = makeCheckPipeline(null as any);
      redisService.pipeline.mockReturnValueOnce(checkPipeline);

      const result = await service.cleanupStaleEntries();
      expect(result).toEqual([]);
    });

    it('should return empty array if no active boards contain stale sockets', async () => {
      redisService.smembers.mockResolvedValue(['board-1', 'board-2']);
      const checkPipeline = makeCheckPipeline([
        [null, []],
        [null, []],
      ]);
      redisService.pipeline.mockReturnValueOnce(checkPipeline);

      const result = await service.cleanupStaleEntries();
      expect(result).toEqual([]);
      expect(redisService.pipeline).toHaveBeenCalledTimes(1); // Only checkPipeline was called
    });

    it('should return empty array if prunePipeline returns null', async () => {
      redisService.smembers.mockResolvedValue(['board-1']);
      const checkPipeline = makeCheckPipeline([[null, ['stale-sock']]]);
      const prunePipeline = makePrunePipeline(null as any);

      redisService.pipeline
        .mockReturnValueOnce(checkPipeline)
        .mockReturnValueOnce(prunePipeline);

      const result = await service.cleanupStaleEntries();
      expect(result).toEqual([]);
    });

    it('should prune stale entries across active boards using two batched pipelines', async () => {
      redisService.smembers.mockResolvedValue(['board-1', 'board-2']);

      const staleEntry: PresenceEntry = {
        userId: 'stale-user',
        socketId: 'stale-sock',
        displayName: 'Stale User',
        avatarUrl: null,
        color: '#E11D48',
        connectedAt: '2026-08-18T08:00:00.000Z',
      };

      const checkPipeline = makeCheckPipeline([
        [null, ['stale-sock']], // board-1 has 1 stale socket
        [null, []],             // board-2 is clean
      ]);
      const prunePipeline = makePrunePipeline([
        [null, [JSON.stringify(staleEntry)]], // hmget  (offset 0)
        [null, 1],                            // zrem   (offset 1)
        [null, 1],                            // hdel   (offset 2)
        [null, 0],                            // zcard  (offset 3) → board empty
      ]);

      redisService.pipeline
        .mockReturnValueOnce(checkPipeline)
        .mockReturnValueOnce(prunePipeline);

      const pruned = await service.cleanupStaleEntries();

      expect(redisService.smembers).toHaveBeenCalledWith('presence:active_boards');
      expect(pruned).toHaveLength(1);
      expect(pruned[0]).toEqual(['board-1', staleEntry]);
      expect(redisService.srem).toHaveBeenCalledWith('presence:active_boards', 'board-1');
    });

    it('should ignore malformed JSON and not remove board if active viewers remain', async () => {
      redisService.smembers.mockResolvedValue(['board-1']);

      const checkPipeline = makeCheckPipeline([[null, ['stale-sock']]]);
      const prunePipeline = makePrunePipeline([
        [null, ['INVALID_MALFORMED_JSON']], // hmget
        [null, 1],                          // zrem
        [null, 1],                          // hdel
        [null, 2],                          // zcard = 2 remaining viewers
      ]);

      redisService.pipeline
        .mockReturnValueOnce(checkPipeline)
        .mockReturnValueOnce(prunePipeline);

      const pruned = await service.cleanupStaleEntries();

      expect(pruned).toHaveLength(0);
      expect(redisService.srem).not.toHaveBeenCalled();
    });
  });
});
