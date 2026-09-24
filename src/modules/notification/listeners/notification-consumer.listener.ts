import { Injectable, Logger } from '@nestjs/common';
import { Nack, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import type { EntityType, Notification } from '@prisma/client';
import { RabbitPublisherService } from '../../../common/rabbitmq/publisher.service';
import { retryCountFrom } from '../../../common/rabbitmq/idempotency.util';
import {
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,
} from '../../../common/rabbitmq/rabbitmq.constants';
import type { DomainMessage } from '../../../common/rabbitmq/interfaces/domain-message.interface';
import type { ConsumeContext } from '../../../common/rabbitmq/interfaces/consume-context.interface';
import { computeBackoff } from '../../../common/utils/retry.util';
import { consumeOnce } from '../../../common/rabbitmq/idempotency.util';
import { RedisService } from '../../../common/redis/redis.service';
import type { NotificationMessagePayload } from '../interfaces/notification-message.interface';
import { isValidNotificationPayload as isValidPayload } from '../utils/notification-payload.util';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPushGateway } from '../notification-push.gateway';
import {
  NOTIFICATION_MAX_RETRIES,
  NOTIFICATION_RETRY_BASE_MS,
  UNREAD_COUNT_TTL_SECONDS,
} from '../constants';
import { unreadCountKey } from '../utils/notification-cache.util';

/**
 * Persists notification messages exactly-once (DB unique gate) and pushes
 * to the recipient's private WebSocket room. Fail-open past persistence:
 * counter and push failures are logged and never requeue the message.
 */
@Injectable()
export class NotificationConsumerListener {
  private readonly logger = new Logger(NotificationConsumerListener.name);

  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly redis: RedisService,
    private readonly pushGateway: NotificationPushGateway,
    private readonly publisher: RabbitPublisherService,
  ) {}

  /**
   * Consumes one notification message: validate → deduplicate → persist
   * (or schedule retry) → bump unread counter → push to the user.
   *
   * @param msg - Domain message wrapping the notification payload
   * @param _ctx - Subscriber context (unused)
   * @param _channel - AMQP channel (unused)
   * @param raw - Raw headers and routing key for retry accounting
   * @returns Nack without requeue once retries are exhausted, void otherwise
   */
  @RabbitSubscribe({
    exchange: EXCHANGES.NOTIFICATION,
    routingKey: ROUTING_KEYS.NOTIFICATION_ALL,
    queue: QUEUES.NOTIFICATION,
    // Queues are asserted once at boot from rabbitmq.module.ts topology.
    // Re-declaring here without arguments would 406-conflict with the
    // configured durable/DLX/max-length queue, so only check + bind.
    createQueueIfNotExists: false,
  })
  async handle(
    msg: DomainMessage<NotificationMessagePayload>,
    _ctx?: unknown,
    _channel?: unknown,
    raw?: ConsumeContext,
  ): Promise<void | Nack> {
    if (
      !msg ||
      typeof msg.messageId !== 'string' ||
      !isValidPayload(msg.payload)
    ) {
      this.logger.error(
        'Dropping poison notification message: missing required fields',
        {
          messageId: (msg as DomainMessage<unknown> | undefined)?.messageId,
        },
      );
      return;
    }

    const isFirstDelivery = await consumeOnce(this.redis, msg.messageId);
    if (!isFirstDelivery) {
      this.logger.debug(
        `Skipping duplicate notification message: ${msg.messageId}`,
      );
      return;
    }

    const stored = await this.persistOrScheduleRetry(msg, raw);
    if (stored instanceof Nack) return stored;
    if (!stored) return;

    await this.bumpUnreadCounter(msg.payload.userId);
    this.pushToUser(msg.payload.userId, stored);
  }

  /**
   * Persists the message, or schedules a delayed retry on transient failure.
   *
   * @param msg - Domain message wrapping the notification payload
   * @param raw - Raw headers and routing key for retry accounting
   * @returns Stored row, null when already persisted or a retry was scheduled,
   *   Nack without requeue once retries are exhausted
   */
  private async persistOrScheduleRetry(
    msg: DomainMessage<NotificationMessagePayload>,
    raw: ConsumeContext | undefined,
  ): Promise<Notification | null | Nack> {
    try {
      return await this.notificationRepo.createOnce({
        messageId: msg.messageId,
        userId: msg.payload.userId,
        workspaceId: msg.payload.workspaceId,
        type: msg.payload.type,
        title: msg.payload.title,
        body: msg.payload.actorName
          ? `${msg.payload.actorName}: ${msg.payload.body ?? ''}`.slice(0, 2000)
          : (msg.payload.body ?? null),
        entityType: (msg.payload.entityType as EntityType | undefined) ?? null,
        entityId: msg.payload.entityId ?? null,
        boardId: msg.payload.boardId ?? null,
        cardId: msg.payload.cardId ?? null,
      });
    } catch (error) {
      await this.releaseIdempotencyKey(msg.messageId);
      const retryCount = retryCountFrom(raw?.headers);
      if (retryCount < NOTIFICATION_MAX_RETRIES) {
        const delayMs = computeBackoff(retryCount, NOTIFICATION_RETRY_BASE_MS);
        await this.publisher.publishRetry(
          EXCHANGES.NOTIFICATION,
          raw?.routingKey ?? ROUTING_KEYS.NOTIFICATION_ALL,
          msg,
          delayMs,
          retryCount + 1,
        );
        return null;
      }
      this.logger.error(
        `Notification ${msg.messageId} exhausted retries, dead-lettering`,
        (error as Error).stack,
      );
      return new Nack(false);
    }
  }

  /**
   * Releases the Redis idempotency key so a scheduled retry can proceed.
   *
   * @param messageId - Consumed message UUID
   * @returns Promise resolving when the release attempt completes
   */
  private async releaseIdempotencyKey(messageId: string): Promise<void> {
    try {
      await this.redis.del(`msg:processed:${messageId}`);
    } catch (delError) {
      this.logger.warn('Failed to release idempotency key on retry', {
        messageId,
        error: (delError as Error).message,
      });
    }
  }

  /**
   * Increments the cached unread counter (best-effort).
   *
   * @param userId - Recipient user UUID
   * @returns Promise resolving when the increment attempt completes
   */
  private async bumpUnreadCounter(userId: string): Promise<void> {
    try {
      const key = unreadCountKey(userId);
      await this.redis.incr(key);
      await this.redis.expire(key, UNREAD_COUNT_TTL_SECONDS);
    } catch (error) {
      this.logger.warn('Unread-counter increment failed', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Pushes the stored notification to the recipient's WebSocket room.
   *
   * @param userId - Recipient user UUID
   * @param notification - Persisted notification row
   */
  private pushToUser(userId: string, notification: Notification): void {
    try {
      this.pushGateway.emitToUser(userId, notification);
    } catch (error) {
      this.logger.warn('Notification push failed', {
        error: (error as Error).message,
      });
    }
  }
}
