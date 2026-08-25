import { Module } from '@nestjs/common';
import { ChecklistController } from './controllers/checklist.controller';
import { ChecklistService } from './services/checklist.service';
import { ChecklistRepository } from './repositories/checklist.repository';
import { BoardSubModule } from '../board/board.module';
import { CardSubModule } from '../card/card.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { LexorankSubModule } from '../lexorank/lexorank.module';

/** Card checklists and items slice with Lexorank ordering. */
@Module({
  imports: [AuthModule, WorkspaceModule, LexorankSubModule, BoardSubModule, CardSubModule],
  controllers: [ChecklistController],
  providers: [ChecklistService, ChecklistRepository],
})
export class ChecklistSubModule {}
