import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Service extending ioredis for Redis in-memory cache and PubSub operations.
 * Handles lifecycle events, connection retries, and cleanup on module destruction.
 */
@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(config: ConfigService) {
    const host = config.get<string>('REDIS_HOST', 'localhost');
    const port = config.get<number>('REDIS_PORT', 6379);
    const password = config.get<string>('REDIS_PASSWORD');

    super({
      host,
      port,
      ...(password ? { password } : {}),
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        this.logger.warn(
          `Retrying Redis connection (attempt ${times}) in ${delay}ms...`,
        );
        return delay;
      },
    });

    this.on('connect', () =>
      this.logger.log(`Redis connecting to ${host}:${port}...`),
    );
    this.on('ready', () =>
      this.logger.log(`Redis connected and ready at ${host}:${port}`),
    );
    this.on('error', (err: Error) =>
      this.logger.error(`Redis connection error: ${err.message}`),
    );
    this.on('close', () => this.logger.warn('Redis connection closed'));
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
