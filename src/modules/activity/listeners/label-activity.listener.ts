import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActionType, EntityType } from '@prisma/client';
import { ActivityRepository } from '../repositories/activity.repository';
import type {
  LabelCreatedEvent,
  LabelUpdatedEvent,
  LabelDeletedEvent,
} from '../../board/label/events/label.events';
import { LABEL_EVENTS } from '../../board/label/events/label-events.constants';

/**
 * Persists activity audit logs for board label events (`LABEL_EVENTS.*`).
 * Workspace-level labels (boardId === null) are skipped — they carry no
 * board context for the audit log. Fault-tolerant: a failed log entry is
 * logged and swallowed so it never breaks the originating request.
 */
@Injectable()
export class LabelActivityListener {
  private readonly logger = new Logger(LabelActivityListener.name);

  constructor(private readonly activityRepo: ActivityRepository) {}

  /**
   * Logs label creation activity.
   */
  @OnEvent(LABEL_EVENTS.created)
  async handleLabelCreatedEvent(event: LabelCreatedEvent): Promise<void> {
    if (event.boardId === null) return;
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.createdBy,
        action: ActionType.created,
        entityType: EntityType.label,
        entityId: event.label.id,
        entityTitle: event.label.name ?? undefined,
      });
    } catch (error) {
      this.logger.error('Failed to log label.created activity', error);
    }
  }

  /**
   * Logs label update activity.
   */
  @OnEvent(LABEL_EVENTS.updated)
  async handleLabelUpdatedEvent(event: LabelUpdatedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.updatedBy,
        action: ActionType.updated,
        entityType: EntityType.label,
        entityId: event.label.id,
        entityTitle: event.label.name ?? undefined,
      });
    } catch (error) {
      this.logger.error('Failed to log label.updated activity', error);
    }
  }

  /**
   * Logs label deletion activity.
   */
  @OnEvent(LABEL_EVENTS.deleted)
  async handleLabelDeletedEvent(event: LabelDeletedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.deletedBy,
        action: ActionType.deleted,
        entityType: EntityType.label,
        entityId: event.labelId,
      });
    } catch (error) {
      this.logger.error('Failed to log label.deleted activity', error);
    }
  }
}
