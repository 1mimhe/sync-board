/**
 * Time-to-live for cached user unread notification counts in Redis (30 days in seconds).
 */
export const UNREAD_COUNT_TTL_SECONDS = 2592000;

/**
 * Monthly purge schedule for old read notifications (day 1, 03:00 UTC).
 * Staggered ahead of the activity partition task (04:00 UTC) to avoid
 * lock contention on the database.
 */
export const NOTIFICATION_CLEANUP_CRON = '0 3 1 * *';

