import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActionType, EntityType } from '@prisma/client';
import { ActivityRepository } from '../repositories/activity.repository';
import type {
  ListCreatedEvent,
  ListUpdatedEvent,
  ListMovedEvent,
  ListArchivedEvent,
  ListUnarchivedEvent,
} from '../../board/list/events/list.events';
import { LIST_EVENTS } from '../../board/list/events/list-events.constants';

/**
 * Persists activity audit logs for list lifecycle events
 * (`LIST_EVENTS.*`). Fault-tolerant: a failed log entry is logged and
 * swallowed so it never breaks the originating request.
 */
@Injectable()
export class ListActivityListener {
  private readonly logger = new Logger(ListActivityListener.name);

  constructor(private readonly activityRepo: ActivityRepository) {}

  /**
   * Logs list creation activity.
   */
  @OnEvent(LIST_EVENTS.created)
  async handleListCreatedEvent(event: ListCreatedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.list.boardId,
        userId: event.createdBy,
        action: ActionType.created,
        entityType: EntityType.list,
        entityId: event.list.id,
        entityTitle: event.list.title,
      });
    } catch (error) {
      this.logger.error('Failed to log list.created activity', error);
    }
  }

  /**
   * Logs list update activity.
   */
  @OnEvent(LIST_EVENTS.updated)
  async handleListUpdatedEvent(event: ListUpdatedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.list.boardId,
        userId: event.updatedBy,
        action: ActionType.updated,
        entityType: EntityType.list,
        entityId: event.list.id,
        entityTitle: event.list.title,
      });
    } catch (error) {
      this.logger.error('Failed to log list.updated activity', error);
    }
  }

  /**
   * Logs list reorder (move) activity.
   */
  @OnEvent(LIST_EVENTS.moved)
  async handleListMovedEvent(event: ListMovedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.movedBy,
        action: ActionType.moved,
        entityType: EntityType.list,
        entityId: event.listId,
      });
    } catch (error) {
      this.logger.error('Failed to log list.moved activity', error);
    }
  }

  /**
   * Logs list archive activity.
   */
  @OnEvent(LIST_EVENTS.archived)
  async handleListArchivedEvent(event: ListArchivedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.archivedBy,
        action: ActionType.archived,
        entityType: EntityType.list,
        entityId: event.listId,
      });
    } catch (error) {
      this.logger.error('Failed to log list.archived activity', error);
    }
  }

  /**
   * Logs list restoration activity.
   */
  @OnEvent(LIST_EVENTS.unarchived)
  async handleListUnarchivedEvent(event: ListUnarchivedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.list.boardId,
        userId: event.unarchivedBy,
        action: ActionType.unarchived,
        entityType: EntityType.list,
        entityId: event.list.id,
        entityTitle: event.list.title,
      });
    } catch (error) {
      this.logger.error('Failed to log list.unarchived activity', error);
    }
  }
}
