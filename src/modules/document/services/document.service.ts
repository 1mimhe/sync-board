import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Document } from '@prisma/client';
import {
  DocumentRepository,
  type DocumentMetadata,
  type DocumentWithParentCard,
} from '../repositories/document.repository';
import { EntityNotFoundException } from '../../../common/exceptions/app.exception';
import { buildCursorPagination } from '../../../common/utils/pagination.util';
import type { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import { DOCUMENT_EVENTS } from '../constants';
import {
  DocumentArchivedEvent,
  DocumentCreatedEvent,
  DocumentRenamedEvent,
} from '../events/document.events';
import type {
  CreateDocumentDto,
  RenameDocumentDto,
  SearchDocumentsDto,
} from '../dto';

/**
 * Service encapsulating business logic for collaborative document CRUD,
 * workspace-scoped listing, full-text search, and archiving.
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly documentRepo: DocumentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new document in a workspace, optionally linked to a card.
   *
   * @param workspaceId - Target workspace UUID
   * @param dto - Document creation payload
   * @param userId - Creating user UUID
   * @returns The created document (empty CRDT state)
   * @throws {EntityNotFoundException} When parentCardId does not exist in the workspace
   * @emits document.created - After successful creation
   */
  async create(
    workspaceId: string,
    dto: CreateDocumentDto,
    userId: string,
  ): Promise<Document> {
    const cardUuid = dto.parentCardId || dto.cardId;
    if (cardUuid) {
      await this.verifyCardInWorkspace(cardUuid, workspaceId);
    }
    const boardId = cardUuid
      ? await this.documentRepo.findBoardIdByCard(cardUuid)
      : null;

    const document = await this.documentRepo.create({
      workspaceId,
      title: dto.title ?? 'Untitled',
      createdBy: userId,
      parentCardId: cardUuid ?? null,
    });

    this.eventEmitter.emit(
      DOCUMENT_EVENTS.created,
      new DocumentCreatedEvent(
        document.id,
        workspaceId,
        boardId,
        document.parentCardId,
        document.title,
        userId,
      ),
    );
    return document;
  }

  /**
   * Fetches a single active document.
   *
   * @param documentId - Document UUID
   * @param workspaceId - Optional workspace scope check
   * @returns The active document
   * @throws {EntityNotFoundException} When the document is absent, archived, or outside the workspace
   */
  async findById(
    documentId: string,
    workspaceId?: string,
  ): Promise<DocumentMetadata> {
    const document = await this.documentRepo.findActiveById(documentId);
    if (!document) {
      throw new EntityNotFoundException('Document', documentId);
    }
    if (workspaceId && document.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('Document', documentId);
    }
    return document;
  }

  /**
   * Lists a cursor page of active workspace documents; when a search term is
   * present, switches to the full-text branch over preview text.
   *
   * @param workspaceId - Workspace UUID
   * @param query - Cursor pagination + optional search term
   * @returns Paginated documents
   */
  async listInWorkspace(
    workspaceId: string,
    query: SearchDocumentsDto,
  ): Promise<PaginatedResult<DocumentWithParentCard>> {
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const rows: DocumentWithParentCard[] = search
      ? await this.documentRepo.searchPage(
          workspaceId,
          search,
          query.cursor,
          limit,
        )
      : await this.documentRepo.findPage(workspaceId, query.cursor, limit);

    return buildCursorPagination<DocumentWithParentCard>(rows, limit);
  }

  /**
   * Lists all active documents linked to a card.
   *
   * @param workspaceId - Workspace UUID
   * @param cardId - Parent card UUID
   * @returns Active documents of the card, newest activity first
   * @throws {EntityNotFoundException} When the card does not exist in the workspace
   */
  async listByCard(
    workspaceId: string,
    cardId: string,
  ): Promise<DocumentWithParentCard[]> {
    await this.verifyCardInWorkspace(cardId, workspaceId);
    return this.documentRepo.findByCard(cardId);
  }

  /**
   * Lists all active documents linked to cards in a board.
   *
   * @param workspaceId - Workspace UUID
   * @param boardId - Board UUID
   * @returns Active documents linked to cards on the board
   */
  async listByBoard(
    workspaceId: string,
    boardId: string,
  ): Promise<DocumentWithParentCard[]> {
    return this.documentRepo.findByBoard(workspaceId, boardId);
  }

  /**
   * Renames a document.
   *
   * @param documentId - Document UUID
   * @param dto - Rename payload
   * @param userId - Acting user UUID
   * @returns The updated document
   * @throws {EntityNotFoundException} When the document is absent or archived
   * @emits document.renamed - After successful rename
   */
  async rename(
    documentId: string,
    dto: RenameDocumentDto,
    userId: string,
    workspaceId?: string,
  ): Promise<DocumentMetadata> {
    await this.findById(documentId, workspaceId);
    const updated = await this.documentRepo.rename(documentId, dto.title);
    this.eventEmitter.emit(
      DOCUMENT_EVENTS.renamed,
      new DocumentRenamedEvent(documentId, updated.title, userId),
    );
    return updated;
  }

  /**
   * Archives a document (soft lifecycle via the status enum).
   *
   * @param documentId - Document UUID
   * @param userId - Acting user UUID
   * @returns The archived document
   * @throws {EntityNotFoundException} When the document is absent or already archived
   * @emits document.archived - After successful archive
   */
  async archive(
    documentId: string,
    userId: string,
    workspaceId?: string,
  ): Promise<DocumentMetadata> {
    const document = await this.findById(documentId, workspaceId);
    const updated = await this.documentRepo.archive(documentId);
    this.eventEmitter.emit(
      DOCUMENT_EVENTS.archived,
      new DocumentArchivedEvent(documentId, document.workspaceId, userId),
    );
    return updated;
  }

  /**
   * Verifies that an active card exists within the given workspace.
   *
   * @param cardId - Card UUID
   * @param workspaceId - Workspace UUID
   * @throws {EntityNotFoundException} When the card is absent or archived
   */
  private async verifyCardInWorkspace(
    cardId: string,
    workspaceId: string,
  ): Promise<void> {
    const exists = await this.documentRepo.cardExistsInWorkspace(
      cardId,
      workspaceId,
    );
    if (!exists) {
      throw new EntityNotFoundException('Card', cardId);
    }
  }
}
