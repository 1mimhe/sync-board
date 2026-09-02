/**
 * Event names for list-level lifecycle and reordering actions.
 */
export const LIST_EVENTS = {
  created: 'list.created',
  updated: 'list.updated',
  moved: 'list.moved',
  archived: 'list.archived',
  unarchived: 'list.unarchived',
  deleted: 'list.deleted',
} as const;
