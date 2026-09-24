import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Nack, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { MailerService } from '@nestjs-modules/mailer';
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
import type { EmailSendPayload } from '../interfaces/mail.interfaces';
import {
  EMAIL_IDEMPOTENCY_TTL_SECONDS,
  EMAIL_MAX_RETRIES,
  EMAIL_RETRY_BASE_MS,
} from '../constants/mail.constants';
import { isValidEmailPayload as isValidPayload } from '../utils/mail-payload.util';

/**
 * Consumes queued transactional email exactly-once and sends via SMTP.
 * Retries transient failures with backoff; dead-letters after exhaustion.
 */
@Injectable()
export class EmailConsumer {
  private readonly logger = new Logger(EmailConsumer.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @Optional() private readonly publisher?: RabbitPublisherService,
  ) {}

  /**
   * Whether the RabbitMQ pipeline is enabled.
   *
   * @returns False when disabled via RABBITMQ_ENABLE (tests, degraded mode)
   */
  private isEnabled(): boolean {
    return this.config.get<boolean>('RABBITMQ_ENABLE', true) !== false;
  }

  /**
   * Consumes one email message: validate → deduplicate → send
   * (or schedule retry).
   *
   * @param msg - Domain message wrapping the email payload
   * @param _ctx - Subscriber context (unused)
   * @param _channel - AMQP channel (unused)
   * @param raw - Raw headers and routing key for retry accounting
   * @returns Nack without requeue once retries are exhausted, void otherwise
   */
  @RabbitSubscribe({
    exchange: EXCHANGES.EMAIL,
    routingKey: ROUTING_KEYS.EMAIL_SEND,
    queue: QUEUES.EMAIL,
    // Queues are asserted once at boot from rabbitmq.module.ts topology.
    // Re-declaring here without arguments would 406-conflict with the
    // configured durable/DLX queue, so only check + bind.
    createQueueIfNotExists: false,
  })
  async handle(
    msg: DomainMessage<EmailSendPayload>,
    _ctx?: unknown,
    _channel?: unknown,
    raw?: ConsumeContext,
  ): Promise<void | Nack> {
    if (!this.isEnabled()) {
      return;
    }
    if (
      !msg ||
      typeof msg.messageId !== 'string' ||
      !isValidPayload(msg.payload)
    ) {
      this.logger.error(
        'Dropping poison email message: missing required fields',
        {
          messageId: (msg as DomainMessage<unknown> | undefined)?.messageId,
        },
      );
      return;
    }

    const isFirstDelivery = await consumeOnce(
      this.redis,
      msg.messageId,
      EMAIL_IDEMPOTENCY_TTL_SECONDS,
    );
    if (!isFirstDelivery) {
      this.logger.debug(`Skipping duplicate email message: ${msg.messageId}`);
      return;
    }

    try {
      await this.send(msg.payload);
    } catch (error) {
      await this.releaseIdempotencyKey(msg.messageId);
      const retryCount = retryCountFrom(raw?.headers);
      if (retryCount < EMAIL_MAX_RETRIES && this.publisher) {
        const delayMs = computeBackoff(retryCount, EMAIL_RETRY_BASE_MS);
        await this.publisher.publishRetry(
          EXCHANGES.EMAIL,
          raw?.routingKey ?? ROUTING_KEYS.EMAIL_SEND,
          msg,
          delayMs,
          retryCount + 1,
        );
        return;
      }
      this.logger.error(
        `Email ${msg.messageId} exhausted retries, dead-lettering`,
        (error as Error).stack,
      );
      return new Nack(false);
    }
  }

  /**
   * Sends one email via SMTP using the template call shapes shared with the
   * synchronous listener path.
   *
   * @param payload - Template, recipient, and context data
   * @returns Promise resolving when the send completes
   */
  private async send(payload: EmailSendPayload): Promise<void> {
    const data = payload.data;
    switch (payload.template) {
      case 'welcome-verify': {
        await this.mailerService.sendMail({
          to: payload.to,
          subject: payload.subject,
          template: 'welcome-verify',
          context: {
            displayName: (data['displayName'] as string) ?? '',
            verifyUrl: data['verifyUrl'] as string,
            expiresHours: 24,
          },
        });
        break;
      }
      case 'email-verified': {
        await this.mailerService.sendMail({
          to: payload.to,
          subject: payload.subject,
          template: 'email-verified',
          context: {
            displayName: (data['displayName'] as string) ?? '',
          },
        });
        break;
      }
      case 'password-reset': {
        await this.mailerService.sendMail({
          to: payload.to,
          subject: payload.subject,
          template: 'password-reset',
          context: {
            resetUrl: data['resetUrl'] as string,
            expiresMinutes: 60,
          },
        });
        break;
      }
      case 'invitation': {
        await this.mailerService.sendMail({
          to: payload.to,
          subject: payload.subject,
          template: 'invitation',
          context: {
            workspaceName: (data['workspaceName'] as string) ?? '',
            inviterName: (data['inviterName'] as string) ?? '',
            acceptUrl: data['acceptUrl'] as string,
          },
        });
        break;
      }
      default: {
        this.logger.error(
          `Dropping email with unknown template: ${payload.template}`,
        );
      }
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
}
