import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { WsRateLimiterService } from '../../services/ws-rate-limiter.service';
import { RedisService } from '../../../../../common/redis/redis.service';

describe('WsRateLimiterService', () => {
  let service: WsRateLimiterService;
  let redisService: DeepMockProxy<RedisService>;
  let mockPipeline: any;

  beforeEach(async () => {
    mockPipeline = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    redisService = mockDeep<RedisService>();
    redisService.pipeline.mockReturnValue(mockPipeline);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsRateLimiterService,
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<WsRateLimiterService>(WsRateLimiterService);
  });

  describe('checkRateLimit', () => {
    it('should allow operation when count is within the limit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0], // zremrangebyscore
        [null, 1], // zadd
        [null, 5], // zcard count = 5
        [null, 1], // expire
      ]);

      const allowed = await service.checkRateLimit('user-1', 'join', 10, 60000);

      expect(allowed).toBe(true);
      expect(mockPipeline.zremrangebyscore).toHaveBeenCalled();
      expect(mockPipeline.zadd).toHaveBeenCalled();
      expect(mockPipeline.zcard).toHaveBeenCalled();
      expect(mockPipeline.expire).toHaveBeenCalledWith('ratelimit:ws:user-1:join', 60);
    });

    it('should block operation when count exceeds the limit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 1],
        [null, 11], // count = 11 > limit 10
        [null, 1],
      ]);

      const allowed = await service.checkRateLimit('user-1', 'join', 10, 60000);

      expect(allowed).toBe(false);
    });

    it('should fail-open and return true if Redis pipeline returns null', async () => {
      mockPipeline.exec.mockResolvedValue(null);

      const allowed = await service.checkRateLimit('user-1', 'cursor', 20, 60000);

      expect(allowed).toBe(true);
    });

    it('should use distinct keys for different users and event categories', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 1],
        [null, 1],
        [null, 1],
      ]);

      await service.checkRateLimit('user-abc', 'cursor', 20, 60000);
      expect(mockPipeline.expire).toHaveBeenCalledWith('ratelimit:ws:user-abc:cursor', 60);

      await service.checkRateLimit('user-xyz', 'board', 60, 60000);
      expect(mockPipeline.expire).toHaveBeenCalledWith('ratelimit:ws:user-xyz:board', 60);
    });
  });
});
