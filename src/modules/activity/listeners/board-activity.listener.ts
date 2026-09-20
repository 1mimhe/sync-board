import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ActivityRepository,
  type RecordActivityInput,
} from '../repositories/activity.repository';
import { BoardService } from '../../board/core/services/board.service';
import type {
  BoardCreatedEvent,
  BoardUpdatedEvent,
  BoardArchivedEvent,
  BoardUnarchivedEvent,
  BoardDeletedEvent,
} from '../../board/core/events/board.events';
import { BOARD_EVENTS } from '../../board/core/events/board-events.constants';

/**
 * Persists workspace-scoped activity events for board lifecycle events
 * (`BOARD_EVENTS.*`). Fault-tolerant: a failed log entry is logged and
 * swallowed so it never breaks the originating request.
 */
@Injectable()
export class BoardActivityListener {
  private readonly logger = new Logger(BoardActivityListener.name);

  constructor(
    private readonly activityRepo: ActivityRepository,
    private readonly boardService: BoardService,
  ) {}

  private async handle(
    boardId: string,
    actorId: string,
    entityType: RecordActivityInput['entityType'],
    entityId: string,
    action: string,
    payload: RecordActivityInput['payload'],
    workspaceId?: string,
  ): Promise<void> {
    try {
      const resolvedWorkspaceId =
        workspaceId ??
        (await this.boardService.findWorkspaceIdByBoardId(boardId));
      if (!resolvedWorkspaceId) {
        this.logger.warn(
          `Skipping activity record: no workspace for board ${boardId}`,
        );
        return;
      }
      await this.activityRepo.record({
        workspaceId: resolvedWorkspaceId,
        boardId,
        entityType,
        entityId,
        action,
        actorId,
        payload,
      });
    } catch (error) {
      this.logger.error('Failed to log board activity', (error as Error).stack);
    }
  }

  /**
   * Logs board creation activity.
   */
  @OnEvent(BOARD_EVENTS.created)
  async handleBoardCreatedEvent(event: BoardCreatedEvent): Promise<void> {
    await this.handle(
      event.board.id,
      event.createdBy,
      'board',
      event.board.id,
      'created',
      { entityTitle: event.board.title },
      event.board.workspaceId,
    );
  }

  /**
   * Logs board update activity.
   */
  @OnEvent(BOARD_EVENTS.updated)
  async handleBoardUpdatedEvent(event: BoardUpdatedEvent): Promise<void> {
    await this.handle(
      event.board.id,
      event.updatedBy,
      'board',
      event.board.id,
      'updated',
      { entityTitle: event.board.title },
      event.board.workspaceId,
    );
  }

  /**
   * Logs board archive activity.
   */
  @OnEvent(BOARD_EVENTS.archived)
  async handleBoardArchivedEvent(event: BoardArchivedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.archivedBy,
      'board',
      event.boardId,
      'archived',
      { workspaceId: event.workspaceId },
      event.workspaceId,
    );
  }
  /**
   * Logs board restoration activity.
   */
  @OnEvent(BOARD_EVENTS.unarchived)
  async handleBoardUnarchivedEvent(event: BoardUnarchivedEvent): Promise<void> {
    await this.handle(
      event.board.id,
      event.unarchivedBy,
      'board',
      event.board.id,
      'unarchived',
      { entityTitle: event.board.title },
      event.board.workspaceId,
    );
  }

  /**
   * Logs board permanent-delete activity.
   */
  @OnEvent(BOARD_EVENTS.deleted)
  async handleBoardDeletedEvent(event: BoardDeletedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.deletedBy,
      'board',
      event.boardId,
      'deleted',
      { workspaceId: event.workspaceId },
      event.workspaceId,
    );
  }
}
