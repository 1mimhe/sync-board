import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleStrategy } from '../../strategies/google.strategy';
import { AuthService } from '../../services/auth.service';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;
  let authService: jest.Mocked<AuthService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'google-client-id-123';
        if (key === 'GOOGLE_CLIENT_SECRET') return 'google-client-secret-123';
        return '';
      }),
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'GOOGLE_CALLBACK_URL') return 'http://localhost:3000/api/auth/google/callback';
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    authService = {
      findOrCreateGoogleUser: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        { provide: ConfigService, useValue: configService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validate', () => {
    it('should extract profile fields, find or create user, and invoke done(null, user)', async () => {
      const mockProfile: any = {
        id: 'google-uid-123',
        displayName: 'Jane Doe',
        emails: [{ value: 'jane@example.com', verified: 'true' }],
        photos: [{ value: 'https://example.com/photo.jpg' }],
      };

      const mockUser: any = {
        id: 'user-uuid-1',
        email: 'jane@example.com',
        displayName: 'Jane Doe',
      };

      authService.findOrCreateGoogleUser.mockResolvedValue(mockUser);
      const doneCallback = jest.fn();

      await strategy.validate('access-token', 'refresh-token', mockProfile, doneCallback);

      expect(authService.findOrCreateGoogleUser).toHaveBeenCalledWith({
        googleId: 'google-uid-123',
        email: 'jane@example.com',
        displayName: 'Jane Doe',
        avatarUrl: 'https://example.com/photo.jpg',
      });
      expect(doneCallback).toHaveBeenCalledWith(null, mockUser);
    });

    it('should fallback displayName to "User" and avatarUrl to undefined when photos/displayName missing', async () => {
      const mockProfile: any = {
        id: 'google-uid-456',
        displayName: undefined,
        emails: [{ value: 'noname@example.com' }],
        photos: undefined,
      };

      const mockUser: any = {
        id: 'user-uuid-2',
        email: 'noname@example.com',
        displayName: 'User',
      };

      authService.findOrCreateGoogleUser.mockResolvedValue(mockUser);
      const doneCallback = jest.fn();

      await strategy.validate('access-token', 'refresh-token', mockProfile, doneCallback);

      expect(authService.findOrCreateGoogleUser).toHaveBeenCalledWith({
        googleId: 'google-uid-456',
        email: 'noname@example.com',
        displayName: 'User',
        avatarUrl: undefined,
      });
      expect(doneCallback).toHaveBeenCalledWith(null, mockUser);
    });

    it('should invoke done with UnauthorizedException when email is missing in profile', async () => {
      const mockProfile: any = {
        id: 'google-uid-789',
        displayName: 'No Email User',
        emails: [],
      };

      const doneCallback = jest.fn();

      await strategy.validate('access-token', 'refresh-token', mockProfile, doneCallback);

      expect(authService.findOrCreateGoogleUser).not.toHaveBeenCalled();
      expect(doneCallback).toHaveBeenCalledWith(
        expect.any(UnauthorizedException),
        undefined,
      );
    });
  });
});
