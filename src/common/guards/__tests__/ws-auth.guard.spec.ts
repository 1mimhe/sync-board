import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { WsAuthGuard } from '../ws-auth.guard';
import { TokenBlacklistService } from '../../../modules/auth/services/token-blacklist.service';
import type { Socket } from 'socket.io';

describe('WsAuthGuard', () => {
  let guard: WsAuthGuard;
  let blacklistService: DeepMockProxy<TokenBlacklistService>;

  beforeEach(() => {
    blacklistService = mockDeep<TokenBlacklistService>();
    guard = new WsAuthGuard(blacklistService);
  });

  const createMockContext = (
    socketData?: unknown,
    socketId = 'sock-123',
  ): ExecutionContext => {
    const mockSocket = {
      id: socketId,
      data: socketData,
    } as unknown as Socket;

    return {
      switchToWs: () => ({
        getClient: () => mockSocket,
        getData: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access when socket has valid authenticated user and token is not blacklisted', async () => {
    blacklistService.isBlacklisted.mockResolvedValue(false);

    const context = createMockContext({
      user: {
        sub: 'user-uuid',
        email: 'test@example.com',
        displayName: 'Test User',
        jti: 'token-jti-123',
      },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(blacklistService.isBlacklisted).toHaveBeenCalledWith(
      'token-jti-123',
    );
  });

  it('should throw WsException when socket has no authenticated user', async () => {
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(WsException);

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(WsException);
      const err = (error as WsException).getError() as {
        code: string;
        message: string;
      };
      expect(err.code).toBe('TOKEN_INVALID');
      expect(err.message).toBe('Authentication required');
    }
  });

  it('should throw WsException when token is blacklisted in Redis', async () => {
    blacklistService.isBlacklisted.mockResolvedValue(true);

    const context = createMockContext({
      user: {
        sub: 'user-uuid',
        email: 'test@example.com',
        displayName: 'Test User',
        jti: 'revoked-jti',
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(WsException);

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(WsException);
      const err = (error as WsException).getError() as {
        code: string;
        message: string;
      };
      expect(err.code).toBe('TOKEN_REVOKED');
      expect(err.message).toBe('Token has been revoked');
    }
  });

  it('should throw WsException when the user has not verified their email', async () => {
    blacklistService.isBlacklisted.mockResolvedValue(false);

    const context = createMockContext({
      user: {
        sub: 'user-uuid',
        email: 'test@example.com',
        displayName: 'Test User',
        jti: 'token-jti-123',
        isEmailVerified: false,
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(WsException);

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(WsException);
      const err = (error as WsException).getError() as {
        code: string;
        message: string;
      };
      expect(err.code).toBe('EMAIL_NOT_VERIFIED');
    }
  });

  it('should allow access when the user has verified their email', async () => {
    blacklistService.isBlacklisted.mockResolvedValue(false);

    const context = createMockContext({
      user: {
        sub: 'user-uuid',
        email: 'test@example.com',
        displayName: 'Test User',
        jti: 'token-jti-123',
        isEmailVerified: true,
      },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
