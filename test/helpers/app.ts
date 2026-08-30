import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { CorrelationIdInterceptor } from '../../src/common/interceptors/correlation-id.interceptor';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { RedisIoAdapter } from '../../src/common/redis/redis-io.adapter';
import { PrismaService } from '../../src/common/database/prisma.service';
import { RedisService } from '../../src/common/redis/redis.service';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Bootstraps the real AppModule in-process, wiring the exact same globals as
 * `src/main.ts` (API prefix, cookies, validation, filters, interceptors, the
 * Redis-backed Socket.IO adapter) so HTTP + WS specs exercise production wiring.
 *
 * The global IP ThrottlerGuard is disabled by default (functional specs make
 * dozens of requests from the same supertest IP); pass `{ throttler: true }`
 * to keep it for dedicated rate-limit specs.
 */
export interface TestApp {
  app: INestApplication;
  module: TestingModule;
  prisma: PrismaService;
  redis: RedisService;
  /** Base URL including the listening port, e.g. http://127.0.0.1:54321 */
  url: string;
  port: number;
  close(): Promise<void>;
}

export async function createTestApp(
  options: { throttler?: boolean } = {},
): Promise<TestApp> {
  const builder = Test.createTestingModule({ imports: [AppModule] });

  if (!options.throttler) {
    builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true });
  }

  const module = await builder.compile();
  const app = module.createNestApplication({ logger: false });

  // Mirror src/main.ts global wiring
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new ResponseInterceptor(),
  );

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.enableShutdownHooks();
  await app.init();
  await app.listen(0);

  const port = (app.getHttpServer().address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}`;

  return {
    app,
    module,
    prisma: app.get(PrismaService),
    redis: app.get(RedisService),
    url,
    port,
    close: async () => {
      await app.close();
    },
  };
}
