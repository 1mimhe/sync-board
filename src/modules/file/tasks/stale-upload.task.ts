import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FileRepository } from '../repositories/file.repository';
import {
  STALE_UPLOAD_CRON,
  STALE_UPLOAD_TTL_HOURS,
} from '../constants/file.constants';

/**
 * Hourly cleanup marking pending uploads older than 24h as failed.
 */
@Injectable()
export class StaleUploadTask {
  private readonly logger = new Logger(StaleUploadTask.name);

  constructor(private readonly fileRepo: FileRepository) {}

  /**
   * Marks stale pending uploads as failed.
   *
   * @returns Promise resolving when the sweep completes
   */
  @Cron(STALE_UPLOAD_CRON)
  async markStaleUploadsFailed(): Promise<void> {
    const cutoff = new Date(
      Date.now() - STALE_UPLOAD_TTL_HOURS * 60 * 60 * 1000,
    );
    const count = await this.fileRepo.markStalePendingAsFailed(cutoff);
    this.logger.log(`Marked ${count} stale pending uploads as failed`);
  }
}
