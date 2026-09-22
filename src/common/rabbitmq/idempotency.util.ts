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

/**
 * Reads the retry attempt from consumed message headers (default 0).
 *
 * @param headers - Raw AMQP message headers
 * @returns Numeric retry count, 0 when absent or malformed
 */
export function retryCountFrom(
  headers: Record<string, unknown> | undefined,
): number {
  const raw = headers?.['x-retry-count'];
  return typeof raw === 'number' ? raw : 0;
}
