import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Global throttling guard restricted to HTTP requests.
 *
 * Nest applies APP_GUARDs to every execution context, including RabbitMQ
 * consumers and WebSocket gateways. ThrottlerGuard reads HTTP-only
 * req/res objects, so running it there crashes message handling into an
 * infinite redelivery loop. Non-HTTP traffic is covered elsewhere
 * (WsRateLimitGuard for sockets; broker flow control for consumers).
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    return super.canActivate(context);
  }
}
