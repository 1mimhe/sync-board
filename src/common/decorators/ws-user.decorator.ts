import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { AuthenticatedSocketData } from '../interfaces/ws.interface';
import type { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * Parameter decorator that extracts the authenticated user (`JwtPayload`)
 * from the WebSocket client's socket data.
 */
export const WsUser = createParamDecorator(
  (
    data: keyof JwtPayload | undefined,
    ctx: ExecutionContext,
  ): JwtPayload | unknown => {
    const client = ctx.switchToWs().getClient<Socket>();
    const socketData = client?.data as AuthenticatedSocketData | undefined;
    const user = socketData?.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
