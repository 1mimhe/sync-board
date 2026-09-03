/**
 * Event names for document lifecycle, persistence, and snapshot actions.
 */
export const DOCUMENT_EVENTS = {
  created: 'document.created',
  renamed: 'document.renamed',
  saved: 'document.saved',
  archived: 'document.archived',
  snapshotCreated: 'document.snapshot_created',
} as const;
