import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivityRepository } from '../repositories/activity.repository';
import type {
  ActivityActionType,
  RecordActivityInput,
} from '../interfaces/activity.interfaces';
import { BoardService } from '../../board/core/services/board.service';
import type {
  CardCreatedEvent,
  CardMovedEvent,
  CardUpdatedEvent,
  CardArchivedEvent,
  CardUnarchivedEvent,
  CardAssigneeAddedEvent,
  CardAssigneeRemovedEvent,
  CardPriorityChangedEvent,
  CardStatusChangedEvent,
  CardSubcardCreatedEvent,
  CardTimeLoggedEvent,
} from '../../board/card/events/card.events';
import { CARD_EVENTS } from '../../board/card/events/card-events.constants';
import { CardDeletedEvent } from '../../board/card/events/card.events';

/**
 * Persists workspace-scoped activity events for card lifecycle, 5.5 card
 * field, subcard, time-logging, and delete events (`CARD_EVENTS.*`).
 * Fault-tolerant: a failed log entry is logged and swallowed so it never
 * breaks the originating request.
 */
@Injectable()
export class CardActivityListener {
  private readonly logger = new Logger(CardActivityListener.name);

  constructor(
    private readonly activityRepo: ActivityRepository,
    private readonly boardService: BoardService,
  ) {}

  private async resolveWorkspaceId(boardId: string): Promise<string | null> {
    return this.boardService.findWorkspaceIdByBoardId(boardId);
  }

  private async record(
    boardId: string,
    actorId: string,
    entityType: RecordActivityInput['entityType'],
    entityId: string,
    action: ActivityActionType,
    payload: RecordActivityInput['payload'],
  ): Promise<void> {
    const workspaceId = await this.resolveWorkspaceId(boardId);
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
  }

  /**
   * Logs card creation activity.
   */
  private async handle(
    boardId: string | undefined,
    actorId: string,
    entityType: RecordActivityInput['entityType'],
    entityId: string,
    action: ActivityActionType,
    payload: RecordActivityInput['payload'],
  ): Promise<void> {
    if (!boardId) {
      this.logger.warn(
        `Skipping activity record: event missing boardId for entity ${entityId}`,
      );
      return;
    }
    try {
      await this.record(
        boardId,
        actorId,
        entityType,
        entityId,
        action,
        payload,
      );
    } catch (error) {
      this.logger.error('Failed to log activity', (error as Error).stack);
    }
  }

  /**
   * Logs card creation activity.
   */
  @OnEvent(CARD_EVENTS.created)
  async handleCardCreatedEvent(event: CardCreatedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.createdBy,
      'card',
      event.card.id,
      'created',
      { entityTitle: event.card.title, toListId: event.listId },
    );
  }

  /**
   * Logs card move / reorder activity.
   */
  @OnEvent(CARD_EVENTS.moved)
  async handleCardMovedEvent(event: CardMovedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.movedBy,
      'card',
      event.cardId,
      'moved',
      { fromListId: event.sourceListId, toListId: event.targetListId },
    );
  }

  /**
   * Logs card update activity.
   */
  @OnEvent(CARD_EVENTS.updated)
  async handleCardUpdatedEvent(event: CardUpdatedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.updatedBy,
      'card',
      event.card.id,
      'updated',
      { entityTitle: event.card.title },
    );
  }

  /**
   * Logs card archive activity.
   */
  @OnEvent(CARD_EVENTS.archived)
  async handleCardArchivedEvent(event: CardArchivedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.archivedBy,
      'card',
      event.cardId,
      'archived',
      { fromListId: event.listId },
    );
  }

  /**
   * Logs card restoration activity.
   */
  @OnEvent(CARD_EVENTS.unarchived)
  async handleCardUnarchivedEvent(event: CardUnarchivedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.unarchivedBy,
      'card',
      event.card.id,
      'unarchived',
      { entityTitle: event.card.title, fromListId: event.listId },
    );
  }

  /**
   * Logs card permanent-delete activity.
   */
  @OnEvent(CARD_EVENTS.deleted)
  async handleCardDeletedEvent(event: CardDeletedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.deletedBy,
      'card',
      event.cardId,
      'deleted',
      { fromListId: event.listId },
    );
  }

  /**
   * Logs card assignee addition activity.
   */
  @OnEvent(CARD_EVENTS.assigneeAdded)
  async handleCardAssigneeAddedEvent(
    event: CardAssigneeAddedEvent,
  ): Promise<void> {
    await this.handle(
      event.boardId,
      event.addedBy,
      'assignee',
      event.cardId,
      'created',
      { userId: event.userId },
    );
  }

  /**
   * Logs card assignee removal activity.
   */
  @OnEvent(CARD_EVENTS.assigneeRemoved)
  async handleCardAssigneeRemovedEvent(
    event: CardAssigneeRemovedEvent,
  ): Promise<void> {
    await this.handle(
      event.boardId,
      event.removedBy,
      'assignee',
      event.cardId,
      'deleted',
      { userId: event.userId },
    );
  }

  /**
   * Logs card priority change activity.
   */
  @OnEvent(CARD_EVENTS.priorityChanged)
  async handleCardPriorityChangedEvent(
    event: CardPriorityChangedEvent,
  ): Promise<void> {
    await this.handle(
      event.boardId,
      event.changedBy,
      'card',
      event.cardId,
      'priority_changed',
      { from: event.from, to: event.to },
    );
  }

  /**
   * Logs card status change activity.
   */
  @OnEvent(CARD_EVENTS.statusChanged)
  async handleCardStatusChangedEvent(
    event: CardStatusChangedEvent,
  ): Promise<void> {
    await this.handle(
      event.boardId,
      event.changedBy,
      'card',
      event.cardId,
      'status_changed',
      { from: event.from, to: event.to, isComplete: event.isComplete },
    );
  }

  /**
   * Logs subcard creation activity.
   */
  @OnEvent(CARD_EVENTS.subcardCreated)
  async handleCardSubcardCreatedEvent(
    event: CardSubcardCreatedEvent,
  ): Promise<void> {
    await this.handle(
      event.boardId,
      event.createdBy,
      'card',
      event.childCardId,
      'created',
      { parentCardId: event.parentCardId },
    );
  }

  /**
   * Logs time logging activity.
   */
  @OnEvent(CARD_EVENTS.timeLogged)
  async handleCardTimeLoggedEvent(event: CardTimeLoggedEvent): Promise<void> {
    await this.handle(
      event.boardId,
      event.loggedBy,
      'card',
      event.cardId,
      'time_logged',
      { minutes: event.minutes, loggedTotal: event.loggedTotal },
    );
  }
}
