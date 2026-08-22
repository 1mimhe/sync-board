import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { RedisIoAdapter } from './common/redis/redis-io.adapter';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  // Initialize Nest application with buffered logs until Logger is attached
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino Logger as the primary NestJS logger
  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const PORT = configService.get<number>('PORT', 3000);

  // Set global API route prefix
  app.setGlobalPrefix('api');

  // Register cookie parser middleware
  app.use(cookieParser());

  // Attach distributed Socket.IO Redis adapter
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Configure OpenAPI / Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SyncBoard API')
    .setDescription('Real-time collaborative task & document platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Security headers & CORS settings
  app.use(helmet());
  const clientUrl = configService.get<string>(
    'CLIENT_URL',
    'http://localhost:3001',
  );
  const allowedOrigins = clientUrl.includes(',')
    ? clientUrl.split(',').map((url) => url.trim())
    : [clientUrl];

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Workspace-Id',
    ],
    credentials: true,
    maxAge: 86400,
  });

  // Global DTO validation pipe with type auto-transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter & standard response interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new ResponseInterceptor(),
  );

  // Enable graceful shutdown hooks (cleans up Prisma, Redis, HTTP connections on SIGTERM/SIGINT)
  app.enableShutdownHooks();

  await app.listen(PORT);
  logger.log(`Application is running on: http://localhost:${PORT}/api/`);
}

bootstrap().catch((error) => {
  console.error('Fatal error during application startup:', error);
  process.exit(1);
});
