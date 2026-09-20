import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActivityRepository } from '../repositories/activity.repository';

/**
 * Scheduled maintenance task ensuring future monthly partitions exist for the
 * `activity_events` partitioned table. Runs daily at 04:00 UTC to avoid lock contention
 * with the notification cleanup task running at 03:00 UTC.
 */
@Injectable()
export class ActivityPartitionTask {
  private readonly logger = new Logger(ActivityPartitionTask.name);

  constructor(private readonly activityRepo: ActivityRepository) {}

  @Cron('0 4 * * *', {
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async ensurePartitions(): Promise<void> {
    try {
      await this.activityRepo.ensurePartitions();
    } catch (error) {
      this.logger.error(
        'Failed to ensure activity partitions',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
