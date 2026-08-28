import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SKIP_EMAIL_VERIFICATION_KEY } from '../decorators/skip-email-verification.decorator';
import { UserRepository } from '../../modules/auth/repositories/user.repository';
import { RedisService } from '../redis/redis.service';
import type { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/** Redis key prefix for the positive verification-result cache. */
const EMAIL_VERIFIED_CACHE_PREFIX = 'email_verified:';

/** TTL (seconds) for cached positive verification lookups. */
const EMAIL_VERIFIED_CACHE_TTL_SECONDS = 300;

/** HTTP methods that unverified users may always perform (soft gate). */
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guard enforcing the email-verification soft gate.
 *
 * Policy: unverified users may log in, browse (read-only GET/HEAD/OPTIONS
 * requests) and use endpoints explicitly marked with
 * `@SkipEmailVerification()`; every mutating request requires a verified
 * email and fails with 403 `EMAIL_NOT_VERIFIED` otherwise.
 *
 * MUST run after {@link JwtAuthGuard} (relies on `request.user`).
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  private readonly logger = new Logger(EmailVerifiedGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly userRepository: UserRepository,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_EMAIL_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload | undefined;

    // No authenticated user — JwtAuthGuard is responsible for rejecting.
    if (!user?.sub) {
      return true;
    }

    if (user.isEmailVerified) {
      return true;
    }

    // Soft gate: read-only browsing is allowed for unverified users.
    if (READ_ONLY_METHODS.has(request.method)) {
      return true;
    }

    // Claim may be stale (token issued before verification) — check the DB.
    if (await this.isVerifiedInDb(user.sub)) {
      return true;
    }

    this.logger.warn(
      `Unverified user ${user.sub} attempted ${request.method} ${request.url}`,
    );
    throw new ForbiddenException('EMAIL_NOT_VERIFIED');
  }

  /**
   * Checks the database for the authoritative verification state, caching
   * positive results (verification is irreversible, so no invalidation needed).
   */
  private async isVerifiedInDb(userId: string): Promise<boolean> {
    const cacheKey = `${EMAIL_VERIFIED_CACHE_PREFIX}${userId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached === '1') {
        return true;
      }
    } catch {
      // Cache unavailable — fall through to the DB lookup.
    }

    const user = await this.userRepository.findById(userId);
    if (!user?.isEmailVerified) {
      return false;
    }

    try {
      await this.redis.set(
        cacheKey,
        '1',
        'EX',
        EMAIL_VERIFIED_CACHE_TTL_SECONDS,
      );
    } catch {
      // Caching is best-effort only.
    }
    return true;
  }
}
