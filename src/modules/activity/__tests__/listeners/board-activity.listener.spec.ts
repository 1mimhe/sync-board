import { Test, TestingModule } from '@nestjs/testing';
import { BoardActivityListener } from '../../listeners/board-activity.listener';
import { ActivityRepository } from '../../repositories/activity.repository';
import {
  BoardCreatedEvent,
  BoardUpdatedEvent,
  BoardArchivedEvent,
  BoardUnarchivedEvent,
} from '../../../board/board/events/board.events';
import { ActionType, EntityType } from '@prisma/client';

describe('BoardActivityListener', () => {
  let listener: BoardActivityListener;
  let activityRepo: jest.Mocked<ActivityRepository>;

  beforeEach(async () => {
    activityRepo = {
      create: jest.fn().mockResolvedValue({ id: 'act-1' } as any),
      findByBoardId: jest.fn(),
    } as unknown as jest.Mocked<ActivityRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardActivityListener,
        { provide: ActivityRepository, useValue: activityRepo },
      ],
    }).compile();

    listener = module.get<BoardActivityListener>(BoardActivityListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log board created event', async () => {
    const event = new BoardCreatedEvent(
      { id: 'b-1', title: 'Board' } as any,
      'u-1',
    );
    await listener.handleBoardCreatedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.created,
      entityType: EntityType.board,
      entityId: 'b-1',
      entityTitle: 'Board',
    });
  });

  it('should catch error on board created event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleBoardCreatedEvent(
        new BoardCreatedEvent({ id: 'b-1' } as any, 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log board updated event', async () => {
    const event = new BoardUpdatedEvent(
      { id: 'b-1', title: 'Updated Board' } as any,
      'u-1',
    );
    await listener.handleBoardUpdatedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.updated,
      entityType: EntityType.board,
      entityId: 'b-1',
      entityTitle: 'Updated Board',
    });
  });

  it('should catch error on board updated event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleBoardUpdatedEvent(
        new BoardUpdatedEvent({ id: 'b-1' } as any, 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log board archived event', async () => {
    const event = new BoardArchivedEvent('b-1', 'ws-1', 'u-1');
    await listener.handleBoardArchivedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.archived,
      entityType: EntityType.board,
      entityId: 'b-1',
    });
  });

  it('should catch error on board archived event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleBoardArchivedEvent(
        new BoardArchivedEvent('b-1', 'ws-1', 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log board unarchived event', async () => {
    const event = new BoardUnarchivedEvent(
      { id: 'b-1', title: 'Restored Board' } as any,
      'u-1',
    );
    await listener.handleBoardUnarchivedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.unarchived,
      entityType: EntityType.board,
      entityId: 'b-1',
      entityTitle: 'Restored Board',
    });
  });

  it('should catch error on board unarchived event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleBoardUnarchivedEvent(
        new BoardUnarchivedEvent({ id: 'b-1' } as any, 'u-1'),
      ),
    ).resolves.not.toThrow();
  });
});
