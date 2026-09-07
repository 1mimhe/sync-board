import { Module } from '@nestjs/common';
import { CardTimeController } from './controllers/card-time.controller';
import { CardTimeService } from './services/card-time.service';
import { CardTimeRepository } from './repositories/card-time.repository';
import { CardSubModule } from '../card/card.module';
import { BoardSubModule } from '../core/board.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { PrismaModule } from '../../../common/database/prisma.module';

/** Card estimate and time-logging slice. */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    CardSubModule,
    BoardSubModule,
  ],
  controllers: [CardTimeController],
  providers: [CardTimeService, CardTimeRepository],
  exports: [CardTimeService, CardTimeRepository],
})
export class CardTimeSubModule {}
