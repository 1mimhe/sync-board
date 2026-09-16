import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { RabbitPublisherService } from './publisher.service';
import { DlqMonitorTask } from './tasks/dlq-monitor.task';
import {
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,
  QUEUE_LIMITS,
  QUEUE_OVERFLOW,
  RABBITMQ_DEFAULTS,
} from './rabbitmq.constants';

/**
 * Declares all messaging exchanges, queues, and bindings up-front (idempotent asserts).
 * Exposes RabbitMQModule and RabbitPublisherService globally.
 */
@Global()
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri:
          config.get<string>('RABBITMQ_URL') ?? RABBITMQ_DEFAULTS.DEFAULT_URI,
        exchanges: [
          { name: EXCHANGES.NOTIFICATION, type: 'topic' },
          { name: EXCHANGES.ACTIVITY, type: 'direct' },
          { name: EXCHANGES.EMAIL, type: 'direct' },
          { name: EXCHANGES.DLX, type: 'fanout' },
        ],
        queues: [
          {
            name: QUEUES.DLX,
            exchange: EXCHANGES.DLX,
            options: {
              durable: true,
              arguments: { 'x-max-length': QUEUE_LIMITS.DLX_MAX_LENGTH },
            },
          },
          {
            name: QUEUES.NOTIFICATION,
            exchange: EXCHANGES.NOTIFICATION,
            routingKey: ROUTING_KEYS.NOTIFICATION_ALL,
            options: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': EXCHANGES.DLX,
                'x-max-length': QUEUE_LIMITS.NOTIFICATION_MAX_LENGTH,
                'x-overflow': QUEUE_OVERFLOW.REJECT_PUBLISH,
              },
            },
          },
          {
            name: QUEUES.ACTIVITY,
            exchange: EXCHANGES.ACTIVITY,
            routingKey: ROUTING_KEYS.ACTIVITY_RECORD,
            options: {
              durable: true,
              arguments: { 'x-dead-letter-exchange': EXCHANGES.DLX },
            },
          },
          {
            name: QUEUES.EMAIL,
            exchange: EXCHANGES.EMAIL,
            routingKey: ROUTING_KEYS.EMAIL_SEND,
            options: {
              durable: true,
              arguments: { 'x-dead-letter-exchange': EXCHANGES.DLX },
            },
          },
        ],
        connectionInitOptions: { wait: false },
        enableDirectReplyTo: false,
        registerHandlers: true,
      }),
    }),
  ],
  providers: [RabbitPublisherService, DlqMonitorTask],
  exports: [RabbitMQModule, RabbitPublisherService],
})
export class AppRabbitMQModule {}
