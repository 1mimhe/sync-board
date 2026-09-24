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

/** Metadata-only column selection to omit heavy binary yjsState and previewText. */
export const DOCUMENT_META_SELECT = {
  id: true,
  workspaceId: true,
  title: true,
  parentCardId: true,
  createdBy: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;
