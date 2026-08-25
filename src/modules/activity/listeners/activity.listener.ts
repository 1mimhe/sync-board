import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActionType, EntityType } from '@prisma/client';
import { ActivityRepository } from '../repositories/activity.repository';
import type {
  BoardCreatedEvent,
  BoardUpdatedEvent,
  BoardArchivedEvent,
  BoardUnarchivedEvent,
} from '../../board/board/events/board.events';
import type {
  ListCreatedEvent,
  ListUpdatedEvent,
  ListMovedEvent,
  ListArchivedEvent,
  ListUnarchivedEvent,
} from '../../board/list/events/list.events';
import type {
  CardCreatedEvent,
  CardMovedEvent,
  CardUpdatedEvent,
  CardArchivedEvent,
  CardUnarchivedEvent,
} from '../../board/card/events/card.events';
import type { CommentCreatedEvent } from '../../board/comment/events/comment.events';
import { BOARD_EVENTS } from '../../board/board/events/board-events.constants';
import { CARD_EVENTS } from '../../board/card/events/card-events.constants';
import { COMMENT_EVENTS } from '../../board/comment/events/comment-events.constants';
import { LIST_EVENTS } from '../../board/list/events/list-events.constants';

/**
 * Event listener handling board domain events and persisting structured activity audit logs.
 */
@Injectable()
export class ActivityListener {
  private readonly logger = new Logger(ActivityListener.name);

  constructor(private readonly activityRepo: ActivityRepository) {}

  // =========================================================================
  // BOARD EVENTS
  // =========================================================================

  /**
   * Logs board creation activity.
   */
  @OnEvent(BOARD_EVENTS.created)
  async handleBoardCreatedEvent(event: BoardCreatedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.board.id,
        userId: event.createdBy,
        action: ActionType.created,
        entityType: EntityType.board,
        entityId: event.board.id,
        entityTitle: event.board.title,
      });
    } catch (error) {
      this.logger.error('Failed to log board.created activity', error);
    }
  }

  /**
   * Logs board update activity.
   */
  @OnEvent(BOARD_EVENTS.updated)
  async handleBoardUpdatedEvent(event: BoardUpdatedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.board.id,
        userId: event.updatedBy,
        action: ActionType.updated,
        entityType: EntityType.board,
        entityId: event.board.id,
        entityTitle: event.board.title,
      });
    } catch (error) {
      this.logger.error('Failed to log board.updated activity', error);
    }
  }

  /**
   * Logs board archive activity.
   */
  @OnEvent(BOARD_EVENTS.archived)
  async handleBoardArchivedEvent(event: BoardArchivedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.archivedBy,
        action: ActionType.archived,
        entityType: EntityType.board,
        entityId: event.boardId,
      });
    } catch (error) {
      this.logger.error('Failed to log board.archived activity', error);
    }
  }

  /**
   * Logs board restoration activity.
   */
  @OnEvent(BOARD_EVENTS.unarchived)
  async handleBoardUnarchivedEvent(event: BoardUnarchivedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.board.id,
        userId: event.unarchivedBy,
        action: ActionType.unarchived,
        entityType: EntityType.board,
        entityId: event.board.id,
        entityTitle: event.board.title,
      });
    } catch (error) {
      this.logger.error('Failed to log board.unarchived activity', error);
    }
  }

  // =========================================================================
  // LIST EVENTS
  // =========================================================================

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

  // =========================================================================
  // CARD EVENTS
  // =========================================================================

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

  // =========================================================================
  // COMMENT EVENTS
  // =========================================================================

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
}
