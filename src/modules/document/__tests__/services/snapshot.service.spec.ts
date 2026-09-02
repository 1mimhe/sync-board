import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SnapshotService } from '../../services/snapshot.service';
import { DocumentRepository } from '../../repositories/document.repository';
import { DocumentManagerService } from '../../services/document-manager.service';
import {
  BusinessRuleException,
  EntityNotFoundException,
} from '../../../../common/exceptions/app.exception';
import { DOCUMENT_EVENTS } from '../../constants';
import { DocumentSnapshotCreatedEvent } from '../../events/document.events';

const DOC = '00000000-0000-4000-8000-000000000001';
const SNAP = '00000000-0000-4000-8000-000000000002';

describe('SnapshotService', () => {
  let service: SnapshotService;
  let repo: DeepMockProxy<DocumentRepository>;
  let manager: DeepMockProxy<DocumentManagerService>;
  let emitter: DeepMockProxy<EventEmitter2>;

  beforeEach(() => {
    repo = mockDeep<DocumentRepository>();
    manager = mockDeep<DocumentManagerService>();
    emitter = mockDeep<EventEmitter2>();
    service = new SnapshotService(repo, manager, emitter);
  });

  describe('create', () => {
    it('captures the live state and emits snapshot_created', async () => {
      repo.findActiveById.mockResolvedValue({ id: DOC } as any);
      manager.isEmpty.mockReturnValue(false);
      manager.getStateBytes.mockReturnValue(new Uint8Array([9, 9, 9]));
      repo.createSnapshot.mockResolvedValue({ id: SNAP } as any);

      const result = await service.create(
        DOC,
        { name: 'point-in-time' },
        'u-1',
      );

      expect(manager.getOrLoad).toHaveBeenCalledWith(DOC);
      expect(repo.createSnapshot).toHaveBeenCalledWith({
        documentId: DOC,
        yjsState: new Uint8Array([9, 9, 9]),
        snapshotName: 'point-in-time',
        createdBy: 'u-1',
      });
      expect(emitter.emit).toHaveBeenCalledWith(
        DOCUMENT_EVENTS.snapshotCreated,
        new DocumentSnapshotCreatedEvent(DOC, SNAP, 'u-1'),
      );
      expect(result).toEqual({ id: SNAP });
    });

    it('defaults the snapshot name to null', async () => {
      repo.findActiveById.mockResolvedValue({ id: DOC } as any);
      manager.isEmpty.mockReturnValue(false);
      manager.getStateBytes.mockReturnValue(new Uint8Array([1]));
      repo.createSnapshot.mockResolvedValue({ id: SNAP } as any);

      await service.create(DOC, {}, 'u-1');

      expect(repo.createSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ snapshotName: null }),
      );
    });

    it('throws DOCUMENT_EMPTY when there is nothing to snapshot', async () => {
      repo.findActiveById.mockResolvedValue({ id: DOC } as any);
      manager.isEmpty.mockReturnValue(true);

      await expect(service.create(DOC, {}, 'u-1')).rejects.toThrow(
        new BusinessRuleException('DOCUMENT_EMPTY', 'Nothing to snapshot yet'),
      );
      expect(repo.createSnapshot).not.toHaveBeenCalled();
    });

    it('throws when the document is absent', async () => {
      repo.findActiveById.mockResolvedValue(null);

      await expect(service.create(DOC, {}, 'u-1')).rejects.toThrow(
        EntityNotFoundException,
      );
      expect(manager.getOrLoad).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns the metadata-only snapshot history', async () => {
      repo.findSnapshots.mockResolvedValue([{ id: SNAP }] as any);

      const result = await service.list(DOC);

      expect(result).toEqual([{ id: SNAP }]);
    });
  });

  describe('restore', () => {
    it('pushes the snapshot bytes into the manager and persists immediately', async () => {
      const bytes = new Uint8Array([7, 7, 7]);
      repo.findSnapshotById.mockResolvedValue({
        id: SNAP,
        yjsState: bytes,
      } as any);
      repo.findActiveById.mockResolvedValue({ id: DOC, title: 'T' } as any);

      const result = await service.restore(DOC, SNAP);

      expect(manager.replaceState).toHaveBeenCalledWith(
        DOC,
        new Uint8Array(bytes),
      );
      expect(result).toEqual({ id: DOC, title: 'T' });
    });

    it('throws when the snapshot does not exist under the document', async () => {
      repo.findSnapshotById.mockResolvedValue(null);

      await expect(service.restore(DOC, SNAP)).rejects.toThrow(
        new EntityNotFoundException('DocumentSnapshot', SNAP),
      );
      expect(manager.replaceState).not.toHaveBeenCalled();
    });
  });
});
