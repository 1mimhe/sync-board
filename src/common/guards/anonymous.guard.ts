import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtTokenService } from '../../modules/auth/services/jwt-token.service';
import { TokenBlacklistService } from '../../modules/auth/services/token-blacklist.service';

/**
 * Guard ensuring that an endpoint is accessed only by unauthenticated (guest) users.
 * If an active Bearer JWT token is present and valid, access is denied.
 */
@Injectable()
export class AnonymousGuard implements CanActivate {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly blacklistService: TokenBlacklistService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payload = this.jwtTokenService.verifyAccessToken(token);
        const isBlacklisted = await this.blacklistService.isBlacklisted(
          payload.jti,
        );
        if (!isBlacklisted) {
          throw new ForbiddenException('ALREADY_AUTHENTICATED');
        }
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        // If token is invalid or expired, user is treated as anonymous guest
      }
    }

    return true;
  }
}
