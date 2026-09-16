import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

/**
 * Terminus health indicator for the RabbitMQ broker.
 * Returns `up` with `{ enabled: false }` when RABBITMQ_ENABLE=false so the
 * /health endpoint stays green with no broker (fail-open async foundation).
 */
@Injectable()
export class RabbitMQHealthIndicator {
  private readonly logger = new Logger(RabbitMQHealthIndicator.name);

  constructor(
    @Optional() private readonly amqp: AmqpConnection | null,
    private readonly config: ConfigService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    if (
      !this.config.get<boolean>('RABBITMQ_ENABLE', true) ||
      !this.amqp ||
      !this.amqp.managedChannel
    ) {
      return indicator.up({ enabled: false });
    }

    try {
      await this.amqp.managedChannel.checkQueue('dlx.queue');
      return indicator.up({ enabled: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'RabbitMQ check failed';
      this.logger.error(`RabbitMQ health check failed: ${message}`);
      return indicator.down(message);
    }
  }
}
