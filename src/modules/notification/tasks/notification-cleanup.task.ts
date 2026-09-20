import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationRepository } from '../repositories/notification.repository';

/** Monthly purge of old read notifications (uses partial cleanup index). */
@Injectable()
export class NotificationCleanupTask {
  private readonly logger = new Logger(NotificationCleanupTask.name);

  constructor(private readonly notificationRepo: NotificationRepository) {}

  @Cron('0 3 1 * *', { timeZone: 'UTC' })
  async purgeOldRead(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const deleted = await this.notificationRepo.deleteReadOlderThan(cutoff);
      if (deleted > 0)
        this.logger.log(`Purged ${deleted} old read notifications`);
    } catch (error) {
      this.logger.error('Notification cleanup failed', (error as Error).stack);
    }
  }
}
