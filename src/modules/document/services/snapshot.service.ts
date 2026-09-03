import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Document, DocumentSnapshot } from '@prisma/client';
import { DocumentRepository } from '../repositories/document.repository';
import { DocumentManagerService } from './document-manager.service';
import {
  BusinessRuleException,
  EntityNotFoundException,
} from '../../../common/exceptions/app.exception';
import { DOCUMENT_EVENTS } from '../constants';
import { DocumentSnapshotCreatedEvent } from '../events/document.events';
import type { CreateSnapshotDto } from '../dto';

/**
 * Service managing document snapshots: capture the live CRDT state,
 * list version history, and restore a snapshot into the live document.
 */
@Injectable()
export class SnapshotService {
  constructor(
    private readonly documentRepo: DocumentRepository,
    private readonly manager: DocumentManagerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Captures the document's current CRDT state as a named snapshot.
   *
   * @param documentId - Document UUID
   * @param dto - Snapshot creation payload
   * @param userId - Creating user UUID
   * @returns The created snapshot
   * @throws {EntityNotFoundException} When the document is absent or archived
   * @throws {BusinessRuleException} When the document has no content yet
   * @emits document.snapshot_created - After successful creation
   */
  async create(
    documentId: string,
    dto: CreateSnapshotDto,
    userId: string,
  ): Promise<DocumentSnapshot> {
    const document = await this.documentRepo.findActiveById(documentId);
    if (!document) {
      throw new EntityNotFoundException('Document', documentId);
    }
    await this.manager.getOrLoad(documentId);
    if (this.manager.isEmpty(documentId)) {
      throw new BusinessRuleException(
        'DOCUMENT_EMPTY',
        'Nothing to snapshot yet',
      );
    }
    const bytes = this.manager.getStateBytes(documentId);
    const snapshot = await this.documentRepo.createSnapshot({
      documentId,
      yjsState: Buffer.from(bytes),
      snapshotName: dto.name ?? dto.snapshotName ?? null,
      createdBy: userId,
    });
    this.eventEmitter.emit(
      DOCUMENT_EVENTS.snapshotCreated,
      new DocumentSnapshotCreatedEvent(documentId, snapshot.id, userId),
    );
    return snapshot;
  }

  /**
   * Lists a document's snapshots, newest first (metadata only).
   *
   * @param documentId - Document UUID
   * @returns Array of snapshots
   */
  async list(documentId: string): Promise<DocumentSnapshot[]> {
    return this.documentRepo.findSnapshots(documentId);
  }

  /**
   * Restores a snapshot's state into the live document and persists immediately.
   *
   * @param documentId - Document UUID
   * @param snapshotId - Snapshot UUID
   * @returns The restored document
   * @throws {EntityNotFoundException} When the snapshot does not exist under this document
   */
  async restore(documentId: string, snapshotId: string): Promise<Document> {
    const snapshot = await this.documentRepo.findSnapshotById(
      snapshotId,
      documentId,
    );
    if (!snapshot) {
      throw new EntityNotFoundException('DocumentSnapshot', snapshotId);
    }
    await this.manager.replaceState(
      documentId,
      snapshot.yjsState as Uint8Array,
    );
    return (await this.documentRepo.findActiveById(documentId)) as Document;
  }
}
