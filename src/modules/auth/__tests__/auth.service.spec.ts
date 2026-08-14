import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AuthService } from '../services/auth.service';
import { PasswordService } from '../services/password.service';
import { JwtTokenService } from '../services/jwt-token.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';
import { RedisService } from '../../../common/redis/redis.service';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { AppException } from '../../../common/exceptions/app.exception';

describe('AuthService', () => {
  let service: AuthService;
  let userRepositoryMock: DeepMockProxy<UserRepository>;
  let tokenRepositoryMock: DeepMockProxy<RefreshTokenRepository>;
  let redisMock: DeepMockProxy<RedisService>;
  let passwordService: PasswordService;
  let blacklistService: TokenBlacklistService;
  let eventEmitter: EventEmitter2;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'user@example.com',
    passwordHash: '$2b$12$hashedpasswordexample',
    displayName: 'John Doe',
    avatarUrl: null,
    googleId: null,
    isEmailVerified: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRefreshToken = {
    id: 'token-uuid-1',
    userId: mockUser.id,
    tokenHash: 'hashedtoken',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    createdAt: new Date(),
    user: mockUser,
  };

  beforeEach(async () => {
    userRepositoryMock = mockDeep<UserRepository>();
    tokenRepositoryMock = mockDeep<RefreshTokenRepository>();
    redisMock = mockDeep<RedisService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        PasswordService,
        JwtTokenService,
        {
          provide: UserRepository,
          useValue: userRepositoryMock,
        },
        {
          provide: RefreshTokenRepository,
          useValue: tokenRepositoryMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
        {
          provide: TokenBlacklistService,
          useValue: {
            blacklist: jest.fn(),
            isBlacklisted: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              return defaultValue ?? null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    passwordService = module.get<PasswordService>(PasswordService);
    blacklistService = module.get<TokenBlacklistService>(TokenBlacklistService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      userRepositoryMock.createUser.mockResolvedValue(mockUser);
      tokenRepositoryMock.create.mockResolvedValue(mockRefreshToken);

      const result = await service.register({
        email: 'user@example.com',
        password: 'SecureP@ss123!',
        displayName: 'John Doe',
      });

      expect(result).toBeDefined();
      expect(result.user.email).toEqual(mockUser.email);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.registered',
        expect.objectContaining({ userId: mockUser.id }),
      );
    });

    it('should throw AppException EMAIL_ALREADY_EXISTS on duplicate email', async () => {
      userRepositoryMock.createUser.mockRejectedValue(
        new AppException(
          'EMAIL_ALREADY_EXISTS',
          'This email is already registered',
          409,
        ),
      );

      await expect(
        service.register({
          email: 'user@example.com',
          password: 'SecureP@ss123!',
          displayName: 'John Doe',
        }),
      ).rejects.toThrow(AppException);
    });
  });

  describe('login', () => {
    it('should login user with correct credentials', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(passwordService, 'verify').mockResolvedValue(true);
      userRepositoryMock.updateLastLogin.mockResolvedValue();
      tokenRepositoryMock.create.mockResolvedValue(mockRefreshToken);

      const result = await service.login({
        email: 'user@example.com',
        password: 'SecureP@ss123!',
      });

      expect(result).toBeDefined();
      expect(result.user.id).toEqual(mockUser.id);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.logged_in',
        expect.objectContaining({ userId: mockUser.id }),
      );
    });

    it('should throw UnauthorizedException on wrong email', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'SecureP@ss123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(passwordService, 'verify').mockResolvedValue(false);

      await expect(
        service.login({
          email: 'user@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens when given valid refresh token', async () => {
      tokenRepositoryMock.findByTokenHashWithUser.mockResolvedValue(
        mockRefreshToken,
      );
      tokenRepositoryMock.updateToken.mockResolvedValue(mockRefreshToken);

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(tokenRepositoryMock.updateToken).toHaveBeenCalled();
    });

    it('should throw REFRESH_TOKEN_EXPIRED if expired', async () => {
      const expiredToken = {
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000),
      };
      tokenRepositoryMock.findByTokenHashWithUser.mockResolvedValue(
        expiredToken,
      );

      await expect(
        service.refreshTokens('expired-refresh-token'),
      ).rejects.toThrow('REFRESH_TOKEN_EXPIRED');
    });

    it('should throw TOKEN_INVALID if token is already revoked', async () => {
      const revokedToken = {
        ...mockRefreshToken,
        revokedAt: new Date(),
      };
      tokenRepositoryMock.findByTokenHashWithUser.mockResolvedValue(
        revokedToken,
      );

      await expect(
        service.refreshTokens('revoked-refresh-token'),
      ).rejects.toThrow('TOKEN_INVALID');
    });
  });

  describe('logout', () => {
    it('should revoke refresh token and blacklist access token if provided', async () => {
      tokenRepositoryMock.revokeByTokenHash.mockResolvedValue();
      const expDate = new Date();

      await service.logout('refresh-token-string', 'jwt-jti-1', expDate);

      expect(tokenRepositoryMock.revokeByTokenHash).toHaveBeenCalled();
      expect(blacklistService.blacklist).toHaveBeenCalledWith(
        'jwt-jti-1',
        expDate,
      );
    });
  });

  describe('logoutAllDevices', () => {
    it('should revoke all refresh tokens for a user and blacklist access token', async () => {
      tokenRepositoryMock.revokeAllByUserId.mockResolvedValue();
      const expDate = new Date();

      await service.logoutAllDevices(mockUser.id, 'jwt-jti-1', expDate);

      expect(tokenRepositoryMock.revokeAllByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(blacklistService.blacklist).toHaveBeenCalledWith(
        'jwt-jti-1',
        expDate,
      );
    });
  });

  describe('forgotPassword', () => {
    it('should create reset token in Redis and emit event for existing user', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(mockUser);
      redisMock.set.mockResolvedValue('OK');

      await service.forgotPassword('user@example.com');

      expect(redisMock.set).toHaveBeenCalledWith(
        expect.stringMatching(/^password_reset:/),
        mockUser.id,
        'EX',
        3600,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.password_reset_requested',
        expect.objectContaining({ email: mockUser.email }),
      );
    });

    it('should resolve silently for non-existent user email', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.forgotPassword('unknown@example.com'),
      ).resolves.toBeUndefined();

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid Redis token and return fresh tokens', async () => {
      redisMock.get.mockResolvedValue(mockUser.id);
      userRepositoryMock.findById.mockResolvedValue(mockUser);
      jest
        .spyOn(passwordService, 'hash')
        .mockResolvedValue('newhashedpassword');
      userRepositoryMock.updatePassword.mockResolvedValue(mockUser as any);
      tokenRepositoryMock.revokeAllByUserId.mockResolvedValue();
      tokenRepositoryMock.create.mockResolvedValue({} as any);
      redisMock.del.mockResolvedValue(1);

      const tokens = await service.resetPassword(
        'valid-reset-token',
        'NewSecureP@ss123!',
      );

      expect(userRepositoryMock.updatePassword).toHaveBeenCalledWith(
        mockUser.id,
        'newhashedpassword',
      );
      expect(tokenRepositoryMock.revokeAllByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(redisMock.del).toHaveBeenCalled();
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
    });

    it('should throw TOKEN_INVALID if token is not found in Redis', async () => {
      redisMock.get.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid-token', 'NewSecureP@ss123!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('should verify password, update hash, revoke previous sessions, blacklist old JWT, and issue new tokens', async () => {
      userRepositoryMock.findById.mockResolvedValue(mockUser);
      jest.spyOn(passwordService, 'verify').mockResolvedValue(true);
      jest.spyOn(passwordService, 'hash').mockResolvedValue('newhashedpass');
      userRepositoryMock.updatePassword.mockResolvedValue(mockUser as any);
      tokenRepositoryMock.revokeAllByUserId.mockResolvedValue();
      tokenRepositoryMock.create.mockResolvedValue({} as any);

      const expDate = new Date();
      const tokens = await service.changePassword(
        mockUser.id,
        { currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' },
        'old-jti-1',
        expDate,
        '127.0.0.1',
        'jest',
      );

      expect(passwordService.verify).toHaveBeenCalledWith(
        'OldPassword123!',
        mockUser.passwordHash,
      );
      expect(userRepositoryMock.updatePassword).toHaveBeenCalledWith(
        mockUser.id,
        'newhashedpass',
      );
      expect(tokenRepositoryMock.revokeAllByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(blacklistService.blacklist).toHaveBeenCalledWith(
        'old-jti-1',
        expDate,
      );
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException if current password does not match', async () => {
      userRepositoryMock.findById.mockResolvedValue(mockUser);
      jest.spyOn(passwordService, 'verify').mockResolvedValue(false);

      await expect(
        service.changePassword(mockUser.id, {
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
