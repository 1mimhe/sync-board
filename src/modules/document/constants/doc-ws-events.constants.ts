/**
 * WebSocket event names for collaborative document sessions.
 */
export const DOC_WS = {
  JOIN: 'doc:join',
  LEAVE: 'doc:leave',
  UPDATE: 'doc:update',
  AWARENESS: 'doc:awareness',

  JOINED: 'doc:joined',
  EDITOR_JOINED: 'doc:editor-joined',
  EDITOR_LEFT: 'doc:editor-left',
  SAVED: 'doc:saved',
} as const;

/**
 * Rate limits for incoming document WebSocket events.
 * Awareness relays are high-frequency and dropped silently when exceeded.
 */
export const DOC_RATE_LIMITS = {
  UPDATE: { category: 'doc_update', limit: 120, windowMs: 60_000 },
  AWARENESS: {
    category: 'doc_awareness',
    limit: 600,
    windowMs: 60_000,
    silent: true,
  },
  JOINS: { category: 'join', limit: 10, windowMs: 60_000 },
} as const;
