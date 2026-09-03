import { Module, forwardRef } from '@nestjs/common';
import { LabelController } from './controllers/label.controller';
import { WorkspaceLabelController } from './controllers/workspace-label.controller';
import { LabelService } from './services/label.service';
import { LabelRepository } from './repositories/label.repository';
import { BoardSubModule } from '../board/board.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';

/** Hybrid workspace-level + board-specific label CRUD slice. */
@Module({
  imports: [AuthModule, WorkspaceModule, forwardRef(() => BoardSubModule)],
  controllers: [LabelController, WorkspaceLabelController],
  providers: [LabelRepository, LabelService],
  exports: [LabelRepository, LabelService],
})
export class LabelSubModule {}
