import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { TokenBlacklistService } from '../../modules/auth/services/token-blacklist.service';
import type { AuthenticatedSocketData } from '../interfaces/ws.interface';

/**
 * Guard for WebSocket message handlers that verifies the socket has an authenticated user
 * attached and that the token has not been revoked in Redis.
 *
 * To apply: `@UseGuards(WsAuthGuard)` on a gateway class or individual handler.
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly blacklistService: TokenBlacklistService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const socketData = client?.data as AuthenticatedSocketData | undefined;

    if (!socketData?.user) {
      this.logger.warn(
        `Unauthenticated WebSocket event attempt from socket ${client?.id}`,
      );
      throw new WsException({
        code: 'TOKEN_INVALID',
        message: 'Authentication required',
      });
    }

    const jti = socketData.user.jti;
    if (jti && (await this.blacklistService.isBlacklisted(jti))) {
      this.logger.warn(
        `Revoked JWT access attempt on socket ${client?.id} (jti: ${jti})`,
      );
      throw new WsException({
        code: 'TOKEN_REVOKED',
        message: 'Token has been revoked',
      });
    }

    // Email-verification soft gate: users with tokens issued before their
    // verification lack the claim (undefined) and are allowed for backwards
    // compatibility until the token is refreshed.
    if (socketData.user.isEmailVerified === false) {
      this.logger.warn(
        `Unverified user ${socketData.user.sub} attempted WebSocket event on socket ${client?.id}`,
      );
      throw new WsException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email verification required before participating in realtime',
      });
    }

    return true;
  }
}
