import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { QUEUES, QUEUE_LIMITS } from '../rabbitmq.constants';

/**
 * Dead Letter Queue (DLQ) backlog monitor (log-only, non-destructive inspection).
 */
@Injectable()
export class DlqMonitorTask {
  private readonly logger = new Logger(DlqMonitorTask.name);

  constructor(
    @Optional() private readonly amqp: AmqpConnection,
    private readonly config: ConfigService,
  ) {}

  /** Periodically inspects dlx.queue backlog and logs threshold warnings. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkDlq(): Promise<void> {
    if (
      !this.config.get<boolean>('RABBITMQ_ENABLE', true) ||
      !this.amqp?.managedChannel
    ) {
      return;
    }
    try {
      const q = await this.amqp.managedChannel.checkQueue(QUEUES.DLX);
      if (q.messageCount > QUEUE_LIMITS.DLX_BACKLOG_ERROR_THRESHOLD) {
        this.logger.error(`DLQ backlog: ${q.messageCount} messages`);
      } else if (q.messageCount > QUEUE_LIMITS.DLX_BACKLOG_WARN_THRESHOLD) {
        this.logger.warn(`DLQ growing: ${q.messageCount} messages`);
      }
    } catch (error) {
      this.logger.error('DLQ check failed', (error as Error).stack);
    }
  }
}
