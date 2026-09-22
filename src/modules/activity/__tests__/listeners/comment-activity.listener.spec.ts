import { Test, TestingModule } from '@nestjs/testing';
import { CommentActivityListener } from '../../listeners/comment-activity.listener';
import { ActivityRepository } from '../../repositories/activity.repository';
import { BoardService } from '../../../board/core/services/board.service';
import {
  CommentCreatedEvent,
  CommentUpdatedEvent,
  CommentDeletedEvent,
} from '../../../board/comment/events/comment.events';

describe('CommentActivityListener', () => {
  let listener: CommentActivityListener;
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
        CommentActivityListener,
        { provide: ActivityRepository, useValue: activityRepo },
        { provide: BoardService, useValue: boardService },
      ],
    }).compile();

    listener = module.get<CommentActivityListener>(CommentActivityListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should record comment created event', async () => {
    const event = new CommentCreatedEvent(
      { id: 'comm-1' } as any,
      'b-1',
      'u-1',
    );

    await listener.handleCommentCreatedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'comment',
      entityId: 'comm-1',
      action: 'created',
      actorId: 'u-1',
      payload: { entityTitle: 'New Comment' },
    });
  });

  it('should catch error on comment created event failure', async () => {
    activityRepo.record.mockRejectedValue(new Error('fail'));

    await expect(
      listener.handleCommentCreatedEvent(
        new CommentCreatedEvent({ id: 'comm-1' } as any, 'b-1', 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should record comment updated event', async () => {
    const event = new CommentUpdatedEvent(
      { id: 'comm-1' } as any,
      'b-1',
      'u-1',
    );

    await listener.handleCommentUpdatedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'comment',
      entityId: 'comm-1',
      action: 'updated',
      actorId: 'u-1',
      payload: { entityTitle: 'Comment Updated' },
    });
  });

  it('should record comment deleted event', async () => {
    const event = new CommentDeletedEvent('comm-1', 'c-1', 'b-1', 'u-1');

    await listener.handleCommentDeletedEvent(event);

    expect(activityRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: 'b-1',
      entityType: 'comment',
      entityId: 'comm-1',
      action: 'deleted',
      actorId: 'u-1',
      payload: {},
    });
  });

  it('should skip recording when workspace cannot be resolved', async () => {
    boardService.findWorkspaceIdByBoardId.mockResolvedValue(null);

    await listener.handleCommentCreatedEvent(
      new CommentCreatedEvent({ id: 'comm-1' } as any, 'b-1', 'u-1'),
    );

    expect(activityRepo.record).not.toHaveBeenCalled();
  });
});
