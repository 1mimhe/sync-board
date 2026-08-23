import { Test, TestingModule } from '@nestjs/testing';
import { TokenBlacklistService } from '../../services/token-blacklist.service';
import { RedisService } from '../../../../common/redis/redis.service';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      exists: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        {
          provide: RedisService,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<TokenBlacklistService>(TokenBlacklistService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should add jti to Redis blacklist with TTL', async () => {
    const jti = 'uuid-token-id-123';
    const expiresAt = new Date(Date.now() + 60000); // 60s in future

    await service.blacklist(jti, expiresAt);

    expect(redisService.set).toHaveBeenCalledWith(
      `blacklist:${jti}`,
      '1',
      'EX',
      expect.any(Number),
    );
  });

  it('should return true if jti is blacklisted', async () => {
    redisService.exists.mockResolvedValue(1);

    const isBlacklisted = await service.isBlacklisted('uuid-token-id-123');
    expect(isBlacklisted).toBe(true);
    expect(redisService.exists).toHaveBeenCalledWith(
      'blacklist:uuid-token-id-123',
    );
  });

  it('should return false if jti is not blacklisted', async () => {
    redisService.exists.mockResolvedValue(0);

    const isBlacklisted = await service.isBlacklisted('uuid-token-id-123');
    expect(isBlacklisted).toBe(false);
  });
});
