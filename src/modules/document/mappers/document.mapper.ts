import type { DocumentSnapshot } from '@prisma/client';
import type {
  DocumentMetadata,
  DocumentWithParentCard,
} from '../repositories/document.repository';
import { DocumentResponseDto } from '../dto/document-response.dto';
import { SnapshotResponseDto } from '../dto/snapshot-response.dto';

/**
 * Maps a document entity to its public response shape (no yjsState/previewText).
 */
export function toDocumentResponseDto(
  document: DocumentMetadata | DocumentWithParentCard,
): DocumentResponseDto {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    title: document.title,
    parentCardId: document.parentCardId,
    parentCard:
      'parentCard' in document && document.parentCard
        ? { id: document.parentCard.id, title: document.parentCard.title }
        : null,
    createdBy: document.createdBy,
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/**
 * Maps a snapshot entity to its public metadata-only response shape.
 */
export function toSnapshotResponseDto(
  snapshot: DocumentSnapshot,
): SnapshotResponseDto {
  return {
    id: snapshot.id,
    documentId: snapshot.documentId,
    snapshotName: snapshot.snapshotName,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt,
  };
}
