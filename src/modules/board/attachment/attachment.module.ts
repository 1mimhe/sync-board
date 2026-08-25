import { Module } from '@nestjs/common';
import { CardAttachmentController } from './controllers/attachment.controller';
import { CardAttachmentService } from './services/attachment.service';
import { CardAttachmentRepository } from './repositories/attachment.repository';
import { BoardSubModule } from '../board/board.module';
import { CardSubModule } from '../card/card.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';

/** Card attachments slice (files, images, external links). */
@Module({
  imports: [AuthModule, WorkspaceModule, BoardSubModule, CardSubModule],
  controllers: [CardAttachmentController],
  providers: [CardAttachmentService, CardAttachmentRepository],
})
export class AttachmentSubModule {}
