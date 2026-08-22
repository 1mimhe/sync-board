import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User } from '@prisma/client';
import { randomBytes } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PasswordService } from './password.service';
import { JwtTokenService } from './jwt-token.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { RedisService } from '../../../common/redis/redis.service';
import { hashToken } from '../../../common/utils/hash.util';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AuthResponse, TokenPair } from '../interfaces/auth-response.interface';
import {
  UserRegisteredEvent,
  UserLoggedInEvent,
  PasswordResetRequestedEvent,
} from '../events/auth.events';
import { AUTH_CONFIG } from '../auth.constants';

/**
 * Core authentication service handling registration, login, token rotation,
 * password management, Google OAuth synchronization, and device sessions.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenRepository: RefreshTokenRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly blacklistService: TokenBlacklistService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  /**
   * Register a new user with email and password.
   * @throws AppException EMAIL_ALREADY_EXISTS if email is taken
   * @emits user.registered
   */
  async register(
    dto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    this.logger.debug('Registering new user', { email: dto.email });
    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.userRepository.createUser({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
    });

    const tokens = await this.issueTokenPair(user, ipAddress, userAgent);
    this.eventEmitter.emit('user.registered', {
      userId: user.id,
      email: user.email,
    } satisfies UserRegisteredEvent);
    this.logger.log(`User registered successfully: ${user.id}`);
    return this.buildAuthResponse(user, tokens);
  }

  /**
   * Authenticate a user with email and password.
   * @throws UnauthorizedException INVALID_CREDENTIALS
   * @emits user.logged_in
   */
  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    this.logger.debug('Login attempt', { email: dto.email });
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const isPasswordValid = await this.passwordService.verify(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    await this.userRepository.updateLastLogin(user.id);

    const tokens = await this.issueTokenPair(user, ipAddress, userAgent);
    this.eventEmitter.emit('user.logged_in', {
      userId: user.id,
      method: 'email',
    } satisfies UserLoggedInEvent);
    this.logger.log(`User logged in successfully: ${user.id}`);
    return this.buildAuthResponse(user, tokens);
  }

  /**
   * Rotate refresh token in-place and issue a new access token.
   * @throws UnauthorizedException REFRESH_TOKEN_EXPIRED or TOKEN_INVALID
   */
  async refreshTokens(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);
    const existingToken =
      await this.tokenRepository.findByTokenHashWithUser(tokenHash);

    if (!existingToken || existingToken.revokedAt) {
      throw new UnauthorizedException('TOKEN_INVALID');
    }
    if (existingToken.expiresAt < new Date()) {
      throw new UnauthorizedException('REFRESH_TOKEN_EXPIRED');
    }

    const newRawToken = randomBytes(32).toString('base64url');
    const newTokenHash = this.hashToken(newRawToken);
    const expiresAt = new Date(
      Date.now() + AUTH_CONFIG.refreshToken.expiresInDays * 24 * 60 * 60 * 1000,
    );

    await this.tokenRepository.updateToken(existingToken.id, {
      tokenHash: newTokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    });

    const accessToken = this.jwtTokenService.generateAccessToken(
      existingToken.user,
    );
    this.logger.debug(`Tokens refreshed for user: ${existingToken.userId}`);

    return {
      accessToken,
      refreshToken: newRawToken,
      expiresIn: AUTH_CONFIG.accessToken.expiresInSeconds,
    };
  }

  /**
   * Revoke a single refresh token (single device logout) and blacklist active access token.
   */
  async logout(
    refreshToken: string,
    jti?: string,
    jwtExpiresAt?: Date,
  ): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.tokenRepository.revokeByTokenHash(tokenHash);

    if (jti && jwtExpiresAt) {
      await this.blacklistService.blacklist(jti, jwtExpiresAt);
    }
    this.logger.debug(
      'User logged out (single device token revoked + JWT blacklisted)',
    );
  }

  /**
   * Revoke ALL refresh tokens for a user (logout from all devices) and blacklist active access token.
   */
  async logoutAllDevices(
    userId: string,
    jti?: string,
    jwtExpiresAt?: Date,
  ): Promise<void> {
    await this.tokenRepository.revokeAllByUserId(userId);

    if (jti && jwtExpiresAt) {
      await this.blacklistService.blacklist(jti, jwtExpiresAt);
    }
    this.logger.log(`User logged out from all devices: ${userId}`);
  }

  /**
   * Request a password reset link via email.
   * Always resolves silently to prevent user enumeration attacks.
   * @emits user.password_reset_requested (only if user exists)
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      this.logger.debug('Password reset requested for non-existent email');
      return;
    }

    const resetToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(resetToken);

    // Store reset token in Redis with key password_reset:<tokenHash> and TTL from config
    const redisKey = `password_reset:${tokenHash}`;
    await this.redis.set(
      redisKey,
      user.id,
      'EX',
      AUTH_CONFIG.passwordReset.expiresInSeconds,
    );

    this.eventEmitter.emit('user.password_reset_requested', {
      userId: user.id,
      email: user.email,
      token: resetToken,
    } satisfies PasswordResetRequestedEvent);
    this.logger.log(
      `Password reset token created in Redis for user: ${user.id}`,
    );
  }

  /**
   * Reset user password using valid token from Redis, revoke previous sessions, and issue fresh token pair.
   * @throws UnauthorizedException TOKEN_INVALID or TOKEN_EXPIRED
   */
  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const tokenHash = this.hashToken(token);
    const redisKey = `password_reset:${tokenHash}`;
    const userId = await this.redis.get(redisKey);

    if (!userId) {
      throw new UnauthorizedException('TOKEN_INVALID');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('USER_NOT_FOUND');
    }

    const passwordHash = await this.passwordService.hash(newPassword);
    await this.userRepository.updatePassword(userId, passwordHash);
    await this.tokenRepository.revokeAllByUserId(userId);
    await this.redis.del(redisKey);

    const tokens = await this.issueTokenPair(user, ipAddress, userAgent);

    this.logger.log(
      `Password reset successfully via Redis for user: ${userId} (other sessions revoked, fresh tokens issued)`,
    );

    return tokens;
  }

  /**
   * Find existing user by Google ID or email, or create a new user account for Google OAuth.
   */
  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  }): Promise<User> {
    if (!profile.email) {
      throw new UnauthorizedException('Google account must have a valid email');
    }

    let user = await this.userRepository.findByGoogleId(profile.googleId);
    if (user) {
      return this.userRepository.updateGoogleLogin(user.id, {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        lastLoginAt: new Date(),
      });
    }

    user = await this.userRepository.findByEmail(profile.email.toLowerCase());
    if (user) {
      return this.userRepository.updateGoogleLogin(user.id, {
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl || user.avatarUrl,
        isEmailVerified: true,
        lastLoginAt: new Date(),
      });
    }

    try {
      return await this.userRepository.createGoogleUser({
        email: profile.email.toLowerCase(),
        googleId: profile.googleId,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.userRepository.findByEmail(
          profile.email.toLowerCase(),
        );
        if (existing) {
          return this.userRepository.updateGoogleLogin(existing.id, {
            googleId: profile.googleId,
            avatarUrl: profile.avatarUrl || existing.avatarUrl,
            isEmailVerified: true,
            lastLoginAt: new Date(),
          });
        }
      }
      throw error;
    }
  }

  /**
   * Constructs and returns the Google OAuth 2.0 authorization URL with a secure random state stored in Redis.
   */
  async getGoogleAuthUrl(): Promise<{ url: string }> {
    const clientId = this.config.get<string>(
      'GOOGLE_CLIENT_ID',
      'dummy-client-id',
    );
    const callbackUrl = this.config.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:3000/api/auth/google/callback',
    );
    const scope = encodeURIComponent('email profile');
    const state = randomBytes(32).toString('base64url');

    // Store state in Redis for 10 minutes (600s) to protect against OAuth login CSRF
    await this.redis.set(`oauth:state:${state}`, '1', 'EX', 600);

    const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(
      clientId,
    )}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scope}&access_type=offline&state=${encodeURIComponent(state)}`;

    return { url };
  }

  /**
   * Validates and single-use consumes the OAuth state parameter to prevent CSRF attacks.
   */
  async validateOAuthState(state?: string): Promise<void> {
    if (!state) {
      throw new UnauthorizedException('INVALID_OAUTH_STATE');
    }
    const exists = await this.redis.exists(`oauth:state:${state}`);
    if (exists !== 1) {
      throw new UnauthorizedException('INVALID_OAUTH_STATE');
    }
    await this.redis.del(`oauth:state:${state}`);
  }

  /**
   * Process a completed Google OAuth callback flow: issue tokens, emit login event, build response.
   * Called exclusively from the Google OAuth callback controller endpoint.
   * @emits user.logged_in
   */
  async handleGoogleCallback(
    user: User,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const tokens = await this.issueTokenPair(user, ipAddress, userAgent);
    this.eventEmitter.emit('user.logged_in', {
      userId: user.id,
      method: 'google',
    } satisfies UserLoggedInEvent);
    this.logger.log(`Google OAuth login completed for user: ${user.id}`);
    return this.buildAuthResponse(user, tokens);
  }

  /**
   * Get user profile details by ID, excluding the password hash.
   */
  async getProfile(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepository.findByIdPublic(userId);
    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }
    return user;
  }

  /**
   * Find user by email address (for internal module consumption).
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  /**
   * Find lightweight user summary by email address (omitting password hash).
   */
  async findUserSummaryByEmail(
    email: string,
  ): Promise<Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl'> | null> {
    return this.userRepository.findUserSummaryByEmail(email);
  }

  /**
   * Update current user's profile info. Password hash is never returned.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    return this.userRepository.updateProfile(userId, {
      ...(dto.displayName && { displayName: dto.displayName }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
    });
  }

  /**
   * Change current user's password, revoke existing sessions, and issue fresh token pair.
   * @throws UnauthorizedException INVALID_CREDENTIALS
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    jti?: string,
    jwtExpiresAt?: Date,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const isCurrentValid = await this.passwordService.verify(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const newHash = await this.passwordService.hash(dto.newPassword);
    await this.userRepository.updatePassword(userId, newHash);
    await this.tokenRepository.revokeAllByUserId(userId);

    if (jti && jwtExpiresAt) {
      await this.blacklistService.blacklist(jti, jwtExpiresAt);
    }

    const tokens = await this.issueTokenPair(user, ipAddress, userAgent);

    this.logger.log(
      `Password changed for user: ${userId} (other sessions revoked, fresh tokens issued)`,
    );

    return tokens;
  }

  // ─── Private Helpers ──────────────────────────────────────────

  /**
   * Helper to issue access and refresh token pair.
   */
  async issueTokenPair(
    user: User,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const accessToken = this.jwtTokenService.generateAccessToken(user);
    const rawRefreshToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(
      Date.now() + AUTH_CONFIG.refreshToken.expiresInDays * 24 * 60 * 60 * 1000,
    );

    await this.tokenRepository.create({
      userId: user.id,
      tokenHash,
      ipAddress,
      userAgent,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: AUTH_CONFIG.accessToken.expiresInSeconds,
    };
  }

  /**
   * Helper to hash refresh tokens with SHA-256 before storing in DB.
   */
  private hashToken(token: string): string {
    return hashToken(token);
  }

  /**
   * Helper to format standard AuthResponse.
   */
  private buildAuthResponse(user: User, tokens: TokenPair): AuthResponse {
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }
}
