import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActionType, EntityType } from '@prisma/client';
import { ActivityRepository } from '../repositories/activity.repository';
import type {
  CardCreatedEvent,
  CardMovedEvent,
  CardUpdatedEvent,
  CardArchivedEvent,
  CardUnarchivedEvent,
  CardAssigneeAddedEvent,
  CardAssigneeRemovedEvent,
} from '../../board/card/events/card.events';
import { CARD_EVENTS } from '../../board/card/events/card-events.constants';

/**
 * Persists activity audit logs for card lifecycle and assignee events
 * (`CARD_EVENTS.*`). Fault-tolerant: a failed log entry is logged and
 * swallowed so it never breaks the originating request.
 */
@Injectable()
export class CardActivityListener {
  private readonly logger = new Logger(CardActivityListener.name);

  constructor(private readonly activityRepo: ActivityRepository) {}

  /**
   * Logs card creation activity.
   */
  @OnEvent(CARD_EVENTS.created)
  async handleCardCreatedEvent(event: CardCreatedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.createdBy,
        action: ActionType.created,
        entityType: EntityType.card,
        entityId: event.card.id,
        entityTitle: event.card.title,
        toListId: event.listId,
      });
    } catch (error) {
      this.logger.error('Failed to log card.created activity', error);
    }
  }

  /**
   * Logs card move / reorder activity.
   */
  @OnEvent(CARD_EVENTS.moved)
  async handleCardMovedEvent(event: CardMovedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.movedBy,
        action: ActionType.moved,
        entityType: EntityType.card,
        entityId: event.cardId,
        fromListId: event.sourceListId,
        toListId: event.targetListId,
      });
    } catch (error) {
      this.logger.error('Failed to log card.moved activity', error);
    }
  }

  /**
   * Logs card update activity.
   */
  @OnEvent(CARD_EVENTS.updated)
  async handleCardUpdatedEvent(event: CardUpdatedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.updatedBy,
        action: ActionType.updated,
        entityType: EntityType.card,
        entityId: event.card.id,
        entityTitle: event.card.title,
      });
    } catch (error) {
      this.logger.error('Failed to log card.updated activity', error);
    }
  }

  /**
   * Logs card archive activity.
   */
  @OnEvent(CARD_EVENTS.archived)
  async handleCardArchivedEvent(event: CardArchivedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.archivedBy,
        action: ActionType.archived,
        entityType: EntityType.card,
        entityId: event.cardId,
        fromListId: event.listId,
      });
    } catch (error) {
      this.logger.error('Failed to log card.archived activity', error);
    }
  }

  /**
   * Logs card restoration activity.
   */
  @OnEvent(CARD_EVENTS.unarchived)
  async handleCardUnarchivedEvent(event: CardUnarchivedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.unarchivedBy,
        action: ActionType.unarchived,
        entityType: EntityType.card,
        entityId: event.card.id,
        entityTitle: event.card.title,
        fromListId: event.listId,
      });
    } catch (error) {
      this.logger.error('Failed to log card.unarchived activity', error);
    }
  }

  /**
   * Logs card assignee addition activity.
   */
  @OnEvent(CARD_EVENTS.assigneeAdded)
  async handleCardAssigneeAddedEvent(
    event: CardAssigneeAddedEvent,
  ): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.addedBy,
        action: ActionType.created,
        entityType: EntityType.assignee,
        entityId: event.cardId,
        entityTitle: event.userId,
      });
    } catch (error) {
      this.logger.error('Failed to log card.assignee_added activity', error);
    }
  }

  /**
   * Logs card assignee removal activity.
   */
  @OnEvent(CARD_EVENTS.assigneeRemoved)
  async handleCardAssigneeRemovedEvent(
    event: CardAssigneeRemovedEvent,
  ): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.removedBy,
        action: ActionType.deleted,
        entityType: EntityType.assignee,
        entityId: event.cardId,
        entityTitle: event.userId,
      });
    } catch (error) {
      this.logger.error('Failed to log card.assignee_removed activity', error);
    }
  }
}
