import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../common/database/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { BoardSubModule } from '../core/board.module';
import { BoardViewController } from './controllers/board-view.controller';
import { CardViewService } from './services/card-view.service';
import { CardViewRepository } from './repositories/card-view.repository';

/** Read-only board views (calendar, timeline, table). */
@Module({
  imports: [PrismaModule, AuthModule, WorkspaceModule, BoardSubModule],
  controllers: [BoardViewController],
  providers: [CardViewService, CardViewRepository],
  exports: [CardViewService],
})
export class ViewsSubModule {}
