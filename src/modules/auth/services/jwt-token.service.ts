import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AUTH_CONFIG } from '../auth.constants';
import { User } from '@prisma/client';

/**
 * Service for generating and verifying JWT access tokens using RS256 (asymmetric keys)
 * or HS256 (symmetric fallback for local development).
 */
@Injectable()
export class JwtTokenService {
  private readonly logger = new Logger(JwtTokenService.name);
  private readonly privateKey: string | null;
  private readonly publicKey: string | null;
  private readonly secret: string;
  private readonly algorithm: jwt.Algorithm;

  constructor(private readonly config: ConfigService) {
    const privatePath = this.config.get<string>('JWT_PRIVATE_KEY_PATH');
    const publicPath = this.config.get<string>('JWT_PUBLIC_KEY_PATH');

    if (
      privatePath &&
      publicPath &&
      fs.existsSync(privatePath) &&
      fs.existsSync(publicPath)
    ) {
      this.privateKey = fs.readFileSync(privatePath, 'utf-8');
      this.publicKey = fs.readFileSync(publicPath, 'utf-8');
      this.algorithm = 'RS256';
      this.secret = '';
      this.logger.log('JWT configured with RS256 (asymmetric keys)');
    } else {
      this.privateKey = null;
      this.publicKey = null;
      this.secret = this.config.get<string>(
        'JWT_SECRET',
        'default-super-secret-key-change-in-prod',
      );
      this.algorithm = 'HS256';
      this.logger.warn(
        'JWT falling back to HS256 (symmetric secret). Use RS256 key files in production.',
      );
    }
  }

  /**
   * Generate a signed JWT access token for the given user.
   * Token TTL: 15 minutes. Includes user metadata and unique jti.
   */
  generateAccessToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
    };
    const signingKey = this.privateKey || this.secret;
    return jwt.sign(payload, signingKey, {
      algorithm: this.algorithm,
      expiresIn: AUTH_CONFIG.accessToken.expiresIn,
      issuer: AUTH_CONFIG.accessToken.issuer,
      jwtid: randomUUID(),
    });
  }

  /**
   * Verify and decode a JWT access token string.
   * @throws UnauthorizedException TOKEN_EXPIRED or TOKEN_INVALID
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      const verifyKey = this.publicKey || this.secret;
      return jwt.verify(token, verifyKey, {
        algorithms: [this.algorithm],
        issuer: AUTH_CONFIG.accessToken.issuer,
      }) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('TOKEN_EXPIRED');
      }
      throw new UnauthorizedException('TOKEN_INVALID');
    }
  }
}
