import { Module } from '@nestjs/common';
import { CardFieldDefController } from './controllers/card-field-def.controller';
import { CardFieldValueController } from './controllers/card-field-value.controller';
import { CardFieldService } from './services/card-field.service';
import { CardFieldRepository } from './repositories/card-field.repository';
import { CardSubModule } from '../card/card.module';
import { BoardSubModule } from '../core/board.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { PrismaModule } from '../../../common/database/prisma.module';

/** Workspace custom field definitions and per-card values slice. */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    CardSubModule,
    BoardSubModule,
  ],
  controllers: [CardFieldDefController, CardFieldValueController],
  providers: [CardFieldService, CardFieldRepository],
  exports: [CardFieldService, CardFieldRepository],
})
export class CardFieldsSubModule {}
