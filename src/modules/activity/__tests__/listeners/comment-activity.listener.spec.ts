import { Test, TestingModule } from '@nestjs/testing';
import { CommentActivityListener } from '../../listeners/comment-activity.listener';
import { ActivityRepository } from '../../repositories/activity.repository';
import {
  CommentCreatedEvent,
  CommentUpdatedEvent,
  CommentDeletedEvent,
} from '../../../board/comment/events/comment.events';
import { ActionType, EntityType } from '@prisma/client';

describe('CommentActivityListener', () => {
  let listener: CommentActivityListener;
  let activityRepo: jest.Mocked<ActivityRepository>;

  beforeEach(async () => {
    activityRepo = {
      create: jest.fn().mockResolvedValue({ id: 'act-1' } as any),
      findByBoardId: jest.fn(),
    } as unknown as jest.Mocked<ActivityRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentActivityListener,
        { provide: ActivityRepository, useValue: activityRepo },
      ],
    }).compile();

    listener = module.get<CommentActivityListener>(CommentActivityListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log comment created event', async () => {
    const event = new CommentCreatedEvent(
      { id: 'comm-1' } as any,
      'b-1',
      'u-1',
    );
    await listener.handleCommentCreatedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.created,
      entityType: EntityType.comment,
      entityId: 'comm-1',
      entityTitle: 'New Comment',
    });
  });

  it('should catch error on comment created event failure', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleCommentCreatedEvent(
        new CommentCreatedEvent({ id: 'comm-1' } as any, 'b-1', 'u-1'),
      ),
    ).resolves.not.toThrow();
  });

  it('should log comment updated event and contain failures', async () => {
    const event = new CommentUpdatedEvent(
      { id: 'comm-1' } as any,
      'b-1',
      'u-2',
    );
    await listener.handleCommentUpdatedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-2',
      action: ActionType.updated,
      entityType: EntityType.comment,
      entityId: 'comm-1',
      entityTitle: 'Comment Updated',
    });

    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleCommentUpdatedEvent(event),
    ).resolves.not.toThrow();
  });

  it('should log comment deleted event and contain failures', async () => {
    const event = new CommentDeletedEvent('comm-1', 'c-1', 'b-1', 'u-2');
    await listener.handleCommentDeletedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-2',
      action: ActionType.deleted,
      entityType: EntityType.comment,
      entityId: 'comm-1',
    });

    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleCommentDeletedEvent(event),
    ).resolves.not.toThrow();
  });
});
