import { Module } from '@nestjs/common';
import { CardController } from './controllers/card.controller';
import { CardService } from './services/card.service';
import { CardRepository } from './repositories/card.repository';
import { BoardSubModule } from '../board/board.module';
import { ListSubModule } from '../list/list.module';
import { LabelSubModule } from '../label/label.module';
import { LexorankSubModule } from '../lexorank/lexorank.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';

/** Card CRUD, movement, assignments, and label attachment slice. */
@Module({
  imports: [
    AuthModule,
    WorkspaceModule,
    LexorankSubModule,
    ListSubModule,
    LabelSubModule,
    BoardSubModule,
  ],
  controllers: [CardController],
  providers: [CardService, CardRepository],
  exports: [CardService, CardRepository],
})
export class CardSubModule {}
