import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RedisModule } from '../../common/redis/redis.module';

// Controllers
import { BoardController } from './controllers/board.controller';
import { ListController } from './controllers/list.controller';
import { CardController } from './controllers/card.controller';
import { CardCommentController } from './controllers/card-comment.controller';
import { CardAttachmentController } from './controllers/card-attachment.controller';

// Gateways
import { BoardGateway } from './gateways/board.gateway';

// Services
import { LexorankService } from './services/lexorank.service';
import { BoardService } from './services/board.service';
import { ListService } from './services/list.service';
import { CardService } from './services/card.service';
import { CardCommentService } from './services/card-comment.service';
import { CardAttachmentService } from './services/card-attachment.service';
import { PresenceService } from './services/presence.service';
import { WsRateLimiterService } from './services/ws-rate-limiter.service';

// Repositories
import { BoardRepository } from './repositories/board.repository';
import { ListRepository } from './repositories/list.repository';
import { CardRepository } from './repositories/card.repository';
import { LabelRepository } from './repositories/label.repository';
import { CardCommentRepository } from './repositories/card-comment.repository';
import { CardAttachmentRepository } from './repositories/card-attachment.repository';
import { ActivityRepository } from './repositories/activity.repository';

// Listeners
import { ActivityListener } from './listeners/activity.listener';

// Guards
import { WsBoardAccessGuard } from './guards/ws-board-access.guard';
import { WsRateLimitGuard } from '../../common/guards/ws-rate-limit.guard';

/**
 * NestJS module encapsulating all board, list, card, comment, attachment, label,
 * real-time WebSocket gateway, presence, and board activity features.
 */
@Module({
  imports: [PrismaModule, AuthModule, WorkspaceModule, RedisModule],
  controllers: [
    BoardController,
    ListController,
    CardController,
    CardCommentController,
    CardAttachmentController,
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

    // Repositories
    BoardRepository,
    ListRepository,
    CardRepository,
    LabelRepository,
    CardCommentRepository,
    CardAttachmentRepository,
    ActivityRepository,

    // Listeners
    ActivityListener,

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
