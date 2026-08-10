import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { AppConfigModule } from './common/config/config.module';
import { PrismaModule } from './common/database/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
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
  ],
})
export class AppModule {}
