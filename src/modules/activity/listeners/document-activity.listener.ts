import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActionType, EntityType } from '@prisma/client';
import { ActivityRepository } from '../repositories/activity.repository';
import type {
  DocumentCreatedEvent,
  DocumentRenamedEvent,
  DocumentArchivedEvent,
} from '../../document/events/document.events';
import { DOCUMENT_EVENTS } from '../../document/constants';

/**
 * Persists activity audit logs for document lifecycle events
 * (`DOCUMENT_EVENTS.*`). Fault-tolerant: a failed log entry is logged and
 * swallowed so it never breaks the originating request.
 */
@Injectable()
export class DocumentActivityListener {
  private readonly logger = new Logger(DocumentActivityListener.name);

  constructor(private readonly activityRepo: ActivityRepository) {}

  /**
   * Logs document creation activity. Board scope is nullable — standalone
   * documents are not attached to a board.
   */
  @OnEvent(DOCUMENT_EVENTS.created)
  async handleDocumentCreatedEvent(event: DocumentCreatedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: event.boardId,
        userId: event.createdBy,
        action: ActionType.created,
        entityType: EntityType.document,
        entityId: event.documentId,
        entityTitle: event.title,
      });
    } catch (error) {
      this.logger.error('Failed to log document.created activity', error);
    }
  }

  /**
   * Logs document rename activity.
   */
  @OnEvent(DOCUMENT_EVENTS.renamed)
  async handleDocumentRenamedEvent(event: DocumentRenamedEvent): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: null,
        userId: event.updatedBy,
        action: ActionType.updated,
        entityType: EntityType.document,
        entityId: event.documentId,
        entityTitle: event.title,
      });
    } catch (error) {
      this.logger.error('Failed to log document.renamed activity', error);
    }
  }

  /**
   * Logs document archival activity.
   */
  @OnEvent(DOCUMENT_EVENTS.archived)
  async handleDocumentArchivedEvent(
    event: DocumentArchivedEvent,
  ): Promise<void> {
    try {
      await this.activityRepo.create({
        boardId: null,
        userId: event.archivedBy,
        action: ActionType.archived,
        entityType: EntityType.document,
        entityId: event.documentId,
      });
    } catch (error) {
      this.logger.error('Failed to log document.archived activity', error);
    }
  }
}
