import type { CardLabel, Label } from './board.types'
import type { Document } from './document.types'

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
