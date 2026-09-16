import type { RedisService } from '../redis/redis.service';

/**
 * Returns true exactly once per messageId (per ttl window). Uses Redis
 * NX-set so concurrent duplicate deliveries are safe.
 */
export async function consumeOnce(
  redis: RedisService,
  messageId: string,
  ttlSeconds = 3600,
): Promise<boolean> {
  const res = await redis.set(
    `msg:processed:${messageId}`,
    '1',
    'EX',
    ttlSeconds,
    'NX',
  );
  return res === 'OK';
}
