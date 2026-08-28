import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActionType, EntityType } from '@prisma/client';
import { ActivityRepository } from '../repositories/activity.repository';
import type {
  CommentCreatedEvent,
  CommentUpdatedEvent,
  CommentDeletedEvent,
} from '../../board/comment/events/comment.events';
import { COMMENT_EVENTS } from '../../board/comment/events/comment-events.constants';

/**
 * Persists activity audit logs for card comment events
 * (`COMMENT_EVENTS.*`). Fault-tolerant: a failed log entry is logged and
 * swallowed so it never breaks the originating request.
 */
@Injectable()
export class CommentActivityListener {
  private readonly logger = new Logger(CommentActivityListener.name);

  constructor(private readonly activityRepo: ActivityRepository) {}

  /**
   * Logs card comment creation activity.
   */
  @OnEvent(COMMENT_EVENTS.created)
  async handleCommentCreatedEvent(event: CommentCreatedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.authorId,
        action: ActionType.created,
        entityType: EntityType.comment,
        entityId: event.comment.id,
        entityTitle: 'New Comment',
      });
    } catch (error) {
      this.logger.error('Failed to log comment.created activity', error);
    }
  }

  /**
   * Logs card comment edit activity.
   */
  @OnEvent(COMMENT_EVENTS.updated)
  async handleCommentUpdatedEvent(event: CommentUpdatedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.updatedBy,
        action: ActionType.updated,
        entityType: EntityType.comment,
        entityId: event.comment.id,
        entityTitle: 'Comment Updated',
      });
    } catch (error) {
      this.logger.error('Failed to log comment.updated activity', error);
    }
  }

  /**
   * Logs card comment deletion activity.
   */
  @OnEvent(COMMENT_EVENTS.deleted)
  async handleCommentDeletedEvent(event: CommentDeletedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.deletedBy,
        action: ActionType.deleted,
        entityType: EntityType.comment,
        entityId: event.commentId,
      });
    } catch (error) {
      this.logger.error('Failed to log comment.deleted activity', error);
    }
  }
}
