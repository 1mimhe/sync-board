import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ActivityRepository,
  type RecordActivityInput,
} from '../repositories/activity.repository';
import { BoardService } from '../../board/core/services/board.service';
import type {
  CommentCreatedEvent,
  CommentUpdatedEvent,
  CommentDeletedEvent,
} from '../../board/comment/events/comment.events';
import { COMMENT_EVENTS } from '../../board/comment/events/comment-events.constants';

/**
 * Persists workspace-scoped activity events for card comment events
 * (`COMMENT_EVENTS.*`). Fault-tolerant: a failed log entry is logged and
 * swallowed so it never breaks the originating request.
 */
@Injectable()
export class CommentActivityListener {
  private readonly logger = new Logger(CommentActivityListener.name);

  constructor(
    private readonly activityRepo: ActivityRepository,
    private readonly boardService: BoardService,
  ) {}

  private async handle(
    boardId: string,
    actorId: string,
    entityId: string,
    action: string,
    payload: RecordActivityInput['payload'],
  ): Promise<void> {
    try {
      const workspaceId =
        await this.boardService.findWorkspaceIdByBoardId(boardId);
      if (!workspaceId) {
        this.logger.warn(
          `Skipping activity record: no workspace for board ${boardId}`,
        );
        return;
      }
      await this.activityRepo.record({
        workspaceId,
        boardId,
        entityType: 'comment',
        entityId,
        action,
        actorId,
        payload,
      });
    } catch (error) {
      this.logger.error(
        'Failed to log comment activity',
        (error as Error).stack,
      );
    }
  }

  /**
   * Logs card comment creation activity.
   */
  @OnEvent(COMMENT_EVENTS.created)
  async handleCommentCreatedEvent(event: CommentCreatedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.authorId,
      event.comment.id,
      'created',
      {
        entityTitle: 'New Comment',
      },
    );
  }

  /**
   * Logs card comment edit activity.
   */
  @OnEvent(COMMENT_EVENTS.updated)
  async handleCommentUpdatedEvent(event: CommentUpdatedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.updatedBy,
      event.comment.id,
      'updated',
      {
        entityTitle: 'Comment Updated',
      },
    );
  }

  /**
   * Logs card comment deletion activity.
   */
  @OnEvent(COMMENT_EVENTS.deleted)
  async handleCommentDeletedEvent(event: CommentDeletedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.deletedBy,
      event.commentId,
      'deleted',
      {},
    );
  }
}
