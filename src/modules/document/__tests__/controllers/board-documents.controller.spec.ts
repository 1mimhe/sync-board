import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { BoardDocumentsController } from '../../controllers/board-documents.controller';
import { DocumentService } from '../../services/document.service';
import type { Document } from '@prisma/client';

const DOC = '00000000-0000-4000-8000-000000000001';

describe('BoardDocumentsController', () => {
  let controller: BoardDocumentsController;
  let service: DeepMockProxy<DocumentService>;

  beforeEach(() => {
    service = mockDeep<DocumentService>();
    controller = new BoardDocumentsController(service);
  });

  it('listByBoard returns mapped documents with parentCard', async () => {
    service.listByBoard.mockResolvedValue([
      {
        id: DOC,
        workspaceId: 'ws-1',
        title: 'Board linked doc',
        parentCardId: 'c-1',
        parentCard: { id: 'c-1', title: 'Feature Card' },
        createdBy: 'u-1',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Document & { parentCard: { id: string; title: string } },
    ]);

    const result = await controller.listByBoard('ws-1', 'b-1');

    expect(service.listByBoard).toHaveBeenCalledWith('ws-1', 'b-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: DOC,
      parentCardId: 'c-1',
      parentCard: { id: 'c-1', title: 'Feature Card' },
    });
    expect(result[0]).not.toHaveProperty('yjsState');
  });
});
