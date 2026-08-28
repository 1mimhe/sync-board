import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtTokenService } from '../../services/jwt-token.service';
import { User } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

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
    expect(payload.isEmailVerified).toEqual(userWithAvatar.isEmailVerified);
    expect(payload.iss).toEqual('syncboard');
    expect(payload.jti).toBeDefined();
  });

  it('should throw UnauthorizedException with TOKEN_EXPIRED when token has expired', () => {
    const expiredToken = jwt.sign(
      {
        sub: mockUser.id,
        email: mockUser.email,
        displayName: mockUser.displayName,
      },
      'test-secret-key-12345',
      {
        expiresIn: '-1s',
        issuer: 'syncboard',
      },
    );

    expect(() => service.verifyAccessToken(expiredToken)).toThrow(
      new UnauthorizedException('TOKEN_EXPIRED'),
    );
  });

  it('should throw UnauthorizedException for tampered or invalid token', () => {
    const invalidToken = 'invalid.jwt.token';

    expect(() => service.verifyAccessToken(invalidToken)).toThrow(
      UnauthorizedException,
    );
  });

  it('should support RS256 asymmetric keys when key file paths exist', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const privPem = privateKey.export({
      type: 'pkcs1',
      format: 'pem',
    }) as string;
    const pubPem = publicKey.export({ type: 'pkcs1', format: 'pem' }) as string;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jwt-test-'));
    const privPath = path.join(tmpDir, 'private.pem');
    const pubPath = path.join(tmpDir, 'public.pem');

    fs.writeFileSync(privPath, privPem);
    fs.writeFileSync(pubPath, pubPem);

    try {
      const configService = {
        get: jest.fn((key: string) => {
          if (key === 'JWT_PRIVATE_KEY_PATH') return privPath;
          if (key === 'JWT_PUBLIC_KEY_PATH') return pubPath;
          return null;
        }),
      } as unknown as ConfigService;

      const rsaService = new JwtTokenService(configService);
      const token = rsaService.generateAccessToken(mockUser);
      const payload = rsaService.verifyAccessToken(token);

      expect(payload.sub).toBe(mockUser.id);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should fail fast in production if RS256 key files are missing', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_SECRET') return 'test-secret';
        return null;
      }),
    } as unknown as ConfigService;

    expect(() => new JwtTokenService(configService)).toThrow(
      'Production requires RS256 key files (JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH).',
    );
  });

  it('should fail fast if both RSA key files and JWT_SECRET are missing', () => {
    const configService = {
      get: jest.fn(() => null),
    } as unknown as ConfigService;

    expect(() => new JwtTokenService(configService)).toThrow(
      'JWT signing material missing. Provide JWT_PRIVATE_KEY_PATH/JWT_PUBLIC_KEY_PATH (RS256) or JWT_SECRET (HS256) before boot.',
    );
  });
});
