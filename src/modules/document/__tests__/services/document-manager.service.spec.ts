import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as Y from 'yjs';
import { DocumentManagerService } from '../../services/document-manager.service';
import { DocumentRepository } from '../../repositories/document.repository';
import { DOCUMENT_EVENTS } from '../../constants';
import { DocumentSavedEvent } from '../../events/document.events';

jest.useFakeTimers();

const DOC = '00000000-0000-4000-8000-000000000001';

describe('DocumentManagerService', () => {
  let manager: DocumentManagerService;
  let repo: DeepMockProxy<DocumentRepository>;
  let emitter: DeepMockProxy<EventEmitter2>;

  beforeEach(() => {
    repo = mockDeep<DocumentRepository>();
    emitter = mockDeep<EventEmitter2>();
    manager = new DocumentManagerService(repo, emitter);
  });

  describe('getOrLoad', () => {
    it('hydrates the persisted state once and caches the Y.Doc', async () => {
      repo.findWithState.mockResolvedValue({
        id: DOC,
        yjsState: new Uint8Array(Y.encodeStateAsUpdate(mkDoc('stored'))),
      });

      const ydoc = await manager.getOrLoad(DOC);
      await manager.getOrLoad(DOC);

      expect(repo.findWithState).toHaveBeenCalledTimes(1);
      expect(
        (
          ydoc.getText('content') as unknown as { toString(): string }
        ).toString(),
      ).toBe('stored');
      expect(manager.isEmpty(DOC)).toBe(false);
    });

    it('tolerates a missing row and an empty persisted state', async () => {
      repo.findWithState.mockResolvedValue(null);
      await manager.getOrLoad(DOC);
      expect(manager.isEmpty(DOC)).toBe(true);

      repo.findWithState.mockResolvedValue({
        id: DOC,
        yjsState: new Uint8Array(0),
      });
      await manager.getOrLoad('00000000-0000-4000-8000-000000000002');
      expect(manager.isEmpty('00000000-0000-4000-8000-000000000002')).toBe(
        true,
      );
    });
  });

  describe('applyUpdate', () => {
    it('merges updates into the live doc and marks it dirty', async () => {
      repo.findWithState.mockResolvedValue(null);
      await manager.getOrLoad(DOC);

      const peer = mkDoc('typed');
      manager.applyUpdate(DOC, Y.encodeStateAsUpdate(peer));

      const ydoc = await manager.getOrLoad(DOC);
      expect(
        (
          ydoc.getText('content') as unknown as { toString(): string }
        ).toString(),
      ).toBe('typed');
      const entry = (manager as any).docs.get(DOC);
      expect(entry.isDirty).toBe(true);
    });

    it('ignores updates for documents that are not loaded', () => {
      expect(() =>
        manager.applyUpdate(
          '00000000-0000-4000-8000-000000000009',
          new Uint8Array([1]),
        ),
      ).not.toThrow();
    });
  });

  describe('debounced persistence', () => {
    it('persists state + preview after the debounce window and emits saved', async () => {
      repo.findWithState.mockResolvedValue(null);
      const ydoc = await manager.getOrLoad(DOC);

      ydoc.getText('content').insert(0, 'hello');
      ydoc.getText('content').insert(5, ' world'); // debounce collapses both
      await jest.advanceTimersByTimeAsync(5_000);

      expect(repo.saveState).toHaveBeenCalledTimes(1);
      expect(repo.saveState).toHaveBeenCalledWith(
        DOC,
        expect.any(Uint8Array),
        'hello world',
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        DOCUMENT_EVENTS.saved,
        expect.any(DocumentSavedEvent),
      );

      // No further changes → nothing more persisted
      await jest.advanceTimersByTimeAsync(30_000);
      expect(repo.saveState).toHaveBeenCalledTimes(1);
    });

    it('logs persist failures and stays dirty for the next cycle', async () => {
      repo.findWithState.mockResolvedValue(null);
      const ydoc = await manager.getOrLoad(DOC);
      const errorSpy = jest.spyOn(manager['logger'], 'error');

      ydoc.getText('content').insert(0, 'hello');
      repo.saveState.mockRejectedValueOnce(new Error('db down'));
      await jest.advanceTimersByTimeAsync(5_000);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('db down'),
        expect.any(String),
      );

      // Retry on the next change succeeds and clears the flag
      ydoc.getText('content').insert(5, '!');
      await jest.advanceTimersByTimeAsync(5_000);
      expect(repo.saveState).toHaveBeenCalledTimes(2);
      const entry = (manager as any).docs.get(DOC);
      expect(entry.isDirty).toBe(false);
    });
  });

  describe('replaceState', () => {
    it('applies the bytes and persists immediately', async () => {
      repo.findWithState.mockResolvedValue(null);

      await manager.replaceState(DOC, Y.encodeStateAsUpdate(mkDoc('restored')));

      expect(repo.saveState).toHaveBeenCalledWith(
        DOC,
        expect.any(Uint8Array),
        'restored',
      );
      expect(manager.isEmpty(DOC)).toBe(false);
    });
  });

  describe('encodeDiff / getStateBytes', () => {
    it('returns the full state without a vector and a diff with one', async () => {
      repo.findWithState.mockResolvedValue(null);
      const ydoc = await manager.getOrLoad(DOC);
      ydoc.getText('content').insert(0, 'hello');

      const full = manager.getStateBytes(DOC);
      expect(
        Buffer.from(manager.encodeDiff(DOC)).equals(Buffer.from(full)),
      ).toBe(true);

      const sv = Y.encodeStateVector(ydoc);
      const diff = manager.encodeDiff(DOC, sv);
      expect(diff.length).toBeLessThan(full.length);
    });

    it('throws when the document is not loaded', () => {
      expect(() => manager.getStateBytes(DOC)).toThrow('not loaded');
      expect(() => manager.encodeDiff(DOC)).toThrow('not loaded');
      expect(() => manager.isEmpty(DOC)).toThrow('not loaded');
    });
  });

  describe('connections', () => {
    it('tracks connection counts per document', async () => {
      repo.findWithState.mockResolvedValue(null);
      await manager.getOrLoad(DOC);

      expect(manager.connectionCount(DOC)).toBe(0);
      expect(
        manager.connectionCount('00000000-0000-4000-8000-000000000009'),
      ).toBe(0);

      manager.addConnection(DOC, 'sock-1');
      expect(manager.connectionCount(DOC)).toBe(1);

      manager.removeConnection(DOC, 'sock-1');
      expect(manager.connectionCount(DOC)).toBe(0);
    });

    it('tolerates connection removal for unknown documents', () => {
      expect(() =>
        manager.removeConnection(
          '00000000-0000-4000-8000-000000000009',
          'sock-1',
        ),
      ).not.toThrow();
    });
  });

  describe('unloadIdle', () => {
    it('unloads only idle unconnected docs, persisting dirty state first', async () => {
      const OLD = DOC;
      const RECENT = '00000000-0000-4000-8000-000000000002';
      const CONNECTED = '00000000-0000-4000-8000-000000000003';

      repo.findWithState.mockResolvedValue(null);
      const oldDoc = await manager.getOrLoad(OLD);
      await manager.getOrLoad(RECENT);
      await manager.getOrLoad(CONNECTED);
      manager.addConnection(CONNECTED, 'sock-1');

      // Age the OLD doc past the idle cutoff and leave unsaved changes
      oldDoc.getText('content').insert(0, 'unsaved');
      (manager as any).docs.get(OLD).lastActivity = new Date(
        Date.now() - 6 * 60_000,
      );

      await manager.unloadIdle();

      const docs: Map<string, unknown> = (manager as any).docs;
      expect(docs.has(OLD)).toBe(false);
      expect(docs.has(RECENT)).toBe(true);
      expect(docs.has(CONNECTED)).toBe(true);
      expect(repo.saveState).toHaveBeenCalledWith(
        OLD,
        expect.any(Uint8Array),
        'unsaved',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('flushes dirty docs, destroys all Y.Docs and clears the cache', async () => {
      const CLEAN = '00000000-0000-4000-8000-000000000002';
      repo.findWithState.mockResolvedValue(null);
      const dirtyDoc = await manager.getOrLoad(DOC);
      await manager.getOrLoad(CLEAN);
      dirtyDoc.getText('content').insert(0, 'flush me');

      await manager.onModuleDestroy();

      expect(repo.saveState).toHaveBeenCalledWith(
        DOC,
        expect.any(Uint8Array),
        'flush me',
      );
      expect((manager as any).docs.size).toBe(0);
    });
  });
});

/** Creates a standalone Y.Doc with the given text for CRDT inputs. */
function mkDoc(text: string): Y.Doc {
  const ydoc = new Y.Doc();
  ydoc.getText('content').insert(0, text);
  return ydoc;
}
