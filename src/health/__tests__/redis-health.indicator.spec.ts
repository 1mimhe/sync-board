import { Test, TestingModule } from '@nestjs/testing';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisHealthIndicator } from '../redis-health.indicator';
import { RedisService } from '../../common/redis/redis.service';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let redisService: jest.Mocked<RedisService>;
  let healthIndicatorService: jest.Mocked<HealthIndicatorService>;
  let mockCheckIndicator: { up: jest.Mock; down: jest.Mock };

  beforeEach(async () => {
    mockCheckIndicator = {
      up: jest.fn().mockReturnValue({ redis: { status: 'up' } }),
      down: jest.fn().mockImplementation((msg) => ({ redis: { status: 'down', message: msg } })),
    };

    healthIndicatorService = {
      check: jest.fn().mockReturnValue(mockCheckIndicator),
    } as unknown as jest.Mocked<HealthIndicatorService>;

    redisService = {
      ping: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        { provide: RedisService, useValue: redisService },
        { provide: HealthIndicatorService, useValue: healthIndicatorService },
      ],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('pingCheck', () => {
    it('should return up status when redis.ping succeeds', async () => {
      redisService.ping.mockResolvedValue('PONG');

      const result = await indicator.pingCheck('redis');

      expect(healthIndicatorService.check).toHaveBeenCalledWith('redis');
      expect(mockCheckIndicator.up).toHaveBeenCalled();
      expect(result).toEqual({ redis: { status: 'up' } });
    });

    it('should return down status when redis.ping throws Error', async () => {
      redisService.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await indicator.pingCheck('redis');

      expect(mockCheckIndicator.down).toHaveBeenCalledWith('Connection refused');
      expect(result).toEqual({ redis: { status: 'down', message: 'Connection refused' } });
    });

    it('should return down status with fallback message when non-Error thrown', async () => {
      redisService.ping.mockRejectedValue('Redis process dead');

      const result = await indicator.pingCheck('redis');

      expect(mockCheckIndicator.down).toHaveBeenCalledWith('Redis ping failed');
      expect(result).toEqual({ redis: { status: 'down', message: 'Redis ping failed' } });
    });
  });
});
