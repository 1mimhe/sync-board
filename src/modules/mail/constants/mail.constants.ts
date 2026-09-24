import { RETRY_DEFAULTS } from '../../../common/utils/retry.util';

/** Max send attempts before an email message is dead-lettered. */
export const EMAIL_MAX_RETRIES = RETRY_DEFAULTS.maxRetries;

/** Base backoff: delays run 1s, 2s, 4s (base * 2^retryCount). */
export const EMAIL_RETRY_BASE_MS = RETRY_DEFAULTS.baseMs;

/** Idempotency key TTL for consumed email messages (1 hour). */
export const EMAIL_IDEMPOTENCY_TTL_SECONDS = 3600;
