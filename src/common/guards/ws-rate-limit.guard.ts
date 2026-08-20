import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { WsRateLimiterService } from '../../modules/board/services/ws-rate-limiter.service';
import { WS_RATE_LIMIT_KEY } from '../decorators/ws-rate-limit.decorator';
import type { WsRateLimitOptions } from '../decorators/ws-rate-limit.decorator';
import type { AuthenticatedSocketData } from '../interfaces/ws.interface';

/**
 * Guard that enforces sliding-window rate limiting on WebSocket event handlers
 * configured via the `@WsRateLimit()` decorator.
 */
@Injectable()
export class WsRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiter: WsRateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<WsRateLimitOptions>(
      WS_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!config) {
      return true;
    }

    const client = context.switchToWs().getClient<Socket>();
    const socketData = client?.data as AuthenticatedSocketData | undefined;
    const userId = socketData?.user?.sub;

    if (!userId) {
      if (config.silent) return false;
      throw new WsException({
        code: 'TOKEN_INVALID',
        message: 'Authentication required',
      });
    }

    const allowed = await this.rateLimiter.checkRateLimit(
      userId,
      config.category,
      config.limit,
      config.windowMs,
    );

    if (!allowed) {
      if (config.silent) {
        return false; // Silently drop high-frequency events without throwing
      }
      throw new WsException({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
      });
    }

    return true;
  }
}
