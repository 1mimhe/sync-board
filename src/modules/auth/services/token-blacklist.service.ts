import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';

/**
 * Service managing Redis-backed JWT token revocation blacklist.
 * Entries auto-expire when the token's original validity window closes.
 */
@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Add a JWT ID (jti) to the Redis blacklist until its expiration date.
   */
  async blacklist(jti: string, expiresAt: Date): Promise<void> {
    const ttl = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
    if (ttl > 0) {
      await this.redis.set(`blacklist:${jti}`, '1', 'EX', ttl);
      this.logger.debug(`Token blacklisted: ${jti}, TTL: ${ttl}s`);
    }
  }

  /**
   * Check if a JWT ID (jti) is present in the Redis blacklist.
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    const result = await this.redis.exists(`blacklist:${jti}`);
    return result === 1;
  }
}
