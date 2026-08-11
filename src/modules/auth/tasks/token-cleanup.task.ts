import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';

/**
 * Scheduled cron task for purging expired and revoked refresh tokens from database.
 */
@Injectable()
export class TokenCleanupTask {
  private readonly logger = new Logger(TokenCleanupTask.name);

  constructor(private readonly tokenRepository: RefreshTokenRepository) {}

  /**
   * Runs daily at 3:00 AM UTC to delete tokens expired or revoked more than 30 days ago.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleTokenCleanup(): Promise<void> {
    this.logger.log('Starting scheduled refresh token cleanup task...');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const count = await this.tokenRepository.deleteExpiredTokens(thirtyDaysAgo);
    this.logger.log(
      `Scheduled refresh token cleanup completed: ${count} expired/revoked tokens purged.`,
    );
  }
}
