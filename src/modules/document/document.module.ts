import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RedisModule } from '../../common/redis/redis.module';
import { RealtimeSubModule } from '../board/realtime/realtime.module';
import { DocumentRepository } from './repositories/document.repository';
import { DocumentService } from './services/document.service';
import { SnapshotService } from './services/snapshot.service';
import { DocumentManagerService } from './services/document-manager.service';
import { EditorPresenceService } from './realtime/editor-presence.service';
import { DocumentGateway } from './realtime/document.gateway';
import { DocumentController } from './controllers/document.controller';
import { DocumentSnapshotController } from './controllers/document-snapshot.controller';
import { BoardDocumentsController } from './controllers/board-documents.controller';
import { CardDocumentsController } from './controllers/card-documents.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    RedisModule,
    RealtimeSubModule,
  ],
  controllers: [
    DocumentController,
    DocumentSnapshotController,
    BoardDocumentsController,
    CardDocumentsController,
  ],
  providers: [
    DocumentRepository,
    DocumentService,
    SnapshotService,
    DocumentManagerService,
    EditorPresenceService,
    DocumentGateway,
  ],
  exports: [DocumentService, DocumentRepository, DocumentManagerService],
})
export class DocumentModule {}
