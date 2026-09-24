/** Email-verification soft-gate tunables. */

/** Redis key prefix for the positive verification-result cache. */
export const EMAIL_VERIFIED_CACHE_PREFIX = 'email_verified:';

/** TTL (seconds) for cached positive verification lookups. */
export const EMAIL_VERIFIED_CACHE_TTL_SECONDS = 300;

/** HTTP methods that unverified users may always perform (soft gate). */
export const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
