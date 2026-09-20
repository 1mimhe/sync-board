import { Test, TestingModule } from '@nestjs/testing';
import { ListActivityListener } from '../../listeners/list-activity.listener';
import { ActivityRepository } from '../../repositories/activity.repository';
import { BoardService } from '../../../board/core/services/board.service';
import {
  ListCreatedEvent,
  ListUpdatedEvent,
  ListMovedEvent,
  ListArchivedEvent,
  ListUnarchivedEvent,
  ListDeletedEvent,
} from '../../../board/list/events/list.events';

describe('ListActivityListener', () => {
  let listener: ListActivityListener;
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
        ListActivityListener,
        { provide: ActivityRepository, useValue: activityRepo },
        { provide: BoardService, useValue: boardService },
      ],
    }).compile();

    listener = module.get<ListActivityListener>(ListActivityListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should record list created event', async () => {
    const event = new ListCreatedEvent(
      { id: 'l-1', boardId: 'b-1', title: 'To Do' } as any,
      'u-1',
    );

    await listener.handleListCreatedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'list',
      entityId: 'l-1',
      action: 'created',
      actorId: 'u-1',
      payload: { entityTitle: 'To Do' },
    });
  });

  it('should catch error on list created event failure', async () => {
    activityRepo.record.mockRejectedValue(new Error('fail'));

    await expect(
      listener.handleListCreatedEvent(
        new ListCreatedEvent({ id: 'l-1', boardId: 'b-1' } as any, 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should record list updated event', async () => {
    const event = new ListUpdatedEvent(
      { id: 'l-1', boardId: 'b-1', title: 'Doing' } as any,
      'u-2',
    );

    await listener.handleListUpdatedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'list',
      entityId: 'l-1',
      action: 'updated',
      actorId: 'u-2',
      payload: { entityTitle: 'Doing' },
    });
  });

  it('should record list moved event', async () => {
    const event = new ListMovedEvent('l-1', 'b-1', '0|h:', 'u-1');

    await listener.handleListMovedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'list',
      entityId: 'l-1',
      action: 'moved',
      actorId: 'u-1',
      payload: { newRank: '0|h:' },
    });
  });

  it('should record list archived event', async () => {
    const event = new ListArchivedEvent('l-1', 'b-1', 'u-1');

    await listener.handleListArchivedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'list',
      entityId: 'l-1',
      action: 'archived',
      actorId: 'u-1',
      payload: {},
    });
  });

  it('should record list unarchived event', async () => {
    const event = new ListUnarchivedEvent(
      { id: 'l-1', boardId: 'b-1', title: 'To Do' } as any,
      'u-1',
    );

    await listener.handleListUnarchivedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'list',
      entityId: 'l-1',
      action: 'unarchived',
      actorId: 'u-1',
      payload: { entityTitle: 'To Do' },
    });
  });

  it('should record list deleted event', async () => {
    const event = new ListDeletedEvent('l-1', 'b-1', 'u-1');

    await listener.handleListDeletedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'list',
      entityId: 'l-1',
      action: 'deleted',
      actorId: 'u-1',
      payload: {},
    });
  });

  it('should skip recording when workspace cannot be resolved', async () => {
    boardService.findWorkspaceIdByBoardId.mockResolvedValue(null);

    await listener.handleListCreatedEvent(
      new ListCreatedEvent({ id: 'l-1', boardId: 'b-1' } as any, 'u-1'),
    );

    expect(activityRepo.record).not.toHaveBeenCalled();
  });
});
