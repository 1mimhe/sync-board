/** Metadata key for `@WsRateLimit()` configuration. */
export const WS_RATE_LIMIT_KEY = 'ws_rate_limit';

/**
 * Rate-limit bucket category.
 * Domain modules constrain it via their own rate-limit objects whose
 * `category` values must be assignable to this type.
 */
export type WsRateLimitCategory = string;

/** Fallback applied when `@WsRateLimit()` omits explicit limit/window. */
export const WS_RATE_LIMIT_DEFAULTS = {
  limit: 60,
  windowMs: 60_000,
} as const;
