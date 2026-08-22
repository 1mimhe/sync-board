import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AnonymousGuard } from '../../../common/guards/anonymous.guard';
import { REFRESH_TOKEN_COOKIE_NAME } from '../auth.constants';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let mockRes: Partial<Response>;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: null,
    isEmailVerified: true,
    createdAt: new Date(),
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 900,
  };

  const mockTokenResponse = {
    accessToken: 'mock-access-token',
    expiresIn: 900,
  };

  const mockAuthResponse = {
    user: mockUser,
    tokens: mockTokens,
  };

  const mockExpectedAuthResponse = {
    user: mockUser,
    tokens: mockTokenResponse,
  };

  beforeEach(async () => {
    mockRes = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      logoutAllDevices: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      getGoogleAuthUrl: jest.fn(),
      validateOAuthState: jest.fn(),
      handleGoogleCallback: jest.fn(),
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AnonymousGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthGuard('google'))
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('register', () => {
    it('should register user and set refresh token cookie', async () => {
      authService.register.mockResolvedValue(mockAuthResponse);

      const result = await controller.register(
        {
          email: 'test@example.com',
          password: 'P@ssword123',
          displayName: 'Test User',
        },
        { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } } as any,
        mockRes as Response,
      );

      expect(result).toEqual(mockExpectedAuthResponse);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        mockTokens.refreshToken,
        expect.any(Object),
      );
    });
  });

  describe('login', () => {
    it('should authenticate user and set refresh token cookie', async () => {
      authService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(
        { email: 'test@example.com', password: 'P@ssword123' },
        { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } } as any,
        mockRes as Response,
      );

      expect(result).toEqual(mockExpectedAuthResponse);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        mockTokens.refreshToken,
        expect.any(Object),
      );
    });
  });

  describe('refresh', () => {
    it('should refresh tokens when cookie is present', async () => {
      authService.refreshTokens.mockResolvedValue(mockTokens);

      const req = {
        cookies: { [REFRESH_TOKEN_COOKIE_NAME]: 'old-refresh-token' },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as any;

      const result = await controller.refresh(req, mockRes as Response);

      expect(result).toEqual(mockTokenResponse);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        mockTokens.refreshToken,
        expect.any(Object),
      );
    });
  });

  describe('logout', () => {
    it('should logout single device and clear cookie', async () => {
      const req = {
        cookies: { [REFRESH_TOKEN_COOKIE_NAME]: 'active-token' },
      } as any;
      const user = { sub: 'user-uuid-1', jti: 'jti-1', exp: 1700000000 };

      await controller.logout(req, mockRes as Response, user as any);

      expect(authService.logout).toHaveBeenCalledWith(
        'active-token',
        'jti-1',
        expect.any(Date),
      );
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        expect.any(Object),
      );
    });
  });

  describe('changePassword', () => {
    it('should change password, issue new tokens, and set refresh cookie', async () => {
      authService.changePassword.mockResolvedValue(mockTokens);
      const user = { sub: 'user-uuid-1', jti: 'jti-1', exp: 1700000000 };
      const req = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as any;

      const result = await controller.changePassword(
        req,
        mockRes as Response,
        user as any,
        {
          currentPassword: 'OldP@ssword1',
          newPassword: 'NewP@ssword1',
        },
      );

      expect(authService.changePassword).toHaveBeenCalledWith(
        'user-uuid-1',
        { currentPassword: 'OldP@ssword1', newPassword: 'NewP@ssword1' },
        'jti-1',
        expect.any(Date),
        '127.0.0.1',
        'jest',
      );
      expect(result).toEqual(mockTokenResponse);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        mockTokens.refreshToken,
        expect.any(Object),
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password, issue new tokens, and set refresh cookie', async () => {
      authService.resetPassword.mockResolvedValue(mockTokens);
      const req = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as any;

      const result = await controller.resetPassword(req, mockRes as Response, {
        token: 'valid-reset-token',
        newPassword: 'NewP@ssword1',
      });

      expect(authService.resetPassword).toHaveBeenCalledWith(
        'valid-reset-token',
        'NewP@ssword1',
        '127.0.0.1',
        'jest',
      );
      expect(result).toEqual(mockTokenResponse);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        mockTokens.refreshToken,
        expect.any(Object),
      );
    });
  });

  describe('googleAuth', () => {
    it('should return Google OAuth authorization URL', async () => {
      authService.getGoogleAuthUrl.mockResolvedValue({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=123',
      });

      const result = await controller.googleAuth();

      expect(authService.getGoogleAuthUrl).toHaveBeenCalled();
      expect(result).toEqual({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=123',
      });
    });
  });

  describe('googleCallback', () => {
    it('should validate state, handle callback, and set cookie', async () => {
      authService.validateOAuthState.mockResolvedValue();
      authService.handleGoogleCallback.mockResolvedValue({
        user: { id: 'u-1', email: 'g@test.com' } as any,
        tokens: mockTokens,
      });

      const req = {
        query: { state: 'valid-state' },
        user: { id: 'u-1', email: 'g@test.com' },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as any;

      const result = await controller.googleCallback(req, mockRes as Response);

      expect(authService.validateOAuthState).toHaveBeenCalledWith('valid-state');
      expect(authService.handleGoogleCallback).toHaveBeenCalledWith(
        req.user,
        '127.0.0.1',
        'jest',
      );
      expect(result.user).toEqual({ id: 'u-1', email: 'g@test.com' });
      expect(result.tokens).toEqual(mockTokenResponse);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        mockTokens.refreshToken,
        expect.any(Object),
      );
    });
  });
});
