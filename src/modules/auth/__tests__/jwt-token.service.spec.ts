import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtTokenService } from '../services/jwt-token.service';
import { User } from '@prisma/client';

describe('JwtTokenService', () => {
  let service: JwtTokenService;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    passwordHash: 'hash',
    displayName: 'Test User',
    avatarUrl: null,
    googleId: null,
    isEmailVerified: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtTokenService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'JWT_SECRET') return 'test-secret-key-12345';
              return defaultValue ?? null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<JwtTokenService>(JwtTokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a valid JWT access token for a user', () => {
    const token = service.generateAccessToken(mockUser);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('should verify and decode a valid access token', () => {
    const userWithAvatar: User = {
      ...mockUser,
      avatarUrl: 'https://example.com/avatar.png',
    };
    const token = service.generateAccessToken(userWithAvatar);
    const payload = service.verifyAccessToken(token);

    expect(payload).toBeDefined();
    expect(payload.sub).toEqual(userWithAvatar.id);
    expect(payload.email).toEqual(userWithAvatar.email);
    expect(payload.displayName).toEqual(userWithAvatar.displayName);
    expect(payload.avatarUrl).toEqual('https://example.com/avatar.png');
    expect(payload.iss).toEqual('syncboard');
    expect(payload.jti).toBeDefined();
  });

  it('should throw UnauthorizedException for tampered or invalid token', () => {
    const invalidToken = 'invalid.jwt.token';

    expect(() => service.verifyAccessToken(invalidToken)).toThrow(
      UnauthorizedException,
    );
  });
});
