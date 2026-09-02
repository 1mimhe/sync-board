import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ActivityRepository } from '../../repositories/activity.repository';
import { DocumentActivityListener } from '../../listeners/document-activity.listener';
import {
  DocumentCreatedEvent,
  DocumentRenamedEvent,
  DocumentArchivedEvent,
} from '../../../document/events/document.events';
import { ActionType, EntityType } from '@prisma/client';

describe('DocumentActivityListener', () => {
  let listener: DocumentActivityListener;
  let activityRepo: DeepMockProxy<ActivityRepository>;

  beforeEach(() => {
    activityRepo = mockDeep<ActivityRepository>();
    listener = new DocumentActivityListener(activityRepo);
  });

  it('records document.created with nullable board scope and title', async () => {
    await listener.handleDocumentCreatedEvent(
      new DocumentCreatedEvent('d-1', 'ws-1', null, null, 'My doc', 'u-1'),
    );

    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: null,
      userId: 'u-1',
      action: ActionType.created,
      entityType: EntityType.document,
      entityId: 'd-1',
      entityTitle: 'My doc',
    });
  });

  it('records document.created scoped to the board of the parent card', async () => {
    await listener.handleDocumentCreatedEvent(
      new DocumentCreatedEvent('d-1', 'ws-1', 'b-1', 'c-1', 'My doc', 'u-1'),
    );

    expect(activityRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ boardId: 'b-1' }),
    );
  });

  it('records document.renamed with updated action and new title', async () => {
    await listener.handleDocumentRenamedEvent(
      new DocumentRenamedEvent('d-1', 'Renamed Title', 'u-1'),
    );

    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: null,
      userId: 'u-1',
      action: ActionType.updated,
      entityType: EntityType.document,
      entityId: 'd-1',
      entityTitle: 'Renamed Title',
    });
  });

  it('records document.archived without board scope', async () => {
    await listener.handleDocumentArchivedEvent(
      new DocumentArchivedEvent('d-1', 'ws-1', 'u-1'),
    );

    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: null,
      userId: 'u-1',
      action: ActionType.archived,
      entityType: EntityType.document,
      entityId: 'd-1',
    });
  });

  it('swallows repository failures so the originating request is unaffected', async () => {
    activityRepo.create.mockRejectedValue(new Error('db down'));
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
});
