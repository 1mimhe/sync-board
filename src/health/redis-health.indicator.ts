import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicatorService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { RedisService } from '../common/redis/redis.service';

/**
 * Terminus health indicator performing a `PING` against Redis.
 */
@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    private readonly redis: RedisService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.redis.ping();
      return indicator.up();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Redis ping failed';
      this.logger.error(`Redis health check failed: ${message}`);
      return indicator.down(message);
    }
  }
}
