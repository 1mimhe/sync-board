import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';
import type { RequestWithUser } from '../interfaces/request-with-user.interface';

/**
 * Custom parameter decorator to extract the authenticated user (or user property) from HTTP execution context.
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data as keyof JwtPayload] : user;
  },
);
