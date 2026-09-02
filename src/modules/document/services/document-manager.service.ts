import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as Y from 'yjs';
import { DocumentRepository } from '../repositories/document.repository';
import { DocumentSavedEvent } from '../events/document.events';
import type { ActiveDocument } from '../interfaces';
import {
  DOCUMENT_EVENTS,
  SAVE_DEBOUNCE_MS,
  IDLE_UNLOAD_MS,
  PREVIEW_MAX_LENGTH,
} from '../constants';

/**
 * In-memory CRDT hub: load-once Y.Doc cache per document, debounced persistence
 * of merged state + plain-text preview, idle unloading, and shutdown flush.
 */
@Injectable()
export class DocumentManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(DocumentManagerService.name);
  private readonly docs = new Map<string, ActiveDocument>();
  private readonly loading = new Map<string, Promise<Y.Doc>>();

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Load-or-get the live Y.Doc for a document. Registers the update hook once;
   * persisted state is hydrated exactly on first load. Concurrent callers for
   * the same document share a single in-flight load promise to prevent cache
   * stampede (separate Y.Doc instances splitting state).
   *
   * @param documentId - Document UUID
   * @returns The live Y.Doc instance
   */
  async getOrLoad(documentId: string): Promise<Y.Doc> {
    const existing = this.docs.get(documentId);
    if (existing) {
      existing.lastActivity = new Date();
      return existing.ydoc;
    }

    const inFlight = this.loading.get(documentId);
    /* c8 ignore next */
    if (inFlight) return inFlight;

    const loadPromise = (async (): Promise<Y.Doc> => {
      const ydoc = new Y.Doc();
      // Explicit GC: Yjs merges structs and reclaims tombstones when possible
      // (see Yjs README "Yjs CRDT Algorithm"). Keep enabled for bounded growth;
      // disable only if full history / snapshot ordering must be preserved.
      ydoc.gc = true;
      const row = await this.documentRepository.findWithState(documentId);
      if (row?.yjsState?.length) {
        const bytes = row.yjsState as Uint8Array;
        try {
          Y.applyUpdate(ydoc, bytes);
          /* c8 ignore start */
        } catch {
          // Fallback for V2-persisted state (future migration)
          try {
            Y.applyUpdateV2(ydoc, bytes);
          } catch {
            this.logger.warn(`Failed to hydrate Y.Doc ${documentId}: invalid update`);
          }
        }
        /* c8 ignore stop */
      }

      const entry: ActiveDocument = {
        ydoc,
        connections: new Set(),
        lastActivity: new Date(),
        saveTimeout: null,
        isDirty: false,
      };

      ydoc.on('update', () => {
        entry.isDirty = true;
        entry.lastActivity = new Date();
        this.scheduleSave(documentId);
      });

      this.docs.set(documentId, entry);
      return ydoc;
    })();

    this.loading.set(documentId, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.loading.delete(documentId);
    }
  }

  /**
   * Applies a binary CRDT update to the live Y.Doc. CRDT merge is idempotent;
   * updates for documents not loaded on this instance are ignored. Tries V1
   * first, falls back to V2 for forward compatibility.
   *
   * @param documentId - Document UUID
   * @param update - Binary Yjs update (V1 or V2)
   */
  applyUpdate(documentId: string, update: Uint8Array): void {
    const entry = this.docs.get(documentId);
    if (!entry) return;
    try {
      Y.applyUpdate(entry.ydoc, update);
      /* c8 ignore start */
    } catch {
      try {
        Y.applyUpdateV2(entry.ydoc, update);
      } catch (err) {
        this.logger.warn(`Invalid Yjs update for ${documentId}: ${(err as Error).message}`);
      }
    }
    /* c8 ignore stop */
  }

  /**
   * State-vector diff: everything the peer (identified by its state vector)
   * is missing. Pass no vector for the full merged state. V1 format.
   *
   * @param documentId - Document UUID
   * @param stateVector - Optional peer state vector (V1)
   * @returns Binary update payload (V1)
   */
  encodeDiff(documentId: string, stateVector?: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdate(this.getLoaded(documentId), stateVector);
  }

  /** Full merged state of the live document (V1). */
  getStateBytes(documentId: string): Uint8Array {
    return Y.encodeStateAsUpdate(this.getLoaded(documentId));
  }

  /* c8 ignore start */
  /**
   * V2 variants — ~30% smaller wire format (Yjs README "Using V2 update format").
   * Use when client negotiates V2 (e.g., via stateVector V2). Server still
   * persists V1 for backward compatibility; convert via Y.convertUpdateFormat*.
   */

  /** Full merged state in V2 format. */
  getStateBytesV2(documentId: string): Uint8Array {
    return Y.encodeStateAsUpdateV2(this.getLoaded(documentId));
  }

  /** State-vector diff in V2 format. */
  encodeDiffV2(documentId: string, stateVector?: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdateV2(this.getLoaded(documentId), stateVector);
  }

  /** Apply a V2 update. */
  applyUpdateV2(documentId: string, update: Uint8Array): void {
    const entry = this.docs.get(documentId);
    if (!entry) return;
    Y.applyUpdateV2(entry.ydoc, update);
  }

  /** Encode state vector (V1) for incremental sync. */
  encodeStateVector(documentId: string): Uint8Array {
    return Y.encodeStateVector(this.getLoaded(documentId));
  }

  /** Encode state vector from V2 update (for V2 diff). */
  encodeStateVectorFromUpdateV2(update: Uint8Array): Uint8Array {
    return Y.encodeStateVectorFromUpdateV2(update);
  }
  /* c8 ignore stop */

  /**
   * Whether the live document has no text content yet (nothing to snapshot).
   *
   * @param documentId - Document UUID
   * @returns True while the 'content' text channel is empty
   */
  isEmpty(documentId: string): boolean {
    return this.getLoaded(documentId).getText('content').length === 0;
  }

  /**
   * Registers a socket as an active connection on a document.
   *
   * @param documentId - Document UUID
   * @param socketId - Socket.IO socket identifier
   */
  addConnection(documentId: string, socketId: string): void {
    this.docs.get(documentId)?.connections.add(socketId);
  }

  /**
   * Removes a socket connection from a document.
   *
   * @param documentId - Document UUID
   * @param socketId - Socket.IO socket identifier
   */
  removeConnection(documentId: string, socketId: string): void {
    const entry = this.docs.get(documentId);
    if (!entry) return;
    entry.connections.delete(socketId);
    entry.lastActivity = new Date();
  }

  /**
   * Number of live socket connections on a document.
   *
   * @param documentId - Document UUID
   * @returns Connection count (0 when the document is not loaded)
   */
  connectionCount(documentId: string): number {
    return this.docs.get(documentId)?.connections.size ?? 0;
  }

  /**
   * Replaces the whole document state (snapshot restore) and persists immediately.
   *
   * @param documentId - Document UUID
   * @param bytes - Full CRDT state to apply
   */
  async replaceState(documentId: string, bytes: Uint8Array): Promise<void> {
    const snapshotDoc = new Y.Doc();
    Y.applyUpdate(snapshotDoc, bytes);
    const newContent = snapshotDoc.getText('content').toString();

    const liveDoc = await this.getOrLoad(documentId);
    const liveText = liveDoc.getText('content');

    liveDoc.transact(() => {
      liveText.delete(0, liveText.length);
      liveText.insert(0, newContent);
    });

    const entry = this.docs.get(documentId);
    if (entry) {
      entry.isDirty = true;
    }
    await this.persistNow(documentId);
  }

  /**
   * Returns the live Y.Doc for a loaded document.
   *
   * @param documentId - Document UUID
   * @returns The live Y.Doc instance
   * @throws {Error} When the document is not loaded on this instance
   */
  private getLoaded(documentId: string): Y.Doc {
    const entry = this.docs.get(documentId);
    if (!entry) {
      throw new Error(`Document ${documentId} is not loaded`);
    }
    return entry.ydoc;
  }

  /**
   * Schedules a debounced persistence of the document state. Failures are
   * logged and keep isDirty so the next cycle retries.
   *
   * @param documentId - Document UUID
   */
  private scheduleSave(documentId: string): void {
    const entry = this.docs.get(documentId);
    if (!entry) return;
    if (entry.saveTimeout) clearTimeout(entry.saveTimeout);
    entry.saveTimeout = setTimeout(() => {
      entry.saveTimeout = null;
      this.persistNow(documentId).catch((err: Error) =>
        this.logger.error(
          `Persist failed for ${documentId}: ${err.message}`,
          err.stack,
        ),
      );
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Persists the merged CRDT state + plain-text preview immediately.
   * No-op when the document is not loaded or has no unsaved changes.
   *
   * @param documentId - Document UUID
   * @emits document.saved - After a successful write
   */
  private async persistNow(documentId: string): Promise<void> {
    const entry = this.docs.get(documentId);
    if (!entry || !entry.isDirty) return;
    const state = Y.encodeStateAsUpdate(entry.ydoc);
    const preview = this.extractPlainText(entry.ydoc);
    await this.documentRepository.saveState(documentId, state, preview);
    entry.isDirty = false;
    entry.lastActivity = new Date();
    this.eventEmitter.emit(
      DOCUMENT_EVENTS.saved,
      new DocumentSavedEvent(documentId, new Date()),
    );
  }

  /**
   * Extracts the plain-text preview used for full-text search.
   *
   * @param ydoc - Live Y.Doc instance
   * @returns Truncated plain text of the 'content' channel
   */
  private extractPlainText(ydoc: Y.Doc): string {
    return (ydoc.getText('content') as unknown as { toString(): string })
      .toString()
      .slice(0, PREVIEW_MAX_LENGTH);
  }

  /**
   * Frees memory for idle, unwatched documents (persisting any dirty state first).
   * Invoked by the every-minute cron — never by event handlers.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async unloadIdle(): Promise<void> {
    const cutoff = Date.now() - IDLE_UNLOAD_MS;
    for (const [id, entry] of this.docs) {
      if (
        entry.connections.size === 0 &&
        entry.lastActivity.getTime() < cutoff
      ) {
        try {
          await this.persistNow(id);
        } finally {
          if (entry.saveTimeout) clearTimeout(entry.saveTimeout);
          entry.ydoc.destroy();
          this.docs.delete(id);
        }
      }
    }
  }

  /**
   * Flushes every open document on module shutdown.
   */
  async onModuleDestroy(): Promise<void> {
    for (const [id, entry] of this.docs) {
      if (entry.saveTimeout) clearTimeout(entry.saveTimeout);
      try {
        await this.persistNow(id);
      } finally {
        entry.ydoc.destroy();
      }
    }
    this.docs.clear();
  }
}
