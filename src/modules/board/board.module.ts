import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RedisModule } from '../../common/redis/redis.module';
import { LexorankSubModule } from './lexorank/lexorank.module';
import { BoardSubModule } from './core/board.module';
import { ListSubModule } from './list/list.module';
import { CardSubModule } from './card/card.module';
import { CardFieldsSubModule } from './card-fields/card-fields.module';
import { CardTimeSubModule } from './card-time/card-time.module';
import { CommentSubModule } from './comment/comment.module';
import { AttachmentSubModule } from './attachment/attachment.module';
import { LabelSubModule } from './label/label.module';
import { ChecklistSubModule } from './checklist/checklist.module';
import { RealtimeSubModule } from './realtime/realtime.module';
import { ViewsSubModule } from './views/views.module';

/**
 * AGGREGATOR module for the Board domain.
 * Contains zero business logic — only wires the sub-feature slices.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    RedisModule,
    LexorankSubModule,
    BoardSubModule,
    ListSubModule,
    CardSubModule,
    CardFieldsSubModule,
    CardTimeSubModule,
    CommentSubModule,
    AttachmentSubModule,
    LabelSubModule,
    ChecklistSubModule,
    RealtimeSubModule,
    ViewsSubModule,
  ],
  exports: [BoardSubModule, RealtimeSubModule],
})
export class BoardModule {}
