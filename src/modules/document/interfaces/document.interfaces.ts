import type * as Y from 'yjs';

/** Live in-memory representation of an open document. */
export interface ActiveDocument {
  ydoc: Y.Doc;
  connections: Set<string>;
  lastActivity: Date;
  saveTimeout: NodeJS.Timeout | null;
  isDirty: boolean;
}

/**
 * Public summary of an editor currently connected to a document.
 * Stripped of socket identifiers — clients never see other sockets' IDs.
 */
export interface EditorInfo {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
}

/** Payload acked to a client after successfully joining a document room. */
export interface DocJoinAck {
  documentId: string;
  /** Full merged CRDT state for the joining peer. */
  state: Uint8Array;
  editors: EditorInfo[];
}

/**
 * Context describing an authenticated access attempt to a document,
 * used by the realtime gateway handlers.
 */
export interface DocAccessContext {
  documentId: string;
  workspaceId: string;
  userId: string;
}
