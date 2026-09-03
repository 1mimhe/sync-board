import * as Y from 'yjs';

/**
 * Helpers for Yjs advanced features: relative positions, state-vector diff,
 * V2 conversion, and obfuscation. Re-exports Yjs CRDT primitives with
 * SyncBoard-specific defaults (content channel = 'content').
 */

/** Creates a relative position anchored to the 'content' Y.Text. */
export function createRelativePosition(
  ydoc: Y.Doc,
  index: number,
  assoc = 0,
): unknown {
  const ytext = ydoc.getText('content');
  return Y.createRelativePositionFromTypeIndex(ytext, index, assoc);
}

/** Resolves a relative position back to an absolute index. */
export function resolveRelativePosition(
  ydoc: Y.Doc,
  relativePosition: unknown,
): { index: number } | null {
  const pos = Y.createAbsolutePositionFromRelativePosition(
    relativePosition as never,
    ydoc,
  );
  if (!pos) return null;
  return { index: pos.index };
}

/** Encodes a relative position to binary (for storage/transport). */
export function encodeRelativePosition(relativePosition: unknown): Uint8Array {
  return Y.encodeRelativePosition(relativePosition as never);
}

/** Decodes a binary relative position. */
export function decodeRelativePosition(bytes: Uint8Array): unknown {
  return Y.decodeRelativePosition(bytes);
}

/** Returns a state vector (V1) for diff sync. */
export function encodeStateVector(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(ydoc);
}

/** Returns a state vector from a V2 update. */
export function encodeStateVectorFromUpdateV2(update: Uint8Array): Uint8Array {
  return Y.encodeStateVectorFromUpdateV2(update);
}

/** Diff update: what peer is missing (V1). */
export function diffUpdate(ydoc: Y.Doc, stateVector?: Uint8Array): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc, stateVector);
}

/** Diff update V2 (smaller wire format). */
export function diffUpdateV2(
  ydoc: Y.Doc,
  stateVector?: Uint8Array,
): Uint8Array {
  return Y.encodeStateAsUpdateV2(ydoc, stateVector);
}

/** Merge multiple updates (V1) — useful for offline sync without loading Y.Doc. */
export function mergeUpdates(updates: Uint8Array[]): Uint8Array {
  return Y.mergeUpdates(updates);
}

/** Obfuscates an update for support dumps (CRDT metadata preserved, content scrambled). */
export function obfuscateUpdate(update: Uint8Array): Uint8Array {
  return Y.obfuscateUpdate(update);
}

/** Converts V1 update to V2. */
export function convertV1ToV2(update: Uint8Array): Uint8Array {
  return Y.convertUpdateFormatV1ToV2(update);
}

/** Converts V2 update to V1. */
export function convertV2ToV1(update: Uint8Array): Uint8Array {
  return Y.convertUpdateFormatV2ToV1(update);
}

/**
 * Client-side UndoManager factory. Server keeps snapshots; undo/redo is
 * client-local via Y.UndoManager on the 'content' text.
 * Usage: const um = createUndoManager(ydoc); um.undo(); um.redo();
 */
export function createUndoManager(
  ydoc: Y.Doc,
  opts?: { captureTimeout?: number; trackedOrigins?: Set<unknown> },
): Y.UndoManager {
  return new Y.UndoManager(ydoc.getText('content'), {
    captureTimeout: opts?.captureTimeout ?? 800,
    trackedOrigins: opts?.trackedOrigins,
  });
}
