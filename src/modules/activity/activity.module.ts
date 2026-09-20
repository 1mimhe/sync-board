import { Module } from '@nestjs/common';
import { ActivityRepository } from './repositories/activity.repository';
import { ActivityService } from './services/activity.service';
import { BoardActivityListener } from './listeners/board-activity.listener';
import { ListActivityListener } from './listeners/list-activity.listener';
import { CardActivityListener } from './listeners/card-activity.listener';
import { CommentActivityListener } from './listeners/comment-activity.listener';
import { DocumentActivityListener } from './listeners/document-activity.listener';
import { WorkspaceActivityListener } from './listeners/workspace-activity.listener';
import { ActivityController } from './controllers/activity.controller';
import { BoardActivityController } from './controllers/activity.controller';
import { BoardSubModule } from '../board/core/board.module';
import { DocumentModule } from '../document/document.module';
import { PrismaModule } from '../../common/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ActivityPartitionTask } from './tasks/activity-partition.task';

/**
 * Append-only activity audit log. Consumes domain events emitted by other
 * modules and exposes workspace/board activity feeds. Depends on Board core
 * for workspace resolution; Board core does NOT depend on Activity.
 */
@Module({
  imports: [
    PrismaModule,
    BoardSubModule,
    DocumentModule,
    AuthModule,
    WorkspaceModule,
  ],
  controllers: [ActivityController, BoardActivityController],
  providers: [
    ActivityRepository,
    ActivityService,
    ActivityPartitionTask,
    BoardActivityListener,
    ListActivityListener,
    CardActivityListener,
    CommentActivityListener,
    DocumentActivityListener,
    WorkspaceActivityListener,
  ],
  exports: [ActivityService],
})
export class ActivityModule {}
