/**
 * Event names for label lifecycle actions (workspace-level and board-level labels).
 * Emissions are wired in Phase 4D — constants defined now to close the registry gap.
 */
export const LABEL_EVENTS = {
  created: 'label.created',
  updated: 'label.updated',
  deleted: 'label.deleted',
} as const;
