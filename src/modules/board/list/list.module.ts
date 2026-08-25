import { Module } from '@nestjs/common';
import { ListController } from './controllers/list.controller';
import { ListService } from './services/list.service';
import { ListRepository } from './repositories/list.repository';
import { LexorankSubModule } from '../lexorank/lexorank.module';
import { BoardSubModule } from '../board/board.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';

/** List CRUD and Lexorank reordering slice. */
@Module({
  imports: [AuthModule, WorkspaceModule, LexorankSubModule, BoardSubModule],
  controllers: [ListController],
  providers: [ListService, ListRepository],
  exports: [ListService, ListRepository],
})
export class ListSubModule {}
