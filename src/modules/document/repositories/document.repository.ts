import { Injectable } from '@nestjs/common';
import {
  DocumentStatus,
  type Document,
  type DocumentSnapshot,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';

/** Metadata-only document representation omitting heavy binary yjsState and previewText */
export type DocumentMetadata = {
  id: string;
  workspaceId: string;
  title: string;
  parentCardId: string | null;
  createdBy: string;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentWithParentCard = DocumentMetadata & {
  parentCard?: { id: string; title: string } | null;
};

/** Metadata-only column selection to omit heavy binary yjsState and previewText */
export const DOCUMENT_META_SELECT = {
  id: true,
  workspaceId: true,
  title: true,
  parentCardId: true,
  createdBy: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Repository handling database operations for documents and their snapshots.
 * Deliberately self-contained: document scoping (card ∈ workspace) is verified
 * here through the card → list → board relation chain.
 */
@Injectable()
export class DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new document row.
   *
   * @param data - Document creation payload
   * @returns The created document
   */
  async create(data: Prisma.DocumentUncheckedCreateInput): Promise<Document> {
    return this.prisma.document.create({ data });
  }

  /**
   * Finds an active (non-archived) document by ID.
   * Deliberately omits heavy yjsState and previewText.
   *
   * @param id - Document UUID
   * @returns The document metadata or null if not found/archived
   */
  async findActiveById(id: string): Promise<DocumentMetadata | null> {
    return this.prisma.document.findFirst({
      where: { id, status: DocumentStatus.active },
      select: DOCUMENT_META_SELECT,
    });
  }

  /**
   * Finds a document including its persisted CRDT state (used to hydrate Y.Doc).
   *
   * @param id - Document UUID
   * @returns The document row with yjsState, or null if not found/archived
   */
  async findWithState(
    id: string,
  ): Promise<Pick<Document, 'id' | 'yjsState'> | null> {
    return this.prisma.document.findFirst({
      where: { id, status: DocumentStatus.active },
      select: { id: true, yjsState: true },
    });
  }

  /**
   * Finds a cursor page of active documents in a workspace, newest activity first.
   * Fetches limit + 1 rows so callers can compute hasMore.
   * Omits heavy binary yjsState and previewText.
   *
   * @param workspaceId - Workspace UUID
   * @param cursor - Last item id of the previous page (optional)
   * @param limit - Page size; one extra row is fetched to detect the next page
   * @returns Array of documents (length up to limit + 1)
   */
  async findPage(
    workspaceId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<DocumentWithParentCard[]> {
    const find = (withCursor: boolean): Promise<DocumentWithParentCard[]> =>
      this.prisma.document.findMany({
        where: { workspaceId, status: DocumentStatus.active },
        select: {
          ...DOCUMENT_META_SELECT,
          parentCard: {
            select: { id: true, title: true },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(withCursor && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

    try {
      return await find(true);
    } catch (error) {
      if (
        cursor &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Unknown or stale cursor — fall back to the first page
        return find(false);
      }
      throw error;
    }
  }

  /**
   * Full-text search over document preview text within a workspace (active only).
   * Raw SQL because Prisma cannot express the to_tsvector GIN index match.
   * Keyset pagination on (updated_at, id) — fetches limit + 1 rows; cursor
   * trimming is done by the service layer.
   *
   * @param workspaceId - Workspace UUID
   * @param term - Plain search term
   * @param cursor - Last item id of the previous page (optional)
   * @param limit - Page size; one extra row is fetched to detect the next page
   * @returns Array of documents (length up to limit + 1)
   */
  async searchPage(
    workspaceId: string,
    term: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<DocumentWithParentCard[]> {
    if (!cursor) {
      return this.prisma.$queryRaw<DocumentWithParentCard[]>`
        SELECT id, workspace_id AS "workspaceId", title, parent_card_id AS "parentCardId", created_by AS "createdBy", status,
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM documents
        WHERE workspace_id = ${workspaceId}::uuid
          AND status = ${DocumentStatus.active}
          AND to_tsvector('english', COALESCE(preview_text, ''))
              @@ plainto_tsquery('english', ${term})
        ORDER BY updated_at DESC, id DESC
        LIMIT ${limit + 1};
      `;
    }

    const cursorDoc = await this.prisma.document.findUnique({
      where: { id: cursor },
      select: { updatedAt: true, id: true, workspaceId: true, status: true },
    });

    // Stale/foreign cursor — fall back to first page (mirrors findPage behaviour)
    if (
      !cursorDoc ||
      cursorDoc.workspaceId !== workspaceId ||
      cursorDoc.status !== DocumentStatus.active
    ) {
      return this.prisma.$queryRaw<DocumentWithParentCard[]>`
        SELECT id, workspace_id AS "workspaceId", title, parent_card_id AS "parentCardId", created_by AS "createdBy", status,
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM documents
        WHERE workspace_id = ${workspaceId}::uuid
          AND status = ${DocumentStatus.active}
          AND to_tsvector('english', COALESCE(preview_text, ''))
              @@ plainto_tsquery('english', ${term})
        ORDER BY updated_at DESC, id DESC
        LIMIT ${limit + 1};
      `;
    }

    return this.prisma.$queryRaw<DocumentWithParentCard[]>`
      SELECT id, workspace_id AS "workspaceId", title, parent_card_id AS "parentCardId", created_by AS "createdBy", status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM documents
      WHERE workspace_id = ${workspaceId}::uuid
        AND status = ${DocumentStatus.active}
        AND to_tsvector('english', COALESCE(preview_text, ''))
            @@ plainto_tsquery('english', ${term})
        AND (updated_at, id) < (${cursorDoc.updatedAt}::timestamptz, ${cursorDoc.id}::uuid)
      ORDER BY updated_at DESC, id DESC
      LIMIT ${limit + 1};
    `;
  }

  /**
   * Finds all active documents linked to a card, newest activity first.
   *
   * @param cardId - Parent card UUID
   * @returns Array of active documents
   */
  async findByCard(cardId: string): Promise<DocumentWithParentCard[]> {
    return this.prisma.document.findMany({
      where: { parentCardId: cardId, status: DocumentStatus.active },
      select: {
        ...DOCUMENT_META_SELECT,
        parentCard: {
          select: { id: true, title: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  }

  /**
   * Finds all active documents attached to cards on a specific board.
   *
   * @param workspaceId - Workspace UUID
   * @param boardId - Board UUID
   * @returns Array of active documents with parentCard info
   */
  async findByBoard(
    workspaceId: string,
    boardId: string,
  ): Promise<DocumentWithParentCard[]> {
    return this.prisma.document.findMany({
      where: {
        workspaceId,
        status: DocumentStatus.active,
        parentCard: {
          list: {
            boardId,
            archivedAt: null,
          },
          archivedAt: null,
        },
      },
      select: {
        ...DOCUMENT_META_SELECT,
        parentCard: {
          select: { id: true, title: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  }

  /**
   * Verifies that an active card exists within the given workspace.
   *
   * @param cardId - Card UUID
   * @param workspaceId - Workspace UUID
   * @returns True when the card exists (not archived) in the workspace
   */
  async cardExistsInWorkspace(
    cardId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const card = await this.prisma.card.findFirst({
      where: {
        id: cardId,
        archivedAt: null,
        list: { board: { workspaceId } },
      },
      select: { id: true },
    });
    return card !== null;
  }

  /**
   * Resolves the board UUID a card belongs to (used for activity scoping).
   *
   * @param cardId - Card UUID
   * @returns The board UUID or null when the card does not exist
   */
  async findBoardIdByCard(cardId: string): Promise<string | null> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: { list: { select: { boardId: true } } },
    });
    return card?.list.boardId ?? null;
  }

  /**
   * Updates a document's title.
   *
   * @param id - Document UUID
   * @param title - New title
   * @returns The updated document
   */
  async rename(id: string, title: string): Promise<DocumentMetadata> {
    return this.prisma.document.update({
      where: { id },
      data: { title },
      select: DOCUMENT_META_SELECT,
    });
  }

  /**
   * Archives a document by switching its status.
   *
   * @param id - Document UUID
   * @returns The archived document
   */
  async archive(id: string): Promise<DocumentMetadata> {
    return this.prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.archived },
      select: DOCUMENT_META_SELECT,
    });
  }

  /**
   * Persists the in-memory CRDT state and its plain-text preview.
   *
   * @param id - Document UUID
   * @param bytes - Serialized Y.Doc state
   * @param preview - Plain-text preview (truncated before the call)
   */
  async saveState(
    id: string,
    bytes: Uint8Array,
    preview: string,
  ): Promise<void> {
    await this.prisma.document.update({
      where: { id },
      data: { yjsState: Buffer.from(bytes), previewText: preview },
    });
  }

  /**
   * Creates a snapshot row for a document.
   *
   * @param data - Snapshot creation payload
   * @returns The created snapshot
   */
  async createSnapshot(
    data: Prisma.DocumentSnapshotUncheckedCreateInput,
  ): Promise<DocumentSnapshot> {
    return this.prisma.documentSnapshot.create({ data });
  }

  /**
   * Finds all snapshots of a document, newest first, metadata only.
   *
   * @param documentId - Document UUID
   * @returns Array of snapshots
   */
  async findSnapshots(documentId: string): Promise<DocumentSnapshot[]> {
    return this.prisma.documentSnapshot.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finds a single snapshot of a document including its CRDT state.
   *
   * @param snapshotId - Snapshot UUID
   * @param documentId - Document UUID (scope check)
   * @returns The snapshot or null when not found under this document
   */
  async findSnapshotById(
    snapshotId: string,
    documentId: string,
  ): Promise<DocumentSnapshot | null> {
    return this.prisma.documentSnapshot.findFirst({
      where: { id: snapshotId, documentId },
    });
  }
}
