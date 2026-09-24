import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivityRepository } from '../repositories/activity.repository';
import type { RecordActivityInput } from '../interfaces/activity.interfaces';
import { DocumentService } from '../../document/services/document.service';
import type {
  DocumentCreatedEvent,
  DocumentRenamedEvent,
  DocumentArchivedEvent,
} from '../../document/events/document.events';
import { DOCUMENT_EVENTS } from '../../document/constants';

/**
 * Persists workspace-scoped activity events for document lifecycle events
 * (`DOCUMENT_EVENTS.*`). Workspace resolution prefers the workspaceId carried
 * by events; rename events lack one, so the document is resolved narrowly via
 * the exported DocumentService. Fault-tolerant: a failed log entry is logged
 * and swallowed so it never breaks the originating request.
 */
@Injectable()
export class DocumentActivityListener {
  private readonly logger = new Logger(DocumentActivityListener.name);

  constructor(
    private readonly activityRepo: ActivityRepository,
    private readonly documentService: DocumentService,
  ) {}

  private async record(params: {
    workspaceId: string | null;
    boardId: string | null;
    entityId: string;
    action: string;
    actorId: string;
    payload: RecordActivityInput['payload'];
  }): Promise<void> {
    const { workspaceId } = params;
    if (!workspaceId) {
      this.logger.warn(
        `Skipping activity record: no workspace for document entity ${params.entityId}`,
      );
      return;
    }
    await this.activityRepo.record({
      workspaceId,
      boardId: params.boardId,
      entityType: 'document',
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId,
      payload: params.payload,
    });
  }

  /**
   * Logs document creation activity. Board scope is nullable — standalone
   * documents are recorded with a null boardId but always carry a workspace.
   */
  @OnEvent(DOCUMENT_EVENTS.created)
  async handleDocumentCreatedEvent(event: DocumentCreatedEvent): Promise<void> {
    try {
      await this.record({
        workspaceId: event.workspaceId,
        boardId: event.boardId,
        entityId: event.documentId,
        action: 'created',
        actorId: event.createdBy,
        payload: { entityTitle: event.title },
      });
    } catch (error) {
      this.logger.error(
        'Failed to log document.created activity',
        (error as Error).stack,
      );
    }
  }

  /**
   * Logs document rename activity. The rename event carries no workspaceId, so
   * the owning workspace is resolved from the document itself.
   */
  @OnEvent(DOCUMENT_EVENTS.renamed)
  async handleDocumentRenamedEvent(event: DocumentRenamedEvent): Promise<void> {
    try {
      const document = await this.documentService.findById(event.documentId);
      await this.record({
        workspaceId: document.workspaceId,
        boardId: null,
        entityId: event.documentId,
        action: 'updated',
        actorId: event.updatedBy,
        payload: { entityTitle: event.title },
      });
    } catch (error) {
      this.logger.error(
        'Failed to log document.renamed activity',
        (error as Error).stack,
      );
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
      await this.record({
        workspaceId: event.workspaceId,
        boardId: null,
        entityId: event.documentId,
        action: 'archived',
        actorId: event.archivedBy,
        payload: {},
      });
    } catch (error) {
      this.logger.error(
        'Failed to log document.archived activity',
        (error as Error).stack,
      );
    }
  }
}
