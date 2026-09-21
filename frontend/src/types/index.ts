// ─────────────────────────────────────────────────────────────────────────────
// SyncBoard Unified TypeScript Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string | null
  isEmailVerified?: boolean
  createdAt: string
  updatedAt?: string
}

export interface AuthTokens {
  accessToken: string
  expiresIn: number
}

export interface AuthResponse {
  user: User
  tokens: AuthTokens
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    statusCode?: number
  }
  meta?: {
    total?: number
    cursor?: string | null
    hasMore?: boolean
    page?: number
    limit?: number
  }
}

export interface Pagination {
  cursor?: string | null
  hasMore?: boolean
  total?: number
  limit?: number
}

export interface PaginatedResult<T> {
  items: T[]
  pagination: Pagination
}

// ── Workspaces & Members ─────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  slug: string
  ownerId: string
  role?: WorkspaceRole
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  joinedAt: string
  user: {
    id: string
    email: string
    displayName: string
    avatarUrl?: string | null
  }
}

export interface WorkspaceInvitation {
  id: string
  workspaceId: string
  email: string
  role: WorkspaceRole
  token: string
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  expiresAt: string
  createdAt: string
  inviter?: {
    id: string
    displayName: string
    email: string
  }
}

// ── Boards, Lists, Cards ─────────────────────────────────────────────────────

export interface Board {
  id: string
  workspaceId: string
  title: string
  description?: string | null
  backgroundColor?: string | null
  isStarred?: boolean
  archivedAt?: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface BoardWithContent extends Board {
  lists: ListWithCards[]
  labels: Label[]
  role?: WorkspaceRole
}

export interface List {
  id: string
  boardId: string
  title: string
  rank: string
  archivedAt?: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type CardPriority = 'lowest' | 'low' | 'medium' | 'high' | 'urgent'
export type CardStatus = 'not_started' | 'active' | 'done' | 'closed'
export type CardFieldType = 'text' | 'number' | 'date' | 'select' | 'user'

export interface CardFieldDef {
  id: string
  workspaceId: string
  name: string
  fieldType: CardFieldType
  options?: { options: string[] } | string[] | null
  required: boolean
  position: number
  createdAt?: string
}

export interface CardFieldValue {
  id: string
  fieldId: string
  cardId: string
  value: unknown
  createdAt?: string
  updatedAt?: string
  field?: CardFieldDef
}

export interface CardTimeEntry {
  id: string
  cardId: string
  userId: string
  minutes: number
  note?: string | null
  createdAt: string
  user?: {
    id: string
    displayName: string
    avatarUrl?: string | null
    email?: string
  }
}

export interface TimeTrackingSummary {
  estimate: number | null
  logged: number
  remaining: number
  entries: {
    items: CardTimeEntry[]
    pagination: {
      cursor: string | null
      hasMore: boolean
    }
  }
}

export interface ListWithCards extends List {
  cards: Card[]
}

export interface Card {
  id: string
  listId: string
  title: string
  description?: string | null
  rank: string
  dueDate?: string | null
  isCompleted?: boolean
  isComplete?: boolean
  priority?: CardPriority
  status?: CardStatus
  parentCardId?: string | null
  parent?: Card | null
  subcards?: Card[]
  estimateMinutes?: number | null
  loggedMinutes?: number
  coverUrl?: string | null
  coverImageUrl?: string | null
  archivedAt?: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
  assignees?: CardAssignee[]
  labels?: (CardLabel | Label)[]
  checklists?: Checklist[]
  comments?: CardComment[]
  attachments?: CardAttachment[]
  documents?: Document[]
  fieldValues?: CardFieldValue[]
  timeEntries?: CardTimeEntry[]
}

export interface CardWithSubcards extends Card {
  subcards: Card[]
  rollup: {
    totalSubcards: number
    completedSubcards: number
  }
}

export type CardWithDetails = Card & {
  list?: {
    id: string
    title: string
    boardId: string
    board?: {
      id: string
      title: string
      workspaceId: string
    }
  }
}

export interface CardAssignee {
  id?: string
  cardId?: string
  userId: string
  user: {
    id: string
    displayName: string
    avatarUrl?: string | null
    email?: string
  }
}

export interface Label {
  id: string
  workspaceId?: string
  name?: string | null
  color: string
  createdAt?: string
  updatedAt?: string
}

export type BoardLabel = Label

export interface CardLabel {
  id?: string
  cardId?: string
  labelId: string
  name?: string
  color?: string
  label?: Label
}

export interface Checklist {
  id: string
  cardId: string
  title: string
  position: number
  items: ChecklistItem[]
  createdAt?: string
  updatedAt?: string
}

export interface ChecklistItem {
  id: string
  checklistId: string
  content: string
  isDone: boolean
  position: number
  createdAt?: string
  updatedAt?: string
}

export interface CardComment {
  id: string
  cardId: string
  authorId: string
  content: string
  parentCommentId?: string | null
  createdAt: string
  updatedAt?: string
  author?: {
    id: string
    displayName: string
    email: string
    avatarUrl?: string | null
  }
  parent?: CardComment | null
  replies?: CardComment[]
}

export interface CardAttachment {
  id: string
  cardId: string
  name: string
  url: string
  type: 'file' | 'image' | 'link'
  size?: number | null
  mimeType?: string | null
  createdAt: string
  updatedAt?: string
}

// ── Collaborative Documents ──────────────────────────────────────────────────

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

// ── Activities & Audit Logs ──────────────────────────────────────────────────
// Unified Activity: workspace-scoped, monthly-partitioned, JSONB payload.
// `payload.entityTitle` carries the human-readable title (see backend
// ActivityResponseDto). `actor` is the enriched acting-user profile.

export interface ActivityLog {
  id: string
  workspaceId: string
  boardId?: string | null
  entityType: string
  entityId: string
  action: string
  actorId: string
  actor: {
    id: string
    displayName: string
    avatarUrl?: string | null
  }
  payload: {
    entityTitle?: string | null
    fromListId?: string | null
    toListId?: string | null
    details?: unknown
    [key: string]: unknown
  }
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface HealthStatusResponse {
  status: 'ok' | 'error' | string
  info?: Record<string, { status: string; [key: string]: unknown }>
  error?: Record<string, unknown>
  details?: Record<string, { status: string; [key: string]: unknown }>
}

// ── Realtime Presence & Collaboration ────────────────────────────────────────

export interface PresenceViewer {
  userId: string
  socketId?: string
  displayName: string
  avatarUrl?: string | null
  color: string
  connectedAt?: string
}

export interface RemoteCursor {
  userId: string
  displayName: string
  color: string
  x: number
  y: number
  cardId?: string | null
}

export interface ToastMessage {
  id: string
  title?: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

// ── Board Projections / Views ────────────────────────────────────────────────

export type BoardViewMode = 'board' | 'table' | 'calendar' | 'timeline'

export interface CalendarViewQuery {
  startDate: string
  endDate: string
  cursor?: string
  limit?: number
}

export interface TimelineViewQuery {
  cursor?: string
  limit?: number
}

export interface TableViewQuery {
  cursor?: string
  limit?: number
  status?: CardStatus
  priority?: CardPriority
  search?: string
  sortBy?: 'rank' | 'dueDate' | 'createdAt' | 'priority' | 'status' | 'title'
  sortOrder?: 'asc' | 'desc'
}

