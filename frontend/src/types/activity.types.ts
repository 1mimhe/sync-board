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
