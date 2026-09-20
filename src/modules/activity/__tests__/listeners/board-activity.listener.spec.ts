import { Test, TestingModule } from '@nestjs/testing';
import { BoardActivityListener } from '../../listeners/board-activity.listener';
import { ActivityRepository } from '../../repositories/activity.repository';
import {
  BoardCreatedEvent,
  BoardUpdatedEvent,
  BoardArchivedEvent,
  BoardUnarchivedEvent,
  BoardDeletedEvent,
} from '../../../board/core/events/board.events';
import { BoardService } from '../../../board/core/services/board.service';

describe('BoardActivityListener', () => {
  let listener: BoardActivityListener;
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
        BoardActivityListener,
        { provide: ActivityRepository, useValue: activityRepo },
        { provide: BoardService, useValue: boardService },
      ],
    }).compile();

    listener = module.get<BoardActivityListener>(BoardActivityListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should record board created event with workspace and payload', async () => {
    const event = new BoardCreatedEvent(
      { id: 'b-1', title: 'Board' } as any,
      'u-1',
    );

    await listener.handleBoardCreatedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'board',
      entityId: 'b-1',
      action: 'created',
      actorId: 'u-1',
      payload: { entityTitle: 'Board' },
    });
  });

  it('should catch error on board created event failure', async () => {
    activityRepo.record.mockRejectedValue(new Error('fail'));

    await expect(
      listener.handleBoardCreatedEvent(
        new BoardCreatedEvent({ id: 'b-1' } as any, 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should record board updated event', async () => {
    const event = new BoardUpdatedEvent(
      { id: 'b-1', title: 'Board' } as any,
      'u-2',
    );

    await listener.handleBoardUpdatedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'board',
      entityId: 'b-1',
      action: 'updated',
      actorId: 'u-2',
      payload: { entityTitle: 'Board' },
    });
  });

  it('should record board archived event', async () => {
    const event = new BoardArchivedEvent('b-1', 'ws-1', 'u-3');

    await listener.handleBoardArchivedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'board',
      entityId: 'b-1',
      action: 'archived',
      actorId: 'u-3',
      payload: { workspaceId: 'ws-1' },
    });
  });

  it('should record board unarchived event', async () => {
    const event = new BoardUnarchivedEvent(
      { id: 'b-1', title: 'Board' } as any,
      'u-4',
    );

    await listener.handleBoardUnarchivedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'board',
      entityId: 'b-1',
      action: 'unarchived',
      actorId: 'u-4',
      payload: { entityTitle: 'Board' },
    });
  });

  it('should record board deleted event', async () => {
    const event = new BoardDeletedEvent('b-1', 'ws-1', 'u-5');

    await listener.handleBoardDeletedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'board',
      entityId: 'b-1',
      action: 'deleted',
      actorId: 'u-5',
      payload: { workspaceId: 'ws-1' },
    });
  });

  it('should skip recording when workspace cannot be resolved', async () => {
    boardService.findWorkspaceIdByBoardId.mockResolvedValue(null);

    await listener.handleBoardCreatedEvent(
      new BoardCreatedEvent({ id: 'b-1' } as any, 'u-1'),
    );

    expect(activityRepo.record).not.toHaveBeenCalled();
  });
});
