import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';
import { RabbitMQHealthIndicator } from './rabbitmq-health.indicator';

/**
 * Module exposing the `/health` endpoint (under the global `api` prefix).
 * Reports the status of the database, Redis, RabbitMQ, memory heap, and disk storage.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    PrismaHealthIndicator,
    RedisHealthIndicator,
    RabbitMQHealthIndicator,
  ],
})
export class HealthModule {}
