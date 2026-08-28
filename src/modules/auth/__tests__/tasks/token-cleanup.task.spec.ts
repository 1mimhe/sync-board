import { Test, TestingModule } from '@nestjs/testing';
import { TokenCleanupTask } from '../../tasks/token-cleanup.task';
import { RefreshTokenRepository } from '../../repositories/refresh-token.repository';

describe('TokenCleanupTask', () => {
  let task: TokenCleanupTask;
  let tokenRepo: jest.Mocked<RefreshTokenRepository>;

  beforeEach(async () => {
    tokenRepo = {
      deleteExpiredTokens: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokenRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenCleanupTask,
        { provide: RefreshTokenRepository, useValue: tokenRepo },
      ],
    }).compile();

    task = module.get<TokenCleanupTask>(TokenCleanupTask);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleTokenCleanup', () => {
    it('should delete tokens older than 30 days and log count', async () => {
      tokenRepo.deleteExpiredTokens.mockResolvedValue(42);

      await task.handleTokenCleanup();

      expect(tokenRepo.deleteExpiredTokens).toHaveBeenCalledWith(
        expect.any(Date),
      );
      const cutoffDate = tokenRepo.deleteExpiredTokens.mock.calls[0][0];
      const approxThirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(cutoffDate.getTime() - approxThirtyDaysAgo)).toBeLessThan(
        1000,
      );
    });
  });
});
