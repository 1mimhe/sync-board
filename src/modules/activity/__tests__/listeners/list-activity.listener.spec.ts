import { Test, TestingModule } from '@nestjs/testing';
import { ListActivityListener } from '../../listeners/list-activity.listener';
import { ActivityRepository } from '../../repositories/activity.repository';
import {
  ListCreatedEvent,
  ListUpdatedEvent,
  ListMovedEvent,
  ListArchivedEvent,
  ListUnarchivedEvent,
} from '../../../board/list/events/list.events';
import { ActionType, EntityType } from '@prisma/client';

describe('ListActivityListener', () => {
  let listener: ListActivityListener;
  let activityRepo: jest.Mocked<ActivityRepository>;

  beforeEach(async () => {
    activityRepo = {
      create: jest.fn().mockResolvedValue({ id: 'act-1' } as any),
      findByBoardId: jest.fn(),
    } as unknown as jest.Mocked<ActivityRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListActivityListener,
        { provide: ActivityRepository, useValue: activityRepo },
      ],
    }).compile();

    listener = module.get<ListActivityListener>(ListActivityListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log list created event', async () => {
    const event = new ListCreatedEvent(
      { id: 'l-1', boardId: 'b-1', title: 'To Do' } as any,
      'u-1',
    );
    await listener.handleListCreatedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.created,
      entityType: EntityType.list,
      entityId: 'l-1',
      entityTitle: 'To Do',
    });
  });

  it('should catch error on list created event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleListCreatedEvent(
        new ListCreatedEvent({ id: 'l-1' } as any, 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log list updated event', async () => {
    const event = new ListUpdatedEvent(
      { id: 'l-1', boardId: 'b-1', title: 'Doing' } as any,
      'u-1',
    );
    await listener.handleListUpdatedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.updated,
      entityType: EntityType.list,
      entityId: 'l-1',
      entityTitle: 'Doing',
    });
  });

  it('should catch error on list updated event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleListUpdatedEvent(
        new ListUpdatedEvent({ id: 'l-1' } as any, 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log list moved event', async () => {
    const event = new ListMovedEvent('l-1', 'b-1', '0|b:', 'u-1');
    await listener.handleListMovedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.moved,
      entityType: EntityType.list,
      entityId: 'l-1',
    });
  });

  it('should catch error on list moved event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleListMovedEvent(
        new ListMovedEvent('l-1', 'b-1', '0|b:', 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log list archived event', async () => {
    const event = new ListArchivedEvent('l-1', 'b-1', 'u-1');
    await listener.handleListArchivedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.archived,
      entityType: EntityType.list,
      entityId: 'l-1',
    });
  });

  it('should catch error on list archived event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleListArchivedEvent(
        new ListArchivedEvent('l-1', 'b-1', 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log list unarchived event', async () => {
    const event = new ListUnarchivedEvent(
      { id: 'l-1', boardId: 'b-1', title: 'Restored List' } as any,
      'u-1',
    );
    await listener.handleListUnarchivedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.unarchived,
      entityType: EntityType.list,
      entityId: 'l-1',
      entityTitle: 'Restored List',
    });
  });

  it('should catch error on list unarchived event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleListUnarchivedEvent(
        new ListUnarchivedEvent({ id: 'l-1' } as any, 'u-1'),
      ),
    ).resolves.not.toThrow();
  });
});
