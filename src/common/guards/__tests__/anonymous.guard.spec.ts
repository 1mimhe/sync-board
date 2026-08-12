import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, MockProxy } from 'jest-mock-extended';
import { createHash } from 'crypto';
import { AnonymousGuard } from '../anonymous.guard';
import { JwtTokenService } from '../../../modules/auth/services/jwt-token.service';
import { TokenBlacklistService } from '../../../modules/auth/services/token-blacklist.service';
import { RefreshTokenRepository } from '../../../modules/auth/repositories/refresh-token.repository';
import { RefreshToken } from '@prisma/client';

describe('AnonymousGuard', () => {
  let guard: AnonymousGuard;
  let jwtTokenServiceMock: MockProxy<JwtTokenService>;
  let blacklistServiceMock: MockProxy<TokenBlacklistService>;
  let refreshTokenRepositoryMock: MockProxy<RefreshTokenRepository>;

  const mockRefreshToken: RefreshToken = {
    id: 'token-uuid-1',
    userId: 'user-uuid-1',
    tokenHash: createHash('sha256').update('raw-refresh-token').digest('hex'),
    familyId: 'family-uuid-1',
    replacedBy: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(),
  };

  const createMockContext = (request: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    jwtTokenServiceMock = mockDeep<JwtTokenService>();
    blacklistServiceMock = mockDeep<TokenBlacklistService>();
    refreshTokenRepositoryMock = mockDeep<RefreshTokenRepository>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnonymousGuard,
        { provide: JwtTokenService, useValue: jwtTokenServiceMock },
        { provide: TokenBlacklistService, useValue: blacklistServiceMock },
        {
          provide: RefreshTokenRepository,
          useValue: refreshTokenRepositoryMock,
        },
      ],
    }).compile();

    guard = module.get<AnonymousGuard>(AnonymousGuard);
  });

  it('should allow access if no authorization header or refresh token is present', async () => {
    const context = createMockContext({ headers: {}, cookies: {} });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if valid non-blacklisted access token is present', async () => {
    const context = createMockContext({
      headers: { authorization: 'Bearer valid-access-token' },
    });

    jwtTokenServiceMock.verifyAccessToken.mockReturnValue({
      sub: 'user-uuid-1',
      email: 'user@example.com',
      jti: 'jti-1',
      exp: 1000,
    });
    blacklistServiceMock.isBlacklisted.mockResolvedValue(false);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('ALREADY_AUTHENTICATED'),
    );
  });

  it('should continue to refresh token check if access token is blacklisted', async () => {
    const context = createMockContext({
      headers: { authorization: 'Bearer blacklisted-access-token' },
      cookies: {},
    });

    jwtTokenServiceMock.verifyAccessToken.mockReturnValue({
      sub: 'user-uuid-1',
      email: 'user@example.com',
      jti: 'jti-1',
      exp: 1000,
    });
    blacklistServiceMock.isBlacklisted.mockResolvedValue(true);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should continue to refresh token check if access token is invalid or expired', async () => {
    const context = createMockContext({
      headers: { authorization: 'Bearer expired-access-token' },
      cookies: {},
    });

    jwtTokenServiceMock.verifyAccessToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if valid refresh token is present in cookies', async () => {
    const context = createMockContext({
      headers: {},
      cookies: { refreshToken: 'raw-refresh-token' },
    });

    refreshTokenRepositoryMock.findByTokenHash.mockResolvedValue(
      mockRefreshToken,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('ALREADY_AUTHENTICATED'),
    );
  });

  it('should allow access if refresh token is expired', async () => {
    const context = createMockContext({
      headers: {},
      cookies: { refreshToken: 'raw-refresh-token' },
    });

    refreshTokenRepositoryMock.findByTokenHash.mockResolvedValue({
      ...mockRefreshToken,
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access if refresh token is revoked', async () => {
    const context = createMockContext({
      headers: {},
      cookies: { refreshToken: 'raw-refresh-token' },
    });

    refreshTokenRepositoryMock.findByTokenHash.mockResolvedValue({
      ...mockRefreshToken,
      revokedAt: new Date(), // Revoked
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });
});
