/** Default retry tunables and exponential backoff helper. */

/** Default max persist attempts before a message is dead-lettered. */
export const RETRY_DEFAULTS = {
  maxRetries: 3,
  baseMs: 1000,
} as const;

/**
 * Computes exponential backoff delay.
 *
 * @param retryCount - Zero-based retry attempt
 * @param baseMs - Base delay in ms (defaults to {@link RETRY_DEFAULTS}.baseMs)
 * @returns Delay in ms: `baseMs * 2^retryCount`
 */
export function computeBackoff(
  retryCount: number,
  baseMs: number = RETRY_DEFAULTS.baseMs,
): number {
  return baseMs * 2 ** retryCount;
}
