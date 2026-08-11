import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtTokenService } from '../../modules/auth/services/jwt-token.service';
import { TokenBlacklistService } from '../../modules/auth/services/token-blacklist.service';

/**
 * Guard verifying JWT access tokens on HTTP requests.
 * Validates token signature, expiration, and checks Redis blacklist.
 * Attaches decoded JwtPayload to `request.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly blacklistService: TokenBlacklistService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('TOKEN_INVALID');
    }

    const token = authHeader.split(' ')[1];
    const payload = this.jwtTokenService.verifyAccessToken(token);

    if (await this.blacklistService.isBlacklisted(payload.jti)) {
      throw new UnauthorizedException('TOKEN_REVOKED');
    }

    request.user = payload;
    return true;
  }
}
