import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from './redis.service';
import { Server, ServerOptions } from 'socket.io';

/**
 * Custom Socket.IO adapter backed by Redis Pub/Sub using ioredis.
 * Enables horizontal scaling across multiple NestJS backend instances.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | undefined;

  constructor(private readonly appContext: INestApplicationContext) {
    super(appContext);
  }

  /**
   * Initializes dedicated Redis pub/sub clients and sets up the adapter constructor.
   * Must be called before the application starts listening.
   */
  async connectToRedis(): Promise<void> {
    const redisService = this.appContext.get(RedisService);

    // Create separate, dedicated TCP connections for pub and sub
    const pubClient = redisService.duplicate();
    const subClient = redisService.duplicate();

    pubClient.on('error', (err: Error) =>
      this.logger.error(
        `Socket.IO Redis Adapter Pub Error: ${err.message}`,
        err.stack,
      ),
    );
    subClient.on('error', (err: Error) =>
      this.logger.error(
        `Socket.IO Redis Adapter Sub Error: ${err.message}`,
        err.stack,
      ),
    );

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log(
      'Socket.IO Redis adapter connected using unified RedisService configuration',
    );
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: true,
        credentials: true,
      },
    }) as Server;

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
