/**
 * WebSocket event names for client-server and broadcast communication.
 */
export const WS_EVENTS = {
  // Connection / Auth
  TOKEN_EXPIRED: 'token:expired',

  // Workspace Rooms
  WORKSPACE_JOIN: 'workspace:join',
  WORKSPACE_LEAVE: 'workspace:leave',
  WORKSPACE_JOINED: 'workspace:joined',

  // Workspace Broadcasts
  WORKSPACE_MEMBER_ONLINE: 'workspace:member-online',
  WORKSPACE_MEMBER_OFFLINE: 'workspace:member-offline',
  WORKSPACE_UPDATED: 'workspace:updated',
  WORKSPACE_MEMBER_ADDED: 'workspace:member-added',
  WORKSPACE_MEMBER_REMOVED: 'workspace:member-removed',

  // Board Rooms
  BOARD_JOIN: 'board:join',
  BOARD_LEAVE: 'board:leave',
  BOARD_JOINED: 'board:joined',

  // Board State Broadcasts
  BOARD_CREATED: 'board:created',
  BOARD_UPDATED: 'board:updated',
  BOARD_ARCHIVED: 'board:archived',
  BOARD_UNARCHIVED: 'board:unarchived',

  // List State Broadcasts
  LIST_CREATED: 'list:created',
  LIST_UPDATED: 'list:updated',
  LIST_MOVED: 'list:moved',
  LIST_ARCHIVED: 'list:archived',
  LIST_UNARCHIVED: 'list:unarchived',

  // Card State Broadcasts
  CARD_CREATED: 'card:created',
  CARD_UPDATED: 'card:updated',
  CARD_MOVED: 'card:moved',
  CARD_ARCHIVED: 'card:archived',
  CARD_UNARCHIVED: 'card:unarchived',
  CARD_COMMENT_ADDED: 'card:comment-added',
  CARD_ATTACHMENT_ADDED: 'card:attachment-added',
  CARD_ATTACHMENT_DELETED: 'card:attachment-deleted',

  // Label Broadcasts
  LABEL_CREATED: 'label:created',
  LABEL_UPDATED: 'label:updated',
  LABEL_DELETED: 'label:deleted',

  // Presence & Collaboration
  PRESENCE_HEARTBEAT: 'presence:heartbeat',
  PRESENCE_CURSOR: 'presence:cursor',
  BOARD_PRESENCE: 'board:presence',
  BOARD_VIEWERS: 'board:viewers',
  BOARD_CURSOR: 'board:cursor',

  // Notifications (user-scoped room)
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_COUNT: 'notification:count',
} as const;

/**
 * Presence tracking engine configuration.
 */
export const PRESENCE_CONFIG = {
  /** Client heartbeat interval in ms */
  HEARTBEAT_INTERVAL_MS: 30_000,
  /** Stale threshold: after 90s without heartbeat, user is considered offline */
  STALE_THRESHOLD_MS: 90_000,
  /** Periodic background cleanup interval in ms */
  CLEANUP_INTERVAL_MS: 60_000,
  /** Redis key prefix for board presence data */
  REDIS_KEY_PREFIX: 'presence:board:',
  /** Redis set key tracking active boards with viewers */
  ACTIVE_BOARDS_KEY: 'presence:active_boards',
} as const;

/**
 * Rate limits for incoming WebSocket client events.
 */
export const WS_RATE_LIMITS = {
  BOARD_EVENTS: { category: 'board', limit: 60, windowMs: 60_000 },
  PRESENCE_CURSOR: { category: 'cursor', limit: 20, windowMs: 60_000, silent: true },
  ROOM_JOINS: { category: 'join', limit: 10, windowMs: 60_000 },
} as const;

export type WsRateLimitCategory =
  (typeof WS_RATE_LIMITS)[keyof typeof WS_RATE_LIMITS]['category'];

/**
 * Distinct collaborator colors assigned deterministically to board viewers.
 * Curated 16 high-contrast, accessible colors matching modern collaboration design systems.
 */
export const COLLABORATOR_COLORS = [
  '#E11D48', // Rose / Red
  '#2563EB', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#0891B2', // Cyan
  '#DB2777', // Pink
  '#4F46E5', // Indigo
  '#EA580C', // Orange
  '#16A34A', // Green
  '#9333EA', // Purple
  '#0284C7', // Sky
  '#CA8A04', // Yellow Gold
  '#65A30D', // Lime
  '#0D9488', // Teal
  '#C026D3', // Fuchsia
] as const;
