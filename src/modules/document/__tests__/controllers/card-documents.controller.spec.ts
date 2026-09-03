import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CardDocumentsController } from '../../controllers/card-documents.controller';
import { DocumentService } from '../../services/document.service';
import type { Document } from '@prisma/client';

const DOC = '00000000-0000-4000-8000-000000000001';

describe('CardDocumentsController', () => {
  let controller: CardDocumentsController;
  let service: DeepMockProxy<DocumentService>;

  beforeEach(() => {
    service = mockDeep<DocumentService>();
    controller = new CardDocumentsController(service);
  });

  it('listByCard returns mapped documents', async () => {
    service.listByCard.mockResolvedValue([
      {
        id: DOC,
        workspaceId: 'ws-1',
        title: 'Linked doc',
        parentCardId: 'c-1',
        createdBy: 'u-1',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Document,
    ]);

    const result = await controller.listByCard('ws-1', 'c-1');

    expect(service.listByCard).toHaveBeenCalledWith('ws-1', 'c-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: DOC, parentCardId: 'c-1' });
    expect(result[0]).not.toHaveProperty('yjsState');
  });
});
