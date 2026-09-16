import { Injectable, Logger, Optional } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { randomUUID } from 'crypto';
import { DomainMessage } from './interfaces/domain-message.interface';

/** Confirm-mode publisher with envelope metadata + delayed-retry helper. */
@Injectable()
export class RabbitPublisherService {
  private readonly logger = new Logger(RabbitPublisherService.name);

  constructor(@Optional() private readonly amqp?: AmqpConnection) {}

  async publish<T>(
    exchange: string,
    routingKey: string,
    payload: T,
    correlationId?: string,
  ): Promise<void> {
    if (!this.amqp || this.amqp.connected === false) {
      this.logger.debug(
        `RabbitMQ not connected; dropping publish to ${exchange}/${routingKey}`,
      );
      return;
    }

    const message: DomainMessage<T> = {
      messageId: randomUUID(),
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId,
      payload,
    };
    try {
      await this.amqp.publish(exchange, routingKey, message, {
        persistent: true,
        messageId: message.messageId,
        headers: {
          version: 1,
          ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
        },
      });
    } catch (error) {
      // Broker down + wait:false: never break the request flow (fail-open).
      this.logger.error(
        `Publish failed ${exchange}/${routingKey}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Plugin-free retry delay: TTL wait queue dead-letters back to the original
   * exchange with the target routingKey. Scoped per exchange/routingKey/delay
   * to avoid argument conflicts and preserve routing topology.
   */
  async publishRetry<T>(
    exchange: string,
    routingKey: string,
    message: DomainMessage<T>,
    delayMs: number,
    retryCount: number,
  ): Promise<void> {
    if (
      !this.amqp ||
      this.amqp.connected === false ||
      !this.amqp.managedChannel
    ) {
      this.logger.warn(
        `RabbitMQ not connected; dropping retry #${retryCount} for ${message.messageId}`,
      );
      return;
    }

    const sanitizedKey = routingKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const waitQueue = `retry.wait.${exchange}.${sanitizedKey}.${delayMs}`;
    try {
      await this.amqp.managedChannel.assertQueue(waitQueue, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': exchange,
          'x-dead-letter-routing-key': routingKey,
          'x-message-ttl': delayMs,
        },
      });
      await this.amqp.managedChannel.sendToQueue(
        waitQueue,
        Buffer.from(JSON.stringify(message)),
        { persistent: true, headers: { 'x-retry-count': retryCount } },
      );
      this.logger.warn(
        `Message ${message.messageId} scheduled for retry #${retryCount} in ${delayMs}ms`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to schedule retry #${retryCount} for ${message.messageId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}

/** Reads the retry attempt from consumed message headers (default 0). */
export function retryCountFrom(
  headers: Record<string, unknown> | undefined,
): number {
  const raw = headers?.['x-retry-count'];
  return typeof raw === 'number' ? raw : 0;
}
