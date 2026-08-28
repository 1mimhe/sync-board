import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EmailVerifiedGuard } from '../email-verified.guard';
import { UserRepository } from '../../../modules/auth/repositories/user.repository';
import { RedisService } from '../../redis/redis.service';

describe('EmailVerifiedGuard', () => {
  let guard: EmailVerifiedGuard;
  let reflector: Reflector;
  let userRepository: DeepMockProxy<UserRepository>;
  let redis: DeepMockProxy<RedisService>;

  interface MockRequest {
    method: string;
    url: string;
    user?: Record<string, unknown>;
  }

  const createContext = (
    method = 'POST',
    user?: Record<string, unknown>,
  ): { context: ExecutionContext; request: MockRequest } => {
    const request: MockRequest = { method, url: '/api/test', user };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  beforeEach(() => {
    reflector = new Reflector();
    userRepository = mockDeep<UserRepository>();
    redis = mockDeep<RedisService>();
    guard = new EmailVerifiedGuard(reflector, userRepository, redis);
  });

  describe('skip metadata', () => {
    it('should allow access when @SkipEmailVerification() is applied', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const { context } = createContext('POST', {
        sub: 'u-1',
        isEmailVerified: false,
      });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(userRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('authenticated user checks', () => {
    it('should allow access when no user is attached (JwtAuthGuard responsibility)', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const { context } = createContext('POST');
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when the JWT claim says verified', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const { context } = createContext('POST', {
        sub: 'u-1',
        isEmailVerified: true,
      });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw EMAIL_NOT_VERIFIED (403) for unverified users on mutating requests', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      redis.get.mockResolvedValue(null);
      userRepository.findById.mockResolvedValue({
        id: 'u-1',
        isEmailVerified: false,
      } as never);

      const { context } = createContext('POST', {
        sub: 'u-1',
        isEmailVerified: false,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).message).toBe(
          'EMAIL_NOT_VERIFIED',
        );
        expect((error as ForbiddenException).getStatus()).toBe(403);
      }
    });

    it.each(['GET', 'HEAD', 'OPTIONS'])(
      'should allow read-only %s requests for unverified users',
      async (method) => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

        const { context } = createContext(method, {
          sub: 'u-1',
          isEmailVerified: false,
        });
        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(userRepository.findById).not.toHaveBeenCalled();
      },
    );
  });

  describe('stale-claim DB re-check', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    });

    it('should allow access when the DB shows the user verified after token issuance', async () => {
      redis.get.mockResolvedValue(null);
      userRepository.findById.mockResolvedValue({
        id: 'u-1',
        isEmailVerified: true,
      } as never);

      const { context } = createContext('DELETE', {
        sub: 'u-1',
        isEmailVerified: false,
      });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        'email_verified:u-1',
        '1',
        'EX',
        300,
      );
    });

    it('should serve subsequent checks from the Redis cache without hitting the DB', async () => {
      redis.get.mockResolvedValue('1');

      const { context } = createContext('DELETE', {
        sub: 'u-1',
        isEmailVerified: false,
      });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it('should still deny access when the Redis cache lookup fails and DB says unverified', async () => {
      redis.get.mockRejectedValue(new Error('redis down'));
      userRepository.findById.mockResolvedValue({
        id: 'u-1',
        isEmailVerified: false,
      } as never);

      const { context } = createContext('POST', {
        sub: 'u-1',
        isEmailVerified: false,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
