import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { WsRateLimitGuard } from '../ws-rate-limit.guard';
import { WsRateLimiterService } from '../../../modules/board/services/ws-rate-limiter.service';

describe('WsRateLimitGuard', () => {
  let guard: WsRateLimitGuard;
  let reflector: DeepMockProxy<Reflector>;
  let rateLimiter: DeepMockProxy<WsRateLimiterService>;
  let mockContext: DeepMockProxy<ExecutionContext>;
  let mockWsContext: any;
  let mockSocket: any;

  beforeEach(() => {
    reflector = mockDeep<Reflector>();
    rateLimiter = mockDeep<WsRateLimiterService>();
    guard = new WsRateLimitGuard(reflector, rateLimiter);

    mockSocket = {
      id: 'socket-123',
      data: {
        user: {
          sub: 'user-uuid-123',
        },
      },
    };

    mockWsContext = {
      getClient: jest.fn().mockReturnValue(mockSocket),
      getData: jest.fn().mockReturnValue({}),
    };

    mockContext = mockDeep<ExecutionContext>();
    mockContext.switchToWs.mockReturnValue(mockWsContext);
    mockContext.getHandler.mockReturnValue({} as any);
    mockContext.getClass.mockReturnValue({} as any);
  });

  it('should allow execution when no @WsRateLimit metadata is defined', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
    expect(rateLimiter.checkRateLimit).not.toHaveBeenCalled();
  });

  it('should allow execution when rate limit is not exceeded', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      category: 'join',
      limit: 10,
      windowMs: 60000,
      silent: false,
    });
    rateLimiter.checkRateLimit.mockResolvedValue(true);

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
    expect(rateLimiter.checkRateLimit).toHaveBeenCalledWith(
      'user-uuid-123',
      'join',
      10,
      60000,
    );
  });

  it('should throw WsException with RATE_LIMIT_EXCEEDED when limit is breached and silent is false', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      category: 'join',
      limit: 10,
      windowMs: 60000,
      silent: false,
    });
    rateLimiter.checkRateLimit.mockResolvedValue(false);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(WsException);

    try {
      await guard.canActivate(mockContext);
    } catch (error) {
      expect(error).toBeInstanceOf(WsException);
      const wsErr = (error as WsException).getError() as {
        code: string;
        message: string;
      };
      expect(wsErr.code).toBe('RATE_LIMIT_EXCEEDED');
    }
  });

  it('should return false silently when limit is breached and silent is true (e.g. cursor events)', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      category: 'cursor',
      limit: 20,
      windowMs: 1000,
      silent: true,
    });
    rateLimiter.checkRateLimit.mockResolvedValue(false);

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(false);
  });

  it('should throw TOKEN_INVALID if user is not present in socket data when non-silent', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      category: 'join',
      limit: 10,
      windowMs: 60000,
      silent: false,
    });
    mockSocket.data = {};

    await expect(guard.canActivate(mockContext)).rejects.toThrow(WsException);
  });
});
