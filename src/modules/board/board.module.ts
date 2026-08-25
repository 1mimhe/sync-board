import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RedisModule } from '../../common/redis/redis.module';

// Controllers
import { BoardController } from './board/controllers/board.controller';
import { ListController } from './list/controllers/list.controller';
import { CardController } from './card/controllers/card.controller';
import { CardCommentController } from './comment/controllers/comment.controller';
import { CardAttachmentController } from './attachment/controllers/attachment.controller';
import { ChecklistController } from './checklist/controllers/checklist.controller';
import { LabelController } from './label/controllers/label.controller';

// Gateways
import { BoardGateway } from './realtime/gateways/board.gateway';

// Services
import { LexorankService } from './lexorank/services/lexorank.service';
import { BoardService } from './board/services/board.service';
import { ListService } from './list/services/list.service';
import { CardService } from './card/services/card.service';
import { CardCommentService } from './comment/services/comment.service';
import { CardAttachmentService } from './attachment/services/attachment.service';
import { PresenceService } from './realtime/services/presence.service';
import { WsRateLimiterService } from './realtime/services/ws-rate-limiter.service';
import { ChecklistService } from './checklist/services/checklist.service';
import { LabelService } from './label/services/label.service';

// Repositories
import { BoardRepository } from './board/repositories/board.repository';
import { ListRepository } from './list/repositories/list.repository';
import { CardRepository } from './card/repositories/card.repository';
import { LabelRepository } from './label/repositories/label.repository';
import { CardCommentRepository } from './comment/repositories/comment.repository';
import { CardAttachmentRepository } from './attachment/repositories/attachment.repository';
import { ChecklistRepository } from './checklist/repositories/checklist.repository';

// Guards
import { WsBoardAccessGuard } from './realtime/guards/ws-board-access.guard';
import { WsRateLimitGuard } from '../../common/guards/ws-rate-limit.guard';

/**
 * NestJS module encapsulating all board, list, card, comment, attachment, label,
 * checklist, real-time WebSocket gateway, presence, and board activity features.
 */
@Module({
  imports: [PrismaModule, AuthModule, WorkspaceModule, RedisModule],
  controllers: [
    BoardController,
    ListController,
    CardController,
    CardCommentController,
    CardAttachmentController,
    ChecklistController,
    LabelController,
  ],
  providers: [
    // Services
    LexorankService,
    BoardService,
    ListService,
    CardService,
    CardCommentService,
    CardAttachmentService,
    PresenceService,
    WsRateLimiterService,
    ChecklistService,
    LabelService,

    // Repositories
    BoardRepository,
    ListRepository,
    CardRepository,
    LabelRepository,
    CardCommentRepository,
    CardAttachmentRepository,
    ChecklistRepository,

    // Guards
    WsBoardAccessGuard,
    WsRateLimitGuard,

    // Gateway
    BoardGateway,
  ],
  exports: [
    BoardService,
    PresenceService,
    WsBoardAccessGuard,
    WsRateLimitGuard,
  ],
})
export class BoardModule {}
