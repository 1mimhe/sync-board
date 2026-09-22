import { Module } from '@nestjs/common';
import { CardAttachmentController } from './controllers/attachment.controller';
import { FileModule } from '../../file/file.module';
import { BoardSubModule } from '../core/board.module';
import { CardSubModule } from '../card/card.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';

/** Card attachments read proxy over S3-backed files. */
@Module({
  imports: [
    AuthModule,
    WorkspaceModule,
    BoardSubModule,
    CardSubModule,
    FileModule,
  ],
  controllers: [CardAttachmentController],
  providers: [],
})
export class AttachmentSubModule {}
