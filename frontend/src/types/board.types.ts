import type { WorkspaceRole } from './auth.types'
import type { Card, CardPriority, CardStatus } from './card.types'

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

export interface ListWithCards extends List {
  cards: Card[]
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
  assigneeId?: string
  search?: string
  sortBy?: 'rank' | 'dueDate' | 'createdAt' | 'priority' | 'status' | 'title'
  sortOrder?: 'asc' | 'desc'
}
