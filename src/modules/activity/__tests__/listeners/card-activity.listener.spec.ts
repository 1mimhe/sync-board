import { Test, TestingModule } from '@nestjs/testing';
import { CardActivityListener } from '../../listeners/card-activity.listener';
import { ActivityRepository } from '../../repositories/activity.repository';
import {
  CardCreatedEvent,
  CardMovedEvent,
  CardUpdatedEvent,
  CardArchivedEvent,
  CardUnarchivedEvent,
  CardAssigneeAddedEvent,
  CardAssigneeRemovedEvent,
} from '../../../board/card/events/card.events';
import { ActionType, EntityType } from '@prisma/client';

describe('CardActivityListener', () => {
  let listener: CardActivityListener;
  let activityRepo: jest.Mocked<ActivityRepository>;

  beforeEach(async () => {
    activityRepo = {
      create: jest.fn().mockResolvedValue({ id: 'act-1' } as any),
      findByBoardId: jest.fn(),
    } as unknown as jest.Mocked<ActivityRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardActivityListener,
        { provide: ActivityRepository, useValue: activityRepo },
      ],
    }).compile();

    listener = module.get<CardActivityListener>(CardActivityListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log card created event', async () => {
    const event = new CardCreatedEvent(
      { id: 'c-1', title: 'Card 1' } as any,
      'b-1',
      'l-1',
      'u-1',
    );
    await listener.handleCardCreatedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.created,
      entityType: EntityType.card,
      entityId: 'c-1',
      entityTitle: 'Card 1',
      toListId: 'l-1',
    });
  });

  it('should catch error on card created event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleCardCreatedEvent(
        new CardCreatedEvent({ id: 'c-1' } as any, 'b-1', 'l-1', 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log card moved event', async () => {
    const event = new CardMovedEvent('c-1', 'b-1', 'l-1', 'l-2', '0|b:', 'u-1');
    await listener.handleCardMovedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.moved,
      entityType: EntityType.card,
      entityId: 'c-1',
      fromListId: 'l-1',
      toListId: 'l-2',
    });
  });

  it('should catch error on card moved event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleCardMovedEvent(
        new CardMovedEvent('c-1', 'b-1', 'l-1', 'l-2', '0|b:', 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log card updated event', async () => {
    const event = new CardUpdatedEvent(
      { id: 'c-1', title: 'Updated Card' } as any,
      'b-1',
      'u-1',
    );
    await listener.handleCardUpdatedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.updated,
      entityType: EntityType.card,
      entityId: 'c-1',
      entityTitle: 'Updated Card',
    });
  });

  it('should catch error on card updated event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleCardUpdatedEvent(
        new CardUpdatedEvent({ id: 'c-1' } as any, 'b-1', 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log card archived event', async () => {
    const event = new CardArchivedEvent('c-1', 'b-1', 'l-1', 'u-1');
    await listener.handleCardArchivedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.archived,
      entityType: EntityType.card,
      entityId: 'c-1',
      fromListId: 'l-1',
    });
  });

  it('should catch error on card archived event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleCardArchivedEvent(
        new CardArchivedEvent('c-1', 'b-1', 'l-1', 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log card unarchived event', async () => {
    const event = new CardUnarchivedEvent(
      { id: 'c-1', title: 'Restored Card' } as any,
      'b-1',
      'l-1',
      'u-1',
    );
    await listener.handleCardUnarchivedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.unarchived,
      entityType: EntityType.card,
      entityId: 'c-1',
      entityTitle: 'Restored Card',
      fromListId: 'l-1',
    });
  });

  it('should catch error on card unarchived event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleCardUnarchivedEvent(
        new CardUnarchivedEvent({ id: 'c-1' } as any, 'b-1', 'l-1', 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log assignee added event and contain failures', async () => {
    const event = new CardAssigneeAddedEvent('c-1', 'b-1', 'assignee-1', 'u-1');
    await listener.handleCardAssigneeAddedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.created,
      entityType: EntityType.assignee,
      entityId: 'c-1',
      entityTitle: 'assignee-1',
    });

    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleCardAssigneeAddedEvent(event),
    ).resolves.not.toThrow();
  });

  it('should log assignee removed event and contain failures', async () => {
    const event = new CardAssigneeRemovedEvent(
      'c-1',
      'b-1',
      'assignee-1',
      'u-1',
    );
    await listener.handleCardAssigneeRemovedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.deleted,
      entityType: EntityType.assignee,
      entityId: 'c-1',
      entityTitle: 'assignee-1',
    });

    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleCardAssigneeRemovedEvent(event),
    ).resolves.not.toThrow();
  });
});
