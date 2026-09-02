import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { DocumentController } from '../../controllers/document.controller';
import { DocumentService } from '../../services/document.service';
import type { Document } from '@prisma/client';

const DOC = '00000000-0000-4000-8000-000000000001';
const USER = { sub: 'u-1' } as any;

function docEntity(): Document {
  return {
    id: DOC,
    workspaceId: 'ws-1',
    title: 'My doc',
    parentCardId: null,
    createdBy: 'u-1',
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  } as unknown as Document;
}

describe('DocumentController', () => {
  let controller: DocumentController;
  let service: DeepMockProxy<DocumentService>;

  beforeEach(() => {
    service = mockDeep<DocumentService>();
    controller = new DocumentController(service);
  });

  it('create returns the mapped response dto', async () => {
    service.create.mockResolvedValue(docEntity());

    const result = await controller.create('ws-1', USER, { title: 'My doc' });

    expect(service.create).toHaveBeenCalledWith(
      'ws-1',
      { title: 'My doc' },
      'u-1',
    );
    expect(result).toMatchObject({
      id: DOC,
      title: 'My doc',
      status: 'active',
    });
    expect(result).not.toHaveProperty('yjsState');
    expect(result).not.toHaveProperty('previewText');
  });

  it('list returns the paginated envelope with mapped items', async () => {
    service.listInWorkspace.mockResolvedValue({
      items: [docEntity(), docEntity()],
      pagination: { cursor: DOC, hasMore: true },
    });

    const result = await controller.list('ws-1', { limit: 1 });

    expect(result.items).toHaveLength(2);
    expect(result.pagination).toEqual({ cursor: DOC, hasMore: true });
  });

  it('rename returns the updated document', async () => {
    service.rename.mockResolvedValue({
      ...docEntity(),
      title: 'Renamed',
    });

    const result = await controller.rename('ws-1', DOC, USER, {
      title: 'Renamed',
    });

    expect(service.rename).toHaveBeenCalledWith(
      DOC,
      { title: 'Renamed' },
      'u-1',
      'ws-1',
    );
    expect(result.title).toBe('Renamed');
  });

  it('get returns a single document response dto', async () => {
    service.findById.mockResolvedValue(docEntity());

    const result = await controller.get('ws-1', DOC);

    expect(service.findById).toHaveBeenCalledWith(DOC, 'ws-1');
    expect(result).toMatchObject({
      id: DOC,
      title: 'My doc',
      status: 'active',
    });
  });

  it('archive delegates with the acting user', async () => {
    service.archive.mockResolvedValue({
      ...docEntity(),
      status: 'archived',
    } as any);

    await controller.archive('ws-1', DOC, USER);

    expect(service.archive).toHaveBeenCalledWith(DOC, 'u-1', 'ws-1');
  });
});
