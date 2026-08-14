/**
 * Centralized event names for the board module.
 *
 * Services emit and listeners subscribe using these constants to ensure
 * compile-time type safety across event handling and real-time broadcasting.
 */

/**
 * Event names for board-level lifecycle actions.
 */
export const BOARD_EVENTS = {
  created: 'board.created',
  updated: 'board.updated',
  archived: 'board.archived',
  unarchived: 'board.unarchived',
} as const;

/**
 * Event names for list-level lifecycle and reordering actions.
 */
export const LIST_EVENTS = {
  created: 'list.created',
  updated: 'list.updated',
  moved: 'list.moved',
  archived: 'list.archived',
  unarchived: 'list.unarchived',
} as const;

/**
 * Event names for card-level lifecycle, movement, and modification actions.
 */
export const CARD_EVENTS = {
  created: 'card.created',
  moved: 'card.moved',
  updated: 'card.updated',
  archived: 'card.archived',
  unarchived: 'card.unarchived',
} as const;

/**
 * Event names for card comment actions.
 */
export const COMMENT_EVENTS = {
  created: 'comment.created',
} as const;

/**
 * Event names for card attachment actions.
 */
export const ATTACHMENT_EVENTS = {
  created: 'attachment.created',
  deleted: 'attachment.deleted',
} as const;
