import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { RedisModule } from '../../../common/redis/redis.module';
import { BoardGateway } from './gateways/board.gateway';
import { BroadcastRelayService } from './services/broadcast-relay.service';
import { PresenceService } from './services/presence.service';
import { WsRateLimiterService } from './services/ws-rate-limiter.service';
import { WsBoardAccessGuard } from './guards/ws-board-access.guard';
import { WsRateLimitGuard } from '../../../common/guards/ws-rate-limit.guard';
import { BoardSubModule } from '../board/board.module';

/**
 * Realtime slice: Socket.IO gateway (client handlers), domain-event broadcast
 * relay, presence tracking, and WS rate limiting.
 */
@Module({
  imports: [RedisModule, AuthModule, WorkspaceModule, BoardSubModule],
  providers: [
    BoardGateway,
    BroadcastRelayService,
    PresenceService,
    WsRateLimiterService,
    WsBoardAccessGuard,
    WsRateLimitGuard,
  ],
  exports: [PresenceService, WsBoardAccessGuard, WsRateLimitGuard],
})
export class RealtimeSubModule {}
