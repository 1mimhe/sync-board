import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Prisma } from '@prisma/client';
import { AuthService } from '../../services/auth.service';
import { PasswordService } from '../../services/password.service';
import { JwtTokenService } from '../../services/jwt-token.service';
import { TokenBlacklistService } from '../../services/token-blacklist.service';
import { RedisService } from '../../../../common/redis/redis.service';
import { UserRepository } from '../../repositories/user.repository';
import { RefreshTokenRepository } from '../../repositories/refresh-token.repository';
import { AppException } from '../../../../common/exceptions/app.exception';

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
    familyId: 'fam-1',
    replacedBy: null,
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
      expect(tokenRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: expect.any(String) }),
      );
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
    it('should rotate the token chain when given a valid refresh token', async () => {
      const successor = {
        ...mockRefreshToken,
        id: 'token-uuid-2',
        tokenHash: 'new-hashedtoken',
      };
      tokenRepositoryMock.findByTokenHashWithUser.mockResolvedValue(
        mockRefreshToken,
      );
      tokenRepositoryMock.rotate.mockResolvedValue(successor);

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe('valid-refresh-token');
      expect(tokenRepositoryMock.rotate).toHaveBeenCalledWith(
        mockRefreshToken.id,
        expect.objectContaining({
          userId: mockUser.id,
          familyId: 'fam-1',
          ipAddress: undefined,
          userAgent: undefined,
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('should revoke the whole family and throw TOKEN_REUSE_DETECTED on revoked token replay', async () => {
      const revokedToken = {
        ...mockRefreshToken,
        revokedAt: new Date(),
      };
      tokenRepositoryMock.findByTokenHashWithUser.mockResolvedValue(
        revokedToken,
      );
      tokenRepositoryMock.revokeFamily.mockResolvedValue(2);

      await expect(
        service.refreshTokens('revoked-refresh-token'),
      ).rejects.toThrow('TOKEN_REUSE_DETECTED');

      expect(tokenRepositoryMock.revokeFamily).toHaveBeenCalledTimes(1);
      expect(tokenRepositoryMock.revokeFamily).toHaveBeenCalledWith('fam-1');
      expect(tokenRepositoryMock.rotate).not.toHaveBeenCalled();
    });

    it('should throw REFRESH_TOKEN_EXPIRED if expired without rotating', async () => {
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
      expect(tokenRepositoryMock.rotate).not.toHaveBeenCalled();
    });

    it('should throw TOKEN_INVALID for unknown hash without rotating', async () => {
      tokenRepositoryMock.findByTokenHashWithUser.mockResolvedValue(null);

      await expect(
        service.refreshTokens('unknown-refresh-token'),
      ).rejects.toThrow('TOKEN_INVALID');
      expect(tokenRepositoryMock.rotate).not.toHaveBeenCalled();
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
    it('should reset password with valid single-use Redis token and return fresh tokens', async () => {
      redisMock.getdel.mockResolvedValue(mockUser.id);
      userRepositoryMock.findById.mockResolvedValue(mockUser);
      jest
        .spyOn(passwordService, 'hash')
        .mockResolvedValue('newhashedpassword');
      userRepositoryMock.updatePassword.mockResolvedValue(mockUser as any);
      tokenRepositoryMock.revokeAllByUserId.mockResolvedValue();
      tokenRepositoryMock.create.mockResolvedValue({} as any);

      const tokens = await service.resetPassword(
        'valid-reset-token',
        'NewSecureP@ss123!',
      );

      expect(redisMock.getdel).toHaveBeenCalledWith(
        expect.stringMatching(/^password_reset:/),
      );
      expect(userRepositoryMock.updatePassword).toHaveBeenCalledWith(
        mockUser.id,
        'newhashedpassword',
      );
      expect(tokenRepositoryMock.revokeAllByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
    });

    it('should throw TOKEN_INVALID if token is not found in Redis', async () => {
      redisMock.getdel.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid-token', 'NewSecureP@ss123!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw TOKEN_INVALID when a consumed (replayed) token is reused', async () => {
      // First call consumes the key atomically; replay finds nothing
      redisMock.getdel
        .mockResolvedValueOnce(mockUser.id)
        .mockResolvedValueOnce(null);
      userRepositoryMock.findById.mockResolvedValue(mockUser);
      jest.spyOn(passwordService, 'hash').mockResolvedValue('hashed');
      userRepositoryMock.updatePassword.mockResolvedValue(mockUser as any);
      tokenRepositoryMock.revokeAllByUserId.mockResolvedValue();
      tokenRepositoryMock.create.mockResolvedValue({} as any);

      await service.resetPassword('valid-reset-token', 'NewSecureP@ss123!');
      await expect(
        service.resetPassword('valid-reset-token', 'AnotherP@ss123!'),
      ).rejects.toThrow('TOKEN_INVALID');
    });

    it('should throw USER_NOT_FOUND if user not found in db during reset', async () => {
      redisMock.getdel.mockResolvedValue('missing-user-id');
      userRepositoryMock.findById.mockResolvedValue(null);

      await expect(
        service.resetPassword('valid-token', 'NewSecureP@ss123!'),
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

    it('should throw UnauthorizedException if user not found or passwordHash missing', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);

      await expect(
        service.changePassword('missing-user', {
          currentPassword: 'pass',
          newPassword: 'new',
        }),
      ).rejects.toThrow(UnauthorizedException);
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

  describe('Google OAuth', () => {
    describe('findOrCreateGoogleUser', () => {
      it('should throw UnauthorizedException if email is missing', async () => {
        await expect(
          service.findOrCreateGoogleUser({
            googleId: 'g-1',
            email: '',
            displayName: 'Test',
          }),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('should update user if googleId already matches', async () => {
        userRepositoryMock.findByGoogleId.mockResolvedValue(mockUser);
        userRepositoryMock.updateGoogleLogin.mockResolvedValue(mockUser);

        const result = await service.findOrCreateGoogleUser({
          googleId: 'g-1',
          email: 'user@example.com',
          displayName: 'John',
        });

        expect(result).toEqual(mockUser);
        expect(userRepositoryMock.updateGoogleLogin).toHaveBeenCalled();
      });

      it('should link googleId if email already exists', async () => {
        userRepositoryMock.findByGoogleId.mockResolvedValue(null);
        userRepositoryMock.findByEmail.mockResolvedValue(mockUser);
        userRepositoryMock.updateGoogleLogin.mockResolvedValue(mockUser);

        const result = await service.findOrCreateGoogleUser({
          googleId: 'g-1',
          email: 'user@example.com',
          displayName: 'John',
        });

        expect(result).toEqual(mockUser);
        expect(userRepositoryMock.updateGoogleLogin).toHaveBeenCalled();
      });

      it('should create new google user if neither googleId nor email exists', async () => {
        userRepositoryMock.findByGoogleId.mockResolvedValue(null);
        userRepositoryMock.findByEmail.mockResolvedValue(null);
        userRepositoryMock.createGoogleUser.mockResolvedValue(mockUser);

        const result = await service.findOrCreateGoogleUser({
          googleId: 'g-1',
          email: 'newuser@example.com',
          displayName: 'New User',
        });

        expect(result).toEqual(mockUser);
      });

      it('should fallback to linking account if P2002 happens on createGoogleUser race condition', async () => {
        const p2002Error = new Prisma.PrismaClientKnownRequestError('P2002', {
          code: 'P2002',
          clientVersion: '5.0.0',
        });
        userRepositoryMock.findByGoogleId.mockResolvedValue(null);
        userRepositoryMock.findByEmail
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockUser);
        userRepositoryMock.createGoogleUser.mockRejectedValue(p2002Error);
        userRepositoryMock.updateGoogleLogin.mockResolvedValue(mockUser);

        const result = await service.findOrCreateGoogleUser({
          googleId: 'g-1',
          email: 'user@example.com',
          displayName: 'John',
        });

        expect(result).toEqual(mockUser);
      });

      it('should rethrow the P2002 error when the fallback lookup finds no user', async () => {
        const p2002Error = new Prisma.PrismaClientKnownRequestError('P2002', {
          code: 'P2002',
          clientVersion: '5.0.0',
        });
        userRepositoryMock.findByGoogleId.mockResolvedValue(null);
        userRepositoryMock.findByEmail.mockResolvedValue(null);
        userRepositoryMock.createGoogleUser.mockRejectedValue(p2002Error);

        await expect(
          service.findOrCreateGoogleUser({
            googleId: 'g-1',
            email: 'vanishing@example.com',
            displayName: 'Ghost',
          }),
        ).rejects.toBe(p2002Error);
      });
    });

    describe('handleGoogleCallback', () => {
      it('should issue tokens and emit user.logged_in event', async () => {
        tokenRepositoryMock.create.mockResolvedValue(mockRefreshToken);

        const result = await service.handleGoogleCallback(mockUser, '127.0.0.1', 'agent');
        expect(result.tokens).toBeDefined();
        expect(eventEmitter.emit).toHaveBeenCalledWith('user.logged_in', {
          userId: mockUser.id,
          method: 'google',
        });
      });
    });
  });

  describe('User profile & summary methods', () => {
    it('should return profile by id or throw NotFoundException', async () => {
      const { passwordHash, ...publicUser } = mockUser;
      userRepositoryMock.findByIdPublic.mockResolvedValue(publicUser as any);

      const res = await service.getProfile('user-1');
      expect(res).toEqual(publicUser);

      userRepositoryMock.findByIdPublic.mockResolvedValue(null);
      await expect(service.getProfile('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('should find user by email', async () => {
      userRepositoryMock.findByEmail.mockResolvedValue(mockUser);
      const res = await service.getUserByEmail('user@example.com');
      expect(res).toEqual(mockUser);
    });

    it('should find user summary by email', async () => {
      const summary = { id: 'u-1', email: 'u@example.com', displayName: 'U', avatarUrl: null };
      userRepositoryMock.findUserSummaryByEmail.mockResolvedValue(summary);
      const res = await service.findUserSummaryByEmail('u@example.com');
      expect(res).toEqual(summary);
    });

    it('should update profile', async () => {
      const updated = { id: 'u-1', displayName: 'New Name' };
      userRepositoryMock.updateProfile.mockResolvedValue(updated as any);

      const res = await service.updateProfile('u-1', { displayName: 'New Name' });
      expect(res).toEqual(updated);
    });
  });

  describe('getGoogleAuthUrl', () => {
    it('should generate Google OAuth URL with state param stored in Redis', async () => {
      redisMock.set.mockResolvedValue('OK');

      const result = await service.getGoogleAuthUrl();

      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.url).toContain('state=');
      expect(redisMock.set).toHaveBeenCalledWith(
        expect.stringMatching(/^oauth:state:/),
        '1',
        'EX',
        600,
      );
    });
  });

  describe('validateOAuthState', () => {
    it('should validate and consume state from Redis successfully', async () => {
      redisMock.exists.mockResolvedValue(1);
      redisMock.del.mockResolvedValue(1);

      await expect(
        service.validateOAuthState('valid-state'),
      ).resolves.toBeUndefined();
      expect(redisMock.exists).toHaveBeenCalledWith('oauth:state:valid-state');
      expect(redisMock.del).toHaveBeenCalledWith('oauth:state:valid-state');
    });

    it('should throw UnauthorizedException if state is missing', async () => {
      await expect(service.validateOAuthState(undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if state does not exist in Redis', async () => {
      redisMock.exists.mockResolvedValue(0);

      await expect(
        service.validateOAuthState('unknown-state'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
