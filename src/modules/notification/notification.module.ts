import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CardSubModule } from '../board/card/card.module';
import { BoardSubModule } from '../board/core/board.module';
import { PrismaModule } from '../../common/database/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationProducerListener } from './listeners/notification-producer.listener';
import { NotificationConsumerListener } from './listeners/notification-consumer.listener';
import { NotificationPushGateway } from './notification-push.gateway';
import { NotificationCleanupTask } from './tasks/notification-cleanup.task';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    WorkspaceModule,
    CardSubModule,
    BoardSubModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationRepository,
    NotificationProducerListener,
    NotificationConsumerListener,
    NotificationPushGateway,
    NotificationCleanupTask,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
