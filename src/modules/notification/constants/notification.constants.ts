import { RETRY_DEFAULTS } from '../../../common/utils/retry.util';

/**
 * Time-to-live for cached user unread notification counts in Redis (30 days in seconds).
 */
export const UNREAD_COUNT_TTL_SECONDS = 2592000;

/**
 * Monthly purge schedule for old read notifications (day 1, 03:00 UTC).
 */
export const NOTIFICATION_CLEANUP_CRON = '0 3 1 * *';

/** Max persist attempts before a notification message is dead-lettered. */
export const NOTIFICATION_MAX_RETRIES = RETRY_DEFAULTS.maxRetries;

/** Base backoff for notification retries: 1s, 2s, 4s. */
export const NOTIFICATION_RETRY_BASE_MS = RETRY_DEFAULTS.baseMs;
