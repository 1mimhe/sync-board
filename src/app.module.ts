import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppConfigModule } from './common/config/config.module';
import { PrismaModule } from './common/database/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { BoardModule } from './modules/board/board.module';
import { DocumentModule } from './modules/document/document.module';
import { ActivityModule } from './modules/activity/activity.module';
import { NotificationModule } from './modules/notification/notification.module';
import { FileModule } from './modules/file/file.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Global Core & Infrastructure Modules
    AppConfigModule,
    PrismaModule,
    RedisModule,
    EventEmitterModule.forRoot(),

    // Scheduled background jobs (refresh token cleanup, etc.)
    ScheduleModule.forRoot(),

    // Global rate limiting: 100 requests per minute per IP by default.
    // Endpoint-specific limits are applied via @Throttle() decorators.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Centralized Structured Logging (Pino)
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          transport:
            config.get<string>('NODE_ENV') === 'development'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
          genReqId: (req) =>
            (req.headers['x-request-id'] as string) || `req_${randomUUID()}`,
          customProps: () => ({
            service: 'syncboard',
          }),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.refreshToken',
              'res.headers["set-cookie"]',
            ],
            censor: '[REDACTED]',
          },
          serializers: {
            req: (req: Record<string, unknown>) => ({
              id: req['id'],
              method: req['method'],
              url: req['url'],
              query: req['query'],
              remoteAddress: req['remoteAddress'],
            }),
            res: (res: Record<string, unknown>) => ({
              statusCode: res['statusCode'],
            }),
          },
          autoLogging: {
            ignore: (req) => req.url?.includes('/health') ?? false,
          },
        },
      }),
    }),

    // Feature Modules
    AuthModule,
    WorkspaceModule,
    BoardModule,
    DocumentModule,
    ActivityModule,
    NotificationModule,
    FileModule,

    // System Health Checks
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
