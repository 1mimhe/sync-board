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
