import { RETRY_DEFAULTS } from '../../../common/utils/retry.util';

/**
 * Allowed upload MIME types (server is source of truth; client mirrors for UX only).
 */
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/** Supported attachment hosts (DB CHECK constraint mirrors this). */
export const SUPPORTED_ENTITY_TYPES = ['card', 'document'] as const;

/** Max presigned-URL key build attempts (uuid collision guard). */
export const FILE_KEY_UUID_SEGMENT_LENGTH = 8;

/** File names are truncated to this length after sanitization. */
export const FILE_NAME_MAX_LENGTH = 100;

/** Pending uploads older than this are marked failed by the cron task. */
export const STALE_UPLOAD_TTL_HOURS = 24;

/** Hourly cron schedule for stale-upload cleanup. */
export const STALE_UPLOAD_CRON = '0 * * * *';

/** Max persist attempts before a file message is dead-lettered (parity with notifications). */
export const FILE_MAX_RETRIES = RETRY_DEFAULTS.maxRetries;

/** Base backoff for file retries: 1s, 2s, 4s. */
export const FILE_RETRY_BASE_MS = RETRY_DEFAULTS.baseMs;
