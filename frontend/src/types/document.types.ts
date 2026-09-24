export interface Document {
  id: string
  workspaceId: string
  cardId?: string | null
  parentCardId?: string | null
  parentCard?: { id: string; title: string } | null
  title: string
  status: 'draft' | 'published' | 'archived' | string
  previewText?: string | null
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}

export interface DocumentSnapshot {
  id: string
  documentId: string
  snapshotName?: string | null
  createdAt: string
  createdBy?: string | null
}

export interface EditorInfo {
  userId: string
  displayName: string
  avatarUrl?: string | null
  color: string
}
