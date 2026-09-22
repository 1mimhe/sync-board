import { Test, TestingModule } from '@nestjs/testing';
import { CardActivityListener } from '../../listeners/card-activity.listener';
import { ActivityRepository } from '../../repositories/activity.repository';
import { BoardService } from '../../../board/core/services/board.service';
import {
  CardCreatedEvent,
  CardMovedEvent,
  CardUpdatedEvent,
  CardArchivedEvent,
  CardUnarchivedEvent,
  CardDeletedEvent,
  CardAssigneeAddedEvent,
  CardAssigneeRemovedEvent,
  CardPriorityChangedEvent,
  CardStatusChangedEvent,
  CardSubcardCreatedEvent,
  CardTimeLoggedEvent,
} from '../../../board/card/events/card.events';

describe('CardActivityListener', () => {
  let listener: CardActivityListener;
  let activityRepo: jest.Mocked<ActivityRepository>;
  let boardService: jest.Mocked<BoardService>;

  beforeEach(async () => {
    activityRepo = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ActivityRepository>;
    boardService = {
      findWorkspaceIdByBoardId: jest.fn().mockResolvedValue('ws-1'),
    } as unknown as jest.Mocked<BoardService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardActivityListener,
        { provide: ActivityRepository, useValue: activityRepo },
        { provide: BoardService, useValue: boardService },
      ],
    }).compile();

    listener = module.get<CardActivityListener>(CardActivityListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should record card created event', async () => {
    const event = new CardCreatedEvent(
      { id: 'c-1', title: 'Card 1' } as any,
      'b-1',
      'l-1',
      'u-1',
    );

    await listener.handleCardCreatedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'card',
      entityId: 'c-1',
      action: 'created',
      actorId: 'u-1',
      payload: { entityTitle: 'Card 1', toListId: 'l-1' },
    });
  });

  it('should catch error on card created event failure', async () => {
    activityRepo.record.mockRejectedValue(new Error('fail'));

    await expect(
      listener.handleCardCreatedEvent(
        new CardCreatedEvent({ id: 'c-1' } as any, 'b-1', 'l-1', 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should record card moved event', async () => {
    const event = new CardMovedEvent('c-1', 'b-1', 'l-1', 'l-2', '0|b:', 'u-1');

    await listener.handleCardMovedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'card',
      entityId: 'c-1',
      action: 'moved',
      actorId: 'u-1',
      payload: { fromListId: 'l-1', toListId: 'l-2' },
    });
  });

  it('should record card updated event', async () => {
    const event = new CardUpdatedEvent(
      { id: 'c-1', title: 'Card 1' } as any,
      'b-1',
      'u-1',
    );

    await listener.handleCardUpdatedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'card',
      entityId: 'c-1',
      action: 'updated',
      actorId: 'u-1',
      payload: { entityTitle: 'Card 1' },
    });
  });

  it('should record card archived event', async () => {
    const event = new CardArchivedEvent('c-1', 'b-1', 'l-1', 'u-1');

    await listener.handleCardArchivedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'card',
      entityId: 'c-1',
      action: 'archived',
      actorId: 'u-1',
      payload: { fromListId: 'l-1' },
    });
  });

  it('should record card unarchived event', async () => {
    const event = new CardUnarchivedEvent(
      { id: 'c-1', title: 'Card 1' } as any,
      'b-1',
      'l-1',
      'u-1',
    );

    await listener.handleCardUnarchivedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'card',
      entityId: 'c-1',
      action: 'unarchived',
      actorId: 'u-1',
      payload: { entityTitle: 'Card 1', fromListId: 'l-1' },
    });
  });

  it('should record card deleted event', async () => {
    const event = new CardDeletedEvent('c-1', 'b-1', 'l-1', 'u-1');

    await listener.handleCardDeletedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'card',
      entityId: 'c-1',
      action: 'deleted',
      actorId: 'u-1',
      payload: { fromListId: 'l-1' },
    });
  });

  it('should record assignee added event', async () => {
    const event = new CardAssigneeAddedEvent('c-1', 'b-1', 'u-2', 'u-1');

    await listener.handleCardAssigneeAddedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'assignee',
      entityId: 'c-1',
      action: 'created',
      actorId: 'u-1',
      payload: { userId: 'u-2' },
    });
  });

  it('should record assignee removed event', async () => {
    const event = new CardAssigneeRemovedEvent('c-1', 'b-1', 'u-2', 'u-1');

    await listener.handleCardAssigneeRemovedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'assignee',
      entityId: 'c-1',
      action: 'deleted',
      actorId: 'u-1',
      payload: { userId: 'u-2' },
    });
  });

  it('should record priority changed event', async () => {
    const event = new CardPriorityChangedEvent(
      'c-1',
      'b-1',
      'low',
      'high',
      'u-1',
    );

    await listener.handleCardPriorityChangedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'card',
      entityId: 'c-1',
      action: 'priority_changed',
      actorId: 'u-1',
      payload: { from: 'low', to: 'high' },
    });
  });

  it('should record status changed event', async () => {
    const event = new CardStatusChangedEvent(
      'c-1',
      'b-1',
      'not_started',
      'done',
      true,
      'u-1',
    );

    await listener.handleCardStatusChangedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'card',
      entityId: 'c-1',
      action: 'status_changed',
      actorId: 'u-1',
      payload: { from: 'not_started', to: 'done', isComplete: true },
    });
  });

  it('should record subcard created event', async () => {
    const event = new CardSubcardCreatedEvent(
      'c-parent',
      'c-child',
      'b-1',
      'u-1',
    );

    await listener.handleCardSubcardCreatedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'card',
      entityId: 'c-child',
      action: 'created',
      actorId: 'u-1',
      payload: { parentCardId: 'c-parent' },
    });
  });

  it('should record time logged event', async () => {
    const event = new CardTimeLoggedEvent('c-1', 'b-1', 30, 90, 't-1', 'u-1');

    await listener.handleCardTimeLoggedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'card',
      entityId: 'c-1',
      action: 'time_logged',
      actorId: 'u-1',
      payload: { minutes: 30, loggedTotal: 90 },
    });
  });

  it('should skip recording when workspace cannot be resolved', async () => {
    boardService.findWorkspaceIdByBoardId.mockResolvedValue(null);

    await listener.handleCardCreatedEvent(
      new CardCreatedEvent({ id: 'c-1' } as any, 'b-1', 'l-1', 'u-1'),
    );

    expect(activityRepo.record).not.toHaveBeenCalled();
  });
});
