import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtTokenService } from '../../modules/auth/services/jwt-token.service';
import { TokenBlacklistService } from '../../modules/auth/services/token-blacklist.service';
import { RefreshTokenRepository } from '../../modules/auth/repositories/refresh-token.repository';
import { REFRESH_TOKEN_COOKIE_NAME } from '../../modules/auth/auth.constants';
import { hashToken } from '../utils/hash.util';

/**
 * Guard ensuring that an endpoint is accessed only by unauthenticated (guest) users.
 * If an active Bearer JWT access token or valid non-expired Refresh token is present, access is denied.
 */
@Injectable()
export class AnonymousGuard implements CanActivate {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly blacklistService: TokenBlacklistService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    // 1. Check Access Token (Bearer header)
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
        // If token is invalid or expired, continue to check refresh token
      }
    }

    // 2. Check Refresh Token (cookies only)
    const cookies = request.cookies as Record<string, string> | undefined;
    const rawRefreshToken =
      cookies?.[REFRESH_TOKEN_COOKIE_NAME] || cookies?.refreshToken;

    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      const refreshToken =
        await this.refreshTokenRepository.findByTokenHash(tokenHash);

      if (
        refreshToken &&
        !refreshToken.revokedAt &&
        refreshToken.expiresAt > new Date()
      ) {
        throw new ForbiddenException('ALREADY_AUTHENTICATED');
      }
    }

    return true;
  }
}
