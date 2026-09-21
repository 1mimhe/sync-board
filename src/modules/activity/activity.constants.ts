/**
 * Daily schedule ensuring future activity partitions exist (04:00 UTC).
 * Staggered after the notification cleanup task (03:00 UTC) to avoid
 * lock contention on the database.
 */
export const ACTIVITY_PARTITION_CRON = '0 4 * * *';
