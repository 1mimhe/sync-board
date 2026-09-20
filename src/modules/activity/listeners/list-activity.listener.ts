import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ActivityRepository,
  type RecordActivityInput,
} from '../repositories/activity.repository';
import { BoardService } from '../../board/core/services/board.service';
import type {
  ListCreatedEvent,
  ListUpdatedEvent,
  ListMovedEvent,
  ListArchivedEvent,
  ListUnarchivedEvent,
  ListDeletedEvent,
} from '../../board/list/events/list.events';
import { LIST_EVENTS } from '../../board/list/events/list-events.constants';

/**
 * Persists workspace-scoped activity events for list lifecycle events
 * (`LIST_EVENTS.*`). Fault-tolerant: a failed log entry is logged and
 * swallowed so it never breaks the originating request.
 */
@Injectable()
export class ListActivityListener {
  private readonly logger = new Logger(ListActivityListener.name);

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
        entityType,
        entityId,
        action,
        actorId,
        payload,
      });
    } catch (error) {
      this.logger.error('Failed to log list activity', (error as Error).stack);
    }
  }

  /**
   * Logs list creation activity.
   */
  @OnEvent(LIST_EVENTS.created)
  async handleListCreatedEvent(event: ListCreatedEvent): Promise<void> {
    await this.handle(
      event.list.boardId,
      event.createdBy,
      'list',
      event.list.id,
      'created',
      { entityTitle: event.list.title },
    );
  }

  /**
   * Logs list update activity.
   */
  @OnEvent(LIST_EVENTS.updated)
  async handleListUpdatedEvent(event: ListUpdatedEvent): Promise<void> {
    await this.handle(
      event.list.boardId,
      event.updatedBy,
      'list',
      event.list.id,
      'updated',
      { entityTitle: event.list.title },
    );
  }

  /**
   * Logs list reorder (move) activity.
   */
  @OnEvent(LIST_EVENTS.moved)
  async handleListMovedEvent(event: ListMovedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.movedBy,
      'list',
      event.listId,
      'moved',
      { newRank: event.newRank },
    );
  }

  /**
   * Logs list archive activity.
   */
  @OnEvent(LIST_EVENTS.archived)
  async handleListArchivedEvent(event: ListArchivedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.archivedBy,
      'list',
      event.listId,
      'archived',
      {},
    );
  }

  /**
   * Logs list restoration activity.
   */
  @OnEvent(LIST_EVENTS.unarchived)
  async handleListUnarchivedEvent(event: ListUnarchivedEvent): Promise<void> {
    await this.handle(
      event.list.boardId,
      event.unarchivedBy,
      'list',
      event.list.id,
      'unarchived',
      { entityTitle: event.list.title },
    );
  }

  /**
   * Logs list permanent-delete activity.
   */
  @OnEvent(LIST_EVENTS.deleted)
  async handleListDeletedEvent(event: ListDeletedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.deletedBy,
      'list',
      event.listId,
      'deleted',
      {},
    );
  }
}
