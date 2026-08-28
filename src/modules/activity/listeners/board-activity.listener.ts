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
import { BOARD_EVENTS } from '../../board/board/events/board-events.constants';

/**
 * Persists activity audit logs for board lifecycle events
 * (`BOARD_EVENTS.*`). Fault-tolerant: a failed log entry is logged and
 * swallowed so it never breaks the originating request.
 */
@Injectable()
export class BoardActivityListener {
  private readonly logger = new Logger(BoardActivityListener.name);

  constructor(private readonly activityRepo: ActivityRepository) {}

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
}
