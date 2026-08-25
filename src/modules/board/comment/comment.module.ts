import { Module } from '@nestjs/common';
import { CardCommentController } from './controllers/comment.controller';
import { CardCommentService } from './services/comment.service';
import { CardCommentRepository } from './repositories/comment.repository';
import { BoardSubModule } from '../board/board.module';
import { CardSubModule } from '../card/card.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';

/** Card comments slice (cursor-paginated listing, author-only edit/delete). */
@Module({
  imports: [AuthModule, WorkspaceModule, BoardSubModule, CardSubModule],
  controllers: [CardCommentController],
  providers: [CardCommentService, CardCommentRepository],
})
export class CommentSubModule {}
