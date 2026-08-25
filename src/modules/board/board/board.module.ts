import { Module, forwardRef } from '@nestjs/common';
import { BoardController } from './controllers/board.controller';
import { BoardService } from './services/board.service';
import { BoardRepository } from './repositories/board.repository';
import { LabelSubModule } from '../label/label.module';
import { ActivityModule } from '../../activity/activity.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';

/** Board CRUD, stars, content hydration, and activity feed slice. */
@Module({
  imports: [forwardRef(() => LabelSubModule), ActivityModule, AuthModule, WorkspaceModule],
  controllers: [BoardController],
  providers: [BoardService, BoardRepository],
  exports: [BoardService, BoardRepository],
})
export class BoardSubModule {}
