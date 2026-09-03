import type { DocumentStatus } from '@prisma/client';

/** Event emitted after a new document is created in a workspace. */
export class DocumentCreatedEvent {
  constructor(
    public readonly documentId: string,
    public readonly workspaceId: string,
    public readonly boardId: string | null,
    public readonly parentCardId: string | null,
    public readonly title: string,
    public readonly createdBy: string,
  ) {}
}

/** Event emitted after a document's title is renamed. */
export class DocumentRenamedEvent {
  constructor(
    public readonly documentId: string,
    public readonly title: string,
    public readonly updatedBy: string,
  ) {}
}

/** Event emitted after an in-memory document state is persisted to the database. */
export class DocumentSavedEvent {
  constructor(
    public readonly documentId: string,
    public readonly savedAt: Date,
  ) {}
}

/** Event emitted after a document is archived. */
export class DocumentArchivedEvent {
  constructor(
    public readonly documentId: string,
    public readonly workspaceId: string,
    public readonly archivedBy: string,
  ) {}
}

/** Event emitted after a document snapshot is created. */
export class DocumentSnapshotCreatedEvent {
  constructor(
    public readonly documentId: string,
    public readonly snapshotId: string,
    public readonly createdBy: string,
  ) {}
}

/** Status values a document can transition through (re-exported for listeners). */
export type DocumentStatusValue = DocumentStatus;
