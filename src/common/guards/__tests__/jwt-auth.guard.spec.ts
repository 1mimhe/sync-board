import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { JwtTokenService } from '../../../modules/auth/services/jwt-token.service';
import { TokenBlacklistService } from '../../../modules/auth/services/token-blacklist.service';
import type { JwtPayload } from '../../../modules/auth/interfaces/jwt-payload.interface';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtTokenService: jest.Mocked<JwtTokenService>;
  let blacklistService: jest.Mocked<TokenBlacklistService>;

  const createMockContext = (authHeader?: string): { context: ExecutionContext; request: any } => {
    const request: any = {
      headers: {
        ...(authHeader !== undefined ? { authorization: authHeader } : {}),
      },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: JwtTokenService,
          useValue: {
            verifyAccessToken: jest.fn(),
          },
        },
        {
          provide: TokenBlacklistService,
          useValue: {
            isBlacklisted: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtTokenService = module.get(JwtTokenService);
    blacklistService = module.get(TokenBlacklistService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('canActivate', () => {
    it('should throw UnauthorizedException when authorization header is completely missing', async () => {
      const { context } = createMockContext(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('TOKEN_INVALID'),
      );
    });

    it('should throw UnauthorizedException when header does not start with "Bearer "', async () => {
      const { context } = createMockContext('Basic token123');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('TOKEN_INVALID'),
      );
    });

    it('should throw UnauthorizedException when scheme is lowercase "bearer "', async () => {
      const { context } = createMockContext('bearer token123');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('TOKEN_INVALID'),
      );
    });

    it('should throw UnauthorizedException when header is "Bearer" with no token', async () => {
      const { context } = createMockContext('Bearer');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('TOKEN_INVALID'),
      );
    });

    it('should throw UnauthorizedException when jwtTokenService.verifyAccessToken throws', async () => {
      const { context } = createMockContext('Bearer invalid.jwt.token');
      jwtTokenService.verifyAccessToken.mockImplementation(() => {
        throw new UnauthorizedException('TOKEN_EXPIRED');
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('TOKEN_EXPIRED'),
      );
      expect(jwtTokenService.verifyAccessToken).toHaveBeenCalledWith('invalid.jwt.token');
    });

    it('should throw UnauthorizedException("TOKEN_REVOKED") when token is blacklisted', async () => {
      const { context } = createMockContext('Bearer valid.jwt.token');
      const mockPayload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        jti: 'jti-123',
      };
      jwtTokenService.verifyAccessToken.mockReturnValue(mockPayload);
      blacklistService.isBlacklisted.mockResolvedValue(true);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('TOKEN_REVOKED'),
      );
      expect(blacklistService.isBlacklisted).toHaveBeenCalledWith('jti-123');
    });

    it('should attach user payload to request and return true on success', async () => {
      const { context, request } = createMockContext('Bearer valid.jwt.token');
      const mockPayload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        jti: 'jti-123',
      };
      jwtTokenService.verifyAccessToken.mockReturnValue(mockPayload);
      blacklistService.isBlacklisted.mockResolvedValue(false);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.user).toEqual(mockPayload);
      expect(jwtTokenService.verifyAccessToken).toHaveBeenCalledWith('valid.jwt.token');
      expect(blacklistService.isBlacklisted).toHaveBeenCalledWith('jti-123');
    });
  });
});
