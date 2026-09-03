/**
 * Timing and preview configuration for collaborative documents.
 */
export const DOCUMENT_CONSTANTS = {
  /** Debounce delay before persisting dirty in-memory Yjs state to PostgreSQL (5 seconds). */
  SAVE_DEBOUNCE_MS: 5_000,
  /** Inactivity threshold before an unwatched document is flushed and unloaded (5 minutes). */
  IDLE_UNLOAD_MS: 5 * 60_000,
  /** Maximum length in characters extracted for plain-text search preview. */
  PREVIEW_MAX_LENGTH: 20_000,
} as const;

export const SAVE_DEBOUNCE_MS = DOCUMENT_CONSTANTS.SAVE_DEBOUNCE_MS;
export const IDLE_UNLOAD_MS = DOCUMENT_CONSTANTS.IDLE_UNLOAD_MS;
export const PREVIEW_MAX_LENGTH = DOCUMENT_CONSTANTS.PREVIEW_MAX_LENGTH;
