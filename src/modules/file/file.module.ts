import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CardSubModule } from '../board/card/card.module';
import { DocumentModule } from '../document/document.module';
import { FileController } from './controllers/file.controller';
import { FileService } from './services/file.service';
import { S3Service } from './services/s3.service';
import { FileRepository } from './repositories/file.repository';
import { StaleUploadTask } from './tasks/stale-upload.task';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    CardSubModule,
    DocumentModule,
  ],
  controllers: [FileController],
  providers: [FileService, S3Service, FileRepository, StaleUploadTask],
  exports: [FileService],
})
export class FileModule {}
