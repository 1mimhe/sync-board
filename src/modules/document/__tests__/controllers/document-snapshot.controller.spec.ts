import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { DocumentSnapshotController } from '../../controllers/document-snapshot.controller';
import { SnapshotService } from '../../services/snapshot.service';
import type { Document, DocumentSnapshot } from '@prisma/client';

const DOC = '00000000-0000-4000-8000-000000000001';
const SNAP = '00000000-0000-4000-8000-000000000002';

function snapshotEntity(): DocumentSnapshot {
  return {
    id: SNAP,
    documentId: DOC,
    yjsState: new Uint8Array([1]),
    snapshotName: 'named',
    createdBy: 'u-1',
    createdAt: new Date(),
  };
}

describe('DocumentSnapshotController', () => {
  let controller: DocumentSnapshotController;
  let service: DeepMockProxy<SnapshotService>;

  beforeEach(() => {
    service = mockDeep<SnapshotService>();
    controller = new DocumentSnapshotController(service);
  });

  it('create returns the mapped snapshot dto', async () => {
    service.create.mockResolvedValue(snapshotEntity());

    const result = await controller.create(DOC, { sub: 'u-1' } as any, {
      name: 'named',
    });

    expect(service.create).toHaveBeenCalledWith(DOC, { name: 'named' }, 'u-1');
    expect(result).toEqual({
      id: SNAP,
      documentId: DOC,
      snapshotName: 'named',
      createdBy: 'u-1',
      createdAt: expect.any(Date),
    });
    expect(result).not.toHaveProperty('yjsState');
  });

  it('list returns mapped snapshot metadata', async () => {
    service.list.mockResolvedValue([snapshotEntity()]);

    const result = await controller.list(DOC);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: SNAP, snapshotName: 'named' });
  });

  it('restore returns the restored document', async () => {
    service.restore.mockResolvedValue({
      id: DOC,
      title: 'Restored',
    } as unknown as Document);

    const result = await controller.restore(DOC, SNAP);

    expect(service.restore).toHaveBeenCalledWith(DOC, SNAP);
    expect(result.title).toBe('Restored');
  });
});
