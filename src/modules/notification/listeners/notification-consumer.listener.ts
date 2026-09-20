import { Injectable, Logger } from '@nestjs/common';
import { Nack, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { isUUID } from 'class-validator';
import type { EntityType, Notification } from '@prisma/client';
import {
  RabbitPublisherService,
  retryCountFrom,
} from '../../../common/rabbitmq/publisher.service';
import {
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,
} from '../../../common/rabbitmq/rabbitmq.constants';
import type { DomainMessage } from '../../../common/rabbitmq/interfaces/domain-message.interface';
import { consumeOnce } from '../../../common/rabbitmq/idempotency.util';
import { RedisService } from '../../../common/redis/redis.service';
import type { NotificationMessagePayload } from '../notification.messages';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationPushGateway } from '../notification-push.gateway';
import { UNREAD_COUNT_TTL_SECONDS } from '../notification.constants';
import { unreadCountKey } from '../utils/notification-cache.util';

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

function isValidPayload(
  payload: NotificationMessagePayload | undefined,
): payload is NotificationMessagePayload {
  return (
    !!payload &&
    isUUID(payload.userId ?? '', '4') &&
    isUUID(payload.workspaceId ?? '', '4') &&
    typeof payload.type === 'string' &&
    payload.type.length > 0 &&
    typeof payload.title === 'string' &&
    payload.title.length > 0
  );
}

/**
 * Persists notification messages exactly-once (DB unique gate) and pushes
 * to the recipient's private WebSocket room.
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

  @RabbitSubscribe({
    exchange: EXCHANGES.NOTIFICATION,
    routingKey: ROUTING_KEYS.NOTIFICATION_ALL,
    queue: QUEUES.NOTIFICATION,
  })
  async handle(
    msg: DomainMessage<NotificationMessagePayload>,
    _ctx?: unknown,
    _channel?: unknown,
    raw?: { headers?: Record<string, unknown>; routingKey?: string },
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

    let stored: Notification | null = null;
    try {
      stored = await this.notificationRepo.createOnce({
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
      try {
        await this.redis.del(`msg:processed:${msg.messageId}`);
      } catch (delError) {
        this.logger.warn('Failed to release idempotency key on retry', {
          messageId: msg.messageId,
          error: (delError as Error).message,
        });
      }
      const retryCount = retryCountFrom(raw?.headers);
      if (retryCount < MAX_RETRIES) {
        const delayMs = RETRY_BASE_MS * 2 ** retryCount;
        await this.publisher.publishRetry(
          EXCHANGES.NOTIFICATION,
          raw?.routingKey ?? ROUTING_KEYS.NOTIFICATION_ALL,
          msg,
          delayMs,
          retryCount + 1,
        );
        return;
      }
      this.logger.error(
        `Notification ${msg.messageId} exhausted retries, dead-lettering`,
        (error as Error).stack,
      );
      return new Nack(false);
    }
    if (!stored) return;
    try {
      const key = unreadCountKey(msg.payload.userId);
      await this.redis.incr(key);
      await this.redis.expire(key, UNREAD_COUNT_TTL_SECONDS);
    } catch (error) {
      this.logger.warn('Unread-counter increment failed', {
        error: (error as Error).message,
      });
    }
    try {
      this.pushGateway.emitToUser(msg.payload.userId, stored);
    } catch (error) {
      this.logger.warn('Notification push failed', {
        error: (error as Error).message,
      });
    }
  }
}
