import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';
import { PRESENCE_CONFIG, COLLABORATOR_COLORS } from '../board.constants';
import type {
  PresenceEntry,
  PresenceUser,
} from '../../../common/interfaces/ws.interface';

/**
 * Service managing real-time user presence per board using optimized Redis dual-key data structures:
 * - `presence:board:{boardId}:active` (ZSET: socketId -> lastHeartbeat timestamp)
 * - `presence:board:{boardId}:meta`   (HASH: socketId -> JSON PresenceEntry)
 * - `presence:active_boards`          (SET: boardId tracking boards with active viewers)
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Registers or updates a user's presence entry on a board using an atomic pipeline.
   *
   * @param boardId - Target board UUID
   * @param entry - User presence payload
   */
  async addPresence(boardId: string, entry: PresenceEntry): Promise<void> {
    const activeKey = this.getActiveKey(boardId);
    const metaKey = this.getMetaKey(boardId);
    const now = Date.now();
    const memberJson = JSON.stringify(entry);

    await this.redis
      .pipeline()
      .sadd(PRESENCE_CONFIG.ACTIVE_BOARDS_KEY, boardId)
      .zadd(activeKey, now, entry.socketId)
      .hset(metaKey, entry.socketId, memberJson)
      .exec();

    this.logger.debug(
      `User ${entry.userId} registered on board ${boardId} with socket ${entry.socketId}`,
    );
  }

  /**
   * Removes a specific socket's presence entry from a board in O(1) time.
   *
   * @param boardId - Board UUID
   * @param socketId - Socket.IO socket identifier
   * @returns Removed PresenceEntry or null if not found
   */
  async removePresence(
    boardId: string,
    socketId: string,
  ): Promise<PresenceEntry | null> {
    const activeKey = this.getActiveKey(boardId);
    const metaKey = this.getMetaKey(boardId);

    const pipeline = this.redis.pipeline();
    pipeline.hget(metaKey, socketId);
    pipeline.zrem(activeKey, socketId);
    pipeline.hdel(metaKey, socketId);
    pipeline.zcard(activeKey);

    const results = await pipeline.exec();
    if (!results) return null;

    const rawMeta = results[0]?.[1] as string | null;
    const remainingCount = results[3]?.[1] as number;

    if (remainingCount === 0) {
      await this.redis.srem(PRESENCE_CONFIG.ACTIVE_BOARDS_KEY, boardId);
    }

    if (!rawMeta) return null;

    try {
      const entry = JSON.parse(rawMeta) as PresenceEntry;
      this.logger.debug(
        `Removed socket ${socketId} (user ${entry.userId}) from board ${boardId}`,
      );
      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Removes ALL presence entries for a given user across a specific board.
   * Executes atomic removal across dual keys in a single pipeline.
   *
   * @param boardId - Board UUID
   * @param userId - User UUID
   * @returns Array of removed PresenceEntry objects
   */
  async removeUserPresence(
    boardId: string,
    userId: string,
  ): Promise<PresenceEntry[]> {
    const activeKey = this.getActiveKey(boardId);
    const metaKey = this.getMetaKey(boardId);

    const allMeta = await this.redis.hgetall(metaKey);
    if (!allMeta || Object.keys(allMeta).length === 0) {
      return [];
    }

    const removed: PresenceEntry[] = [];
    const socketsToRemove: string[] = [];

    for (const [socketId, rawEntry] of Object.entries(allMeta)) {
      try {
        const entry = JSON.parse(rawEntry) as PresenceEntry;
        if (entry.userId === userId) {
          removed.push(entry);
          socketsToRemove.push(socketId);
        }
      } catch {
        // Skip malformed entries
      }
    }

    if (socketsToRemove.length > 0) {
      const pipeline = this.redis.pipeline();
      pipeline.zrem(activeKey, ...socketsToRemove);
      pipeline.hdel(metaKey, ...socketsToRemove);
      pipeline.zcard(activeKey);

      const results = await pipeline.exec();
      const remainingCount = results?.[2]?.[1] as number;

      if (remainingCount === 0) {
        await this.redis.srem(PRESENCE_CONFIG.ACTIVE_BOARDS_KEY, boardId);
      }
    }

    return removed;
  }

  /**
   * Updates the heartbeat timestamp for an existing socket in O(log N) without JSON parsing.
   *
   * @param boardId - Board UUID
   * @param socketId - Socket ID
   */
  async updateHeartbeat(boardId: string, socketId: string): Promise<void> {
    const activeKey = this.getActiveKey(boardId);
    const now = Date.now();
    await this.redis.zadd(activeKey, now, socketId);
  }

  /**
   * Retrieves all active, non-stale viewers currently on a board.
   * Fetches active socket IDs via score filtering and batches metadata via HMGET.
   * Deduplicates by userId for users viewing across multiple browser tabs.
   *
   * @param boardId - Board UUID
   * @returns Array of unique presence users
   */
  async getBoardViewers(boardId: string): Promise<PresenceUser[]> {
    const activeKey = this.getActiveKey(boardId);
    const metaKey = this.getMetaKey(boardId);
    const staleThreshold = Date.now() - PRESENCE_CONFIG.STALE_THRESHOLD_MS;

    const activeSocketIds = await this.redis.zrangebyscore(
      activeKey,
      staleThreshold,
      '+inf',
    );

    if (!activeSocketIds || activeSocketIds.length === 0) {
      return [];
    }

    const rawEntries = await this.redis.hmget(metaKey, ...activeSocketIds);
    const viewers: PresenceUser[] = [];
    const seenUserIds = new Set<string>();

    for (const raw of rawEntries) {
      if (!raw) continue;
      try {
        const entry = JSON.parse(raw) as PresenceEntry;
        if (!seenUserIds.has(entry.userId)) {
          seenUserIds.add(entry.userId);
          viewers.push({
            userId: entry.userId,
            displayName: entry.displayName,
            avatarUrl: entry.avatarUrl,
            color: entry.color,
            connectedAt: entry.connectedAt,
          });
        }
      } catch {
        // Skip malformed entries
      }
    }

    return viewers;
  }

  /**
   * Generates a deterministic collaborator color for a user on a given board using FNV-1a hashing.
   * Avoids collisions with colors already taken by active viewers.
   *
   * @param userId - User UUID
   * @param boardId - Board UUID
   * @returns Hex color string
   */
  async getCollaboratorColor(userId: string, boardId: string): Promise<string> {
    const currentViewers = await this.getBoardViewers(boardId);
    const takenColors = new Set(currentViewers.map((v) => v.color));

    const hash = this.hashUserId(userId);
    let colorIdx = hash % COLLABORATOR_COLORS.length;

    let attempts = 0;
    while (
      takenColors.has(COLLABORATOR_COLORS[colorIdx]) &&
      attempts < COLLABORATOR_COLORS.length
    ) {
      colorIdx = (colorIdx + 1) % COLLABORATOR_COLORS.length;
      attempts++;
    }

    return COLLABORATOR_COLORS[colorIdx];
  }

  /**
   * Scans and prunes presence entries that missed heartbeats.
   * Scans ONLY active boards tracked in Redis set rather than the entire keyspace.
   *
   * @returns List of [boardId, expiredEntry] tuples for broadcasting disconnect events
   */
  async cleanupStaleEntries(): Promise<Array<[string, PresenceEntry]>> {
    const results: Array<[string, PresenceEntry]> = [];

    try {
      const activeBoardIds = await this.redis.smembers(
        PRESENCE_CONFIG.ACTIVE_BOARDS_KEY,
      );
      const staleThreshold = Date.now() - PRESENCE_CONFIG.STALE_THRESHOLD_MS;

      for (const boardId of activeBoardIds) {
        const activeKey = this.getActiveKey(boardId);
        const metaKey = this.getMetaKey(boardId);

        const staleSocketIds = await this.redis.zrangebyscore(
          activeKey,
          0,
          staleThreshold,
        );

        if (staleSocketIds.length > 0) {
          const staleMetas = await this.redis.hmget(metaKey, ...staleSocketIds);

          const pipeline = this.redis.pipeline();
          pipeline.zrem(activeKey, ...staleSocketIds);
          pipeline.hdel(metaKey, ...staleSocketIds);
          pipeline.zcard(activeKey);

          const pipelineResults = await pipeline.exec();
          const remainingCount = pipelineResults?.[2]?.[1] as number;

          if (remainingCount === 0) {
            await this.redis.srem(PRESENCE_CONFIG.ACTIVE_BOARDS_KEY, boardId);
          }

          for (const rawMeta of staleMetas) {
            if (!rawMeta) continue;
            try {
              const entry = JSON.parse(rawMeta) as PresenceEntry;
              results.push([boardId, entry]);
              this.logger.debug(
                `Pruned stale presence: user ${entry.userId} on board ${boardId}`,
              );
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error executing presence cleanup', (error as Error).stack);
    }

    return results;
  }

  /**
   * 32-bit FNV-1a hash algorithm for uniform distribution of UUID strings.
   */
  private hashUserId(userId: string): number {
    let hash = 2166136261;
    for (let i = 0; i < userId.length; i++) {
      hash ^= userId.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
  }

  private getActiveKey(boardId: string): string {
    return `${PRESENCE_CONFIG.REDIS_KEY_PREFIX}${boardId}:active`;
  }

  private getMetaKey(boardId: string): string {
    return `${PRESENCE_CONFIG.REDIS_KEY_PREFIX}${boardId}:meta`;
  }
}
