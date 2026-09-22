import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ActivityRepository } from '../../repositories/activity.repository';
import { DocumentService } from '../../../document/services/document.service';
import { DocumentActivityListener } from '../../listeners/document-activity.listener';
import {
  DocumentCreatedEvent,
  DocumentRenamedEvent,
  DocumentArchivedEvent,
} from '../../../document/events/document.events';

describe('DocumentActivityListener', () => {
  let listener: DocumentActivityListener;
  let activityRepo: DeepMockProxy<ActivityRepository>;
  let documentService: DeepMockProxy<DocumentService>;

  beforeEach(() => {
    activityRepo = mockDeep<ActivityRepository>();
    documentService = mockDeep<DocumentService>();
    listener = new DocumentActivityListener(activityRepo, documentService);
  });

  it('records document.created with nullable board scope and title', async () => {
    await listener.handleDocumentCreatedEvent(
      new DocumentCreatedEvent('d-1', 'ws-1', null, null, 'My doc', 'u-1'),
    );

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: null,
      entityType: 'document',
      entityId: 'd-1',
      action: 'created',
      actorId: 'u-1',
      payload: { entityTitle: 'My doc' },
    });
  });

  it('records document.created scoped to the board of the parent card', async () => {
    await listener.handleDocumentCreatedEvent(
      new DocumentCreatedEvent('d-1', 'ws-1', 'b-1', 'c-1', 'My doc', 'u-1'),
    );

    expect(activityRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ boardId: 'b-1' }),
    );
  });

  it('records document.renamed with workspace resolved from the document', async () => {
    documentService.findById.mockResolvedValue({ workspaceId: 'ws-1' } as any);

    await listener.handleDocumentRenamedEvent(
      new DocumentRenamedEvent('d-1', 'Renamed Title', 'u-1'),
    );

    expect(documentService.findById).toHaveBeenCalledWith('d-1');
    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: null,
      entityType: 'document',
      entityId: 'd-1',
      action: 'updated',
      actorId: 'u-1',
      payload: { entityTitle: 'Renamed Title' },
    });
  });

  it('records document.archived without board scope', async () => {
    await listener.handleDocumentArchivedEvent(
      new DocumentArchivedEvent('d-1', 'ws-1', 'u-1'),
    );

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: null,
      entityType: 'document',
      entityId: 'd-1',
      action: 'archived',
      actorId: 'u-1',
      payload: {},
    });
  });

  it('skips recording when rename target document is missing', async () => {
    documentService.findById.mockRejectedValue(new Error('Document not found'));

    await listener.handleDocumentRenamedEvent(
      new DocumentRenamedEvent('d-1', 'Renamed Title', 'u-1'),
    );

    expect(activityRepo.record).not.toHaveBeenCalled();
  });

  it('swallows repository failures so the originating request is unaffected', async () => {
    activityRepo.record.mockRejectedValue(new Error('db down'));
    const errorSpy = jest.spyOn(listener['logger'], 'error');

    await expect(
      listener.handleDocumentCreatedEvent(
        new DocumentCreatedEvent('d-1', 'ws-1', null, null, 'My doc', 'u-1'),
      ),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();

    await expect(
      listener.handleDocumentArchivedEvent(
        new DocumentArchivedEvent('d-1', 'ws-1', 'u-1'),
      ),
    ).resolves.toBeUndefined();
  });

  it('swallows repository failures on rename so the originating request is unaffected', async () => {
    documentService.findById.mockResolvedValue({ workspaceId: 'ws-1' } as any);
    activityRepo.record.mockRejectedValue(new Error('db down'));

    await expect(
      listener.handleDocumentRenamedEvent(
        new DocumentRenamedEvent('d-1', 'Renamed Title', 'u-1'),
      ),
    ).resolves.toBeUndefined();
  });
});
