/**
 * Event names for card-level lifecycle, movement, and modification actions.
 */
export const CARD_EVENTS = {
  created: 'card.created',
  moved: 'card.moved',
  updated: 'card.updated',
  archived: 'card.archived',
  unarchived: 'card.unarchived',
  deleted: 'card.deleted',
  assigneeAdded: 'card.assignee_added',
  assigneeRemoved: 'card.assignee_removed',
} as const;
