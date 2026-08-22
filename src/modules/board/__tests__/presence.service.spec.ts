import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PresenceService } from '../services/presence.service';
import { RedisService } from '../../../common/redis/redis.service';
import { COLLABORATOR_COLORS } from '../board.constants';
import type { PresenceEntry } from '../../../common/interfaces/ws.interface';

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
  });

  describe('removeUserPresence', () => {
    it('should remove ALL sockets for a given userId from active ZSET and meta HASH in a single pipeline', async () => {
      const entry1: PresenceEntry = {
        userId: 'user-1',
        socketId: 'sock-tab-1',
        displayName: 'Alice',
        avatarUrl: null,
        color: '#E74C3C',
        connectedAt: '2026-08-18T10:00:00.000Z',
      };
      const entry2: PresenceEntry = {
        userId: 'user-1',
        socketId: 'sock-tab-2',
        displayName: 'Alice',
        avatarUrl: null,
        color: '#E74C3C',
        connectedAt: '2026-08-18T10:01:00.000Z',
      };
      const otherUserEntry: PresenceEntry = {
        userId: 'user-2',
        socketId: 'sock-bob',
        displayName: 'Bob',
        avatarUrl: null,
        color: '#3498DB',
        connectedAt: '2026-08-18T10:02:00.000Z',
      };

      redisService.hgetall.mockResolvedValue({
        'sock-tab-1': JSON.stringify(entry1),
        'sock-tab-2': JSON.stringify(entry2),
        'sock-bob': JSON.stringify(otherUserEntry),
      });

      mockPipeline.exec.mockResolvedValue([
        [null, 2], // zrem
        [null, 2], // hdel
        [null, 1], // zcard (1 remaining)
      ]);

      const removed = await service.removeUserPresence('board-1', 'user-1');

      expect(removed).toHaveLength(2);
      expect(removed).toEqual([entry1, entry2]);
      expect(mockPipeline.zrem).toHaveBeenCalledWith(
        'presence:board:board-1:active',
        'sock-tab-1',
        'sock-tab-2',
      );
      expect(mockPipeline.hdel).toHaveBeenCalledWith(
        'presence:board:board-1:meta',
        'sock-tab-1',
        'sock-tab-2',
      );
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
  });

  describe('cleanupStaleEntries', () => {
    it('should iterate active_boards set only and prune stale entries via pipeline', async () => {
      redisService.smembers.mockResolvedValue(['board-1', 'board-2']);

      const staleEntry: PresenceEntry = {
        userId: 'stale-user',
        socketId: 'stale-sock',
        displayName: 'Stale User',
        avatarUrl: null,
        color: '#E74C3C',
        connectedAt: '2026-08-18T08:00:00.000Z',
      };

      redisService.zrangebyscore
        .mockResolvedValueOnce(['stale-sock']) // board-1 has stale socket
        .mockResolvedValueOnce([]); // board-2 has no stale socket

      redisService.hmget.mockResolvedValueOnce([JSON.stringify(staleEntry)]);

      mockPipeline.exec.mockResolvedValueOnce([
        [null, 1], // zrem
        [null, 1], // hdel
        [null, 0], // zcard = 0 remaining
      ]);

      const pruned = await service.cleanupStaleEntries();

      expect(redisService.smembers).toHaveBeenCalledWith('presence:active_boards');
      expect(pruned).toHaveLength(1);
      expect(pruned[0]).toEqual(['board-1', staleEntry]);
      expect(mockPipeline.zrem).toHaveBeenCalledWith('presence:board:board-1:active', 'stale-sock');
      expect(mockPipeline.hdel).toHaveBeenCalledWith('presence:board:board-1:meta', 'stale-sock');
      expect(redisService.srem).toHaveBeenCalledWith('presence:active_boards', 'board-1');
    });

    it('should handle empty active boards set gracefully', async () => {
      redisService.smembers.mockResolvedValue([]);

      const pruned = await service.cleanupStaleEntries();
      expect(pruned).toEqual([]);
    });
  });
});
