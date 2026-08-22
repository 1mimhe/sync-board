import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';
import { WsRateLimitCategory } from '../board.constants';

/**
 * Sliding-window rate limiter for WebSocket events using Redis sorted sets.
 */
@Injectable()
export class WsRateLimiterService {
  private readonly logger = new Logger(WsRateLimiterService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Evaluates if a given user action exceeds rate limits in a sliding window.
   *
   * @param userId - User UUID
   * @param eventCategory - Category name ('join', 'cursor', 'board', etc.)
   * @param limit - Maximum operations permitted in window
   * @param windowMs - Sliding window duration in milliseconds
   * @returns true if allowed, false if rate limit exceeded
   */
  async checkRateLimit(
    userId: string,
    eventCategory: WsRateLimitCategory,
    limit: number,
    windowMs: number,
  ): Promise<boolean> {
    const key = `ratelimit:ws:${userId}:${eventCategory}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const pipeline = this.redis.pipeline();
    // Prune records older than window start
    pipeline.zremrangebyscore(key, 0, windowStart);
    // Add current event execution timestamp with a unique suffix
    const suffix = Math.random().toString(36).substring(2, 9);
    pipeline.zadd(key, now, `${now}-${suffix}`);
    // Count active events in window
    pipeline.zcard(key);
    // Set auto-expiration TTL on key matching window duration in seconds
    pipeline.expire(key, Math.max(Math.ceil(windowMs / 1000), 1));

    const results = await pipeline.exec();

    if (!results) {
      return true; // Fail-open on pipeline error
    }

    const count = results[2]?.[1] as number;

    if (typeof count === 'number' && count > limit) {
      this.logger.warn(
        `WebSocket rate limit breached: user=${userId}, category=${eventCategory}, count=${count}/${limit}`,
      );
      return false;
    }

    return true;
  }
}
