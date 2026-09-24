import { consumeOnce } from '../idempotency.util';
import type { RedisService } from '../../redis/redis.service';

describe('consumeOnce', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return true on first claim (OK) and false on duplicate (null)', async () => {
    const redis = { set: jest.fn() } as unknown as RedisService;

    (redis.set as jest.Mock)
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce(null);

    await expect(consumeOnce(redis, 'msg-1')).resolves.toBe(true);
    await expect(consumeOnce(redis, 'msg-1')).resolves.toBe(false);

    expect(redis.set).toHaveBeenNthCalledWith(
      1,
      'msg:processed:msg-1',
      '1',
      'EX',
      3600,
      'NX',
    );
  });

  it('should honor a custom ttl window', async () => {
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
    } as unknown as RedisService;

    await expect(consumeOnce(redis, 'msg-2', 60)).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      'msg:processed:msg-2',
      '1',
      'EX',
      60,
      'NX',
    );
  });
});
