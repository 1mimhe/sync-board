import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RedisModule } from '../../common/redis/redis.module';
import { LexorankSubModule } from './lexorank/lexorank.module';
import { BoardSubModule } from './board/board.module';
import { ListSubModule } from './list/list.module';
import { CardSubModule } from './card/card.module';
import { CommentSubModule } from './comment/comment.module';
import { AttachmentSubModule } from './attachment/attachment.module';
import { LabelSubModule } from './label/label.module';
import { ChecklistSubModule } from './checklist/checklist.module';
import { RealtimeSubModule } from './realtime/realtime.module';

/**
 * AGGREGATOR module for the Board domain (CODE_STANDARDS §1a).
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
    CommentSubModule,
    AttachmentSubModule,
    LabelSubModule,
    ChecklistSubModule,
    RealtimeSubModule,
  ],
  exports: [BoardSubModule, RealtimeSubModule],
})
export class BoardModule {}
