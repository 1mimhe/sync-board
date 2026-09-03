import { apiFetch } from './client'
import type {
  AuthResponse,
  AuthTokens,
  User,
  Workspace,
  WorkspaceWithRole,
  WorkspaceMember,
  WorkspaceInvitation,
  WorkspaceRole,
  Board,
  BoardWithContent,
  List,
  Card,
  CardWithDetails,
  Label,
  Checklist,
  ChecklistItem,
  CardComment,
  CardAttachment,
  Document,
  DocumentSnapshot,
  ActivityLog,
  PaginatedResult,
  Pagination,
  HealthStatusResponse,
} from '../types'

// ── Auth Endpoints ────────────────────────────────────────────────────────────

export const authApi = {
  register: (dto: { displayName: string; email: string; password: string }) =>
    apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  login: (dto: { email: string; password: string }) =>
    apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  refresh: () =>
    apiFetch<AuthTokens>('/auth/refresh', {
      method: 'POST',
    }),

  logout: () =>
    apiFetch<void>('/auth/logout', {
      method: 'POST',
    }),

  logoutAll: () =>
    apiFetch<void>('/auth/logout-all', {
      method: 'POST',
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (dto: { token: string; newPassword: string }) =>
    apiFetch<AuthTokens>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  verifyEmail: (token: string) =>
    apiFetch<{ message: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  resendVerification: () =>
    apiFetch<void>('/auth/resend-verification', {
      method: 'POST',
    }),

  getProfile: (token?: string | null) =>
    apiFetch<User>('/auth/me', token ? { token } : {}),

  updateProfile: (dto: { displayName?: string; avatarUrl?: string | null }) =>
    apiFetch<User>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  changePassword: (dto: { currentPassword: string; newPassword: string }) =>
    apiFetch<AuthTokens>('/auth/me/password', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  getGoogleAuthUrl: (options: { redirect?: string } = {}) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const qs = new URLSearchParams()
    if (origin) qs.set('origin', origin)
    if (options.redirect) qs.set('redirect', options.redirect)
    const q = qs.toString() ? `?${qs.toString()}` : ''
    return apiFetch<{ url: string }>(`/auth/google${q}`)
  },
}

// ── Workspace Endpoints ───────────────────────────────────────────────────────

export const workspaceApi = {
  create: (dto: { name: string; slug?: string }) =>
    apiFetch<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  listMine: (query: { cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams()
    if (query.cursor) params.set('cursor', query.cursor)
    if (query.limit) params.set('limit', String(query.limit))
    const q = params.toString() ? `?${params.toString()}` : ''
    return apiFetch<PaginatedResult<WorkspaceWithRole>>(`/workspaces${q}`)
  },

  getById: (workspaceId: string) =>
    apiFetch<WorkspaceWithRole>(`/workspaces/${workspaceId}`),

  getBySlug: (slug: string) =>
    apiFetch<WorkspaceWithRole>(`/workspaces/slug/${slug}`),

  update: (workspaceId: string, dto: { name?: string; slug?: string }) =>
    apiFetch<Workspace>(`/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  archive: (workspaceId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}`, {
      method: 'DELETE',
    }),

  leave: (workspaceId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}/leave`, {
      method: 'DELETE',
    }),

  transferOwnership: (workspaceId: string, newOwnerId: string) =>
    apiFetch<WorkspaceMember>(`/workspaces/${workspaceId}/transfer-ownership`, {
      method: 'POST',
      body: JSON.stringify({ newOwnerId }),
    }),

  // Members
  getMembers: (workspaceId: string) =>
    apiFetch<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`),

  updateMemberRole: (workspaceId: string, memberId: string, role: WorkspaceRole) =>
    apiFetch<WorkspaceMember>(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeMember: (workspaceId: string, memberId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
    }),

  // Invitations
  inviteMember: (workspaceId: string, dto: { email: string; role?: WorkspaceRole }) =>
    apiFetch<WorkspaceInvitation>(`/workspaces/${workspaceId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email: dto.email, role: dto.role || 'member' }),
    }),

  getInvitations: (workspaceId: string) =>
    apiFetch<WorkspaceInvitation[]>(`/workspaces/${workspaceId}/invitations`),

  revokeInvitation: (workspaceId: string, invitationId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}/invitations/${invitationId}`, {
      method: 'DELETE',
    }),

  acceptInvitation: (token: string) =>
    apiFetch<WorkspaceMember>('/workspaces/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
}

// ── Board Endpoints ───────────────────────────────────────────────────────────

export const boardApi = {
  create: (
    workspaceId: string,
    dto: { title: string; description?: string; backgroundColor?: string },
  ) =>
    apiFetch<Board>(`/workspaces/${workspaceId}/boards`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  list: (workspaceId: string, query: { cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams()
    if (query.cursor) params.set('cursor', query.cursor)
    if (query.limit) params.set('limit', String(query.limit))
    const q = params.toString() ? `?${params.toString()}` : ''
    return apiFetch<PaginatedResult<Board>>(`/workspaces/${workspaceId}/boards${q}`)
  },

  getWithContent: (
    workspaceId: string,
    boardId: string,
    query: { listPage?: number; listPageSize?: number; cardPageSize?: number } = {},
  ) => {
    const params = new URLSearchParams({
      listPage: String(query.listPage || 1),
      listPageSize: String(query.listPageSize || 50),
      cardPageSize: String(query.cardPageSize || 50),
    })
    return apiFetch<BoardWithContent>(
      `/workspaces/${workspaceId}/boards/${boardId}?${params.toString()}`,
    )
  },

  update: (
    workspaceId: string,
    boardId: string,
    dto: { title?: string; description?: string; backgroundColor?: string },
  ) =>
    apiFetch<Board>(`/workspaces/${workspaceId}/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  archive: (workspaceId: string, boardId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}/boards/${boardId}`, {
      method: 'DELETE',
    }),

  listArchived: (
    workspaceId: string,
    query: { cursor?: string; limit?: number } = {},
  ) => {
    const params = new URLSearchParams()
    if (query.cursor) params.set('cursor', query.cursor)
    if (query.limit) params.set('limit', String(query.limit))
    const q = params.toString() ? `?${params.toString()}` : ''
    return apiFetch<PaginatedResult<Board> | Board[]>(`/workspaces/${workspaceId}/boards/archived${q}`)
  },

  deletePermanently: (workspaceId: string, boardId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}/boards/${boardId}/permanent`, {
      method: 'DELETE',
    }),

  unarchive: (workspaceId: string, boardId: string) =>
    apiFetch<Board>(`/workspaces/${workspaceId}/boards/${boardId}/unarchive`, {
      method: 'PATCH',
    }),

  star: (workspaceId: string, boardId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}/boards/${boardId}/star`, {
      method: 'POST',
    }),

  unstar: (workspaceId: string, boardId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}/boards/${boardId}/star`, {
      method: 'DELETE',
    }),

  getActivities: (
    workspaceId: string,
    boardId: string,
    query: { cursor?: string; limit?: number } = {},
  ) => {
    const params = new URLSearchParams()
    if (query.cursor) params.set('cursor', query.cursor)
    if (query.limit) params.set('limit', String(query.limit || 20))
    return apiFetch<PaginatedResult<ActivityLog>>(
      `/workspaces/${workspaceId}/boards/${boardId}/activities?${params.toString()}`,
    )
  },
}

// ── List Endpoints ────────────────────────────────────────────────────────────

export const listApi = {
  create: (workspaceId: string, boardId: string, dto: { title: string }) =>
    apiFetch<List>(`/workspaces/${workspaceId}/boards/${boardId}/lists`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  update: (workspaceId: string, boardId: string, listId: string, dto: { title: string }) =>
    apiFetch<List>(`/workspaces/${workspaceId}/boards/${boardId}/lists/${listId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  move: (
    workspaceId: string,
    boardId: string,
    listId: string,
    dto: { prevRank?: string; nextRank?: string },
  ) =>
    apiFetch<List>(`/workspaces/${workspaceId}/boards/${boardId}/lists/${listId}/move`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  archive: (workspaceId: string, boardId: string, listId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}/boards/${boardId}/lists/${listId}`, {
      method: 'DELETE',
    }),

  unarchive: (workspaceId: string, boardId: string, listId: string) =>
    apiFetch<List>(`/workspaces/${workspaceId}/boards/${boardId}/lists/${listId}/unarchive`, {
      method: 'PATCH',
    }),

  listArchived: (
    workspaceId: string,
    boardId: string,
    query: { cursor?: string; limit?: number } = {},
  ) => {
    const params = new URLSearchParams()
    if (query.cursor) params.set('cursor', query.cursor)
    if (query.limit) params.set('limit', String(query.limit))
    const q = params.toString() ? `?${params.toString()}` : ''
    return apiFetch<PaginatedResult<List> | List[]>(`/workspaces/${workspaceId}/boards/${boardId}/lists/archived${q}`)
  },

  deletePermanently: (workspaceId: string, boardId: string, listId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}/boards/${boardId}/lists/${listId}/permanent`, {
      method: 'DELETE',
    }),
}

// ── Card Endpoints ────────────────────────────────────────────────────────────

export const cardApi = {
  create: (
    workspaceId: string,
    boardId: string,
    listId: string,
    dto: { title: string; description?: string },
  ) =>
    apiFetch<CardWithDetails>(
      `/workspaces/${workspaceId}/boards/${boardId}/lists/${listId}/cards`,
      {
        method: 'POST',
        body: JSON.stringify(dto),
      },
    ),

  getDetails: (workspaceId: string, boardId: string, cardId: string) =>
    apiFetch<CardWithDetails>(`/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}`),

  update: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    dto: {
      title?: string
      description?: string | null
      dueDate?: string | null
      isComplete?: boolean
      isCompleted?: boolean
      coverImageUrl?: string | null
      coverUrl?: string | null
    },
  ) => {
    const payload: Record<string, unknown> = {}
    if (dto.title !== undefined) payload.title = dto.title
    if (dto.description !== undefined) payload.description = dto.description
    if (dto.dueDate !== undefined) payload.dueDate = dto.dueDate
    if (dto.isComplete !== undefined) payload.isComplete = dto.isComplete
    else if (dto.isCompleted !== undefined) payload.isComplete = dto.isCompleted
    if (dto.coverImageUrl !== undefined) payload.coverImageUrl = dto.coverImageUrl
    else if (dto.coverUrl !== undefined) payload.coverImageUrl = dto.coverUrl

    return apiFetch<Card>(`/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  move: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    dto: {
      targetListId: string
      prevRank?: string
      nextRank?: string
    },
  ) =>
    apiFetch<Card>(`/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/move`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  archive: (workspaceId: string, boardId: string, cardId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}`, {
      method: 'DELETE',
    }),

  listArchived: (
    workspaceId: string,
    boardId: string,
    query: { cursor?: string; limit?: number } = {},
  ) => {
    const params = new URLSearchParams()
    if (query.cursor) params.set('cursor', query.cursor)
    if (query.limit) params.set('limit', String(query.limit))
    const q = params.toString() ? `?${params.toString()}` : ''
    return apiFetch<PaginatedResult<CardWithDetails> | CardWithDetails[]>(`/workspaces/${workspaceId}/boards/${boardId}/cards/archived${q}`)
  },

  deletePermanently: (workspaceId: string, boardId: string, cardId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/permanent`, {
      method: 'DELETE',
    }),

  unarchive: (workspaceId: string, boardId: string, cardId: string) =>
    apiFetch<Card>(`/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/unarchive`, {
      method: 'PATCH',
    }),

  addAssignee: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    targetUserId: string,
  ) =>
    apiFetch<void>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/assignees/${targetUserId}`,
      { method: 'POST' },
    ),

  removeAssignee: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    targetUserId: string,
  ) =>
    apiFetch<void>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/assignees/${targetUserId}`,
      { method: 'DELETE' },
    ),

  addLabel: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    labelId: string,
  ) =>
    apiFetch<void>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/labels/${labelId}`,
      { method: 'POST' },
    ),

  removeLabel: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    labelId: string,
  ) =>
    apiFetch<void>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/labels/${labelId}`,
      { method: 'DELETE' },
    ),
}

// ── Checklist Endpoints ───────────────────────────────────────────────────────

export const checklistApi = {
  createChecklist: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    dto: { title: string },
  ) =>
    apiFetch<Checklist>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/checklists`,
      {
        method: 'POST',
        body: JSON.stringify(dto),
      },
    ),

  list: (workspaceId: string, boardId: string, cardId: string) =>
    apiFetch<Checklist[]>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/checklists`,
    ),

  renameChecklist: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    checklistId: string,
    dto: { title: string },
  ) =>
    apiFetch<Checklist>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/checklists/${checklistId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(dto),
      },
    ),

  deleteChecklist: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    checklistId: string,
  ) =>
    apiFetch<void>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/checklists/${checklistId}`,
      { method: 'DELETE' },
    ),

  addItem: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    checklistId: string,
    dto: { content: string },
  ) =>
    apiFetch<ChecklistItem>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/checklists/${checklistId}/items`,
      {
        method: 'POST',
        body: JSON.stringify(dto),
      },
    ),

  updateItem: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    checklistId: string,
    itemId: string,
    dto: { content?: string; isDone?: boolean; position?: number },
  ) =>
    apiFetch<ChecklistItem>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/checklists/${checklistId}/items/${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(dto),
      },
    ),

  removeItem: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    checklistId: string,
    itemId: string,
  ) =>
    apiFetch<void>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/checklists/${checklistId}/items/${itemId}`,
      { method: 'DELETE' },
    ),
}
// ── Label Endpoints ───────────────────────────────────────────────────────────

export const labelApi = {
  createLabel: (
    workspaceId: string,
    boardIdOrDto: string | { name?: string; color: string; cardId?: string },
    possibleDto?: { name?: string; color: string; cardId?: string },
  ) => {
    const dto = typeof boardIdOrDto === 'object' ? boardIdOrDto : possibleDto!
    return apiFetch<Label>(`/workspaces/${workspaceId}/labels`, {
      method: 'POST',
      body: JSON.stringify(dto),
    })
  },

  createWorkspaceLabel: (
    workspaceId: string,
    dto: { name?: string; color: string; cardId?: string },
  ) =>
    apiFetch<Label>(`/workspaces/${workspaceId}/labels`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  listForBoard: (workspaceId: string, _boardId?: string) =>
    apiFetch<Label[]>(`/workspaces/${workspaceId}/labels`),

  listForWorkspace: (workspaceId: string, _scope?: 'all' | 'workspace') =>
    apiFetch<Label[]>(`/workspaces/${workspaceId}/labels`),

  getCardsForLabel: (workspaceId: string, labelId: string) =>
    apiFetch<CardWithDetails[]>(`/workspaces/${workspaceId}/labels/${labelId}/cards`),

  updateLabel: (
    workspaceId: string,
    _boardId: string | undefined | null,
    labelId: string,
    dto: { name?: string; color?: string },
  ) =>
    apiFetch<Label>(`/workspaces/${workspaceId}/labels/${labelId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  deleteLabel: (
    workspaceId: string,
    _boardId: string | undefined | null,
    labelId: string,
  ) =>
    apiFetch<void>(`/workspaces/${workspaceId}/labels/${labelId}`, {
      method: 'DELETE',
    }),
}

// ── Comment Endpoints ─────────────────────────────────────────────────────────

export const commentApi = {
  create: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    dto: { content: string },
  ) =>
    apiFetch<CardComment>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify(dto),
      },
    ),

  list: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    query: { cursor?: string; limit?: number } = {},
  ) => {
    const params = new URLSearchParams()
    if (query.cursor) params.set('cursor', query.cursor)
    if (query.limit) params.set('limit', String(query.limit || 50))
    const qs = params.toString() ? `?${params.toString()}` : ''
    return apiFetch<{ items: CardComment[]; pagination: Pagination } | CardComment[]>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/comments${qs}`,
    )
  },

  update: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    commentId: string,
    dto: { content: string },
  ) =>
    apiFetch<CardComment>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/comments/${commentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(dto),
      },
    ),

  delete: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    commentId: string,
  ) =>
    apiFetch<void>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/comments/${commentId}`,
      { method: 'DELETE' },
    ),
}

// ── Attachment Endpoints ──────────────────────────────────────────────────────

export const attachmentApi = {
  create: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    dto: {
      type: 'file' | 'image' | 'link'
      url: string
      name: string
      size?: number
      mimeType?: string
    },
  ) =>
    apiFetch<CardAttachment>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/attachments`,
      {
        method: 'POST',
        body: JSON.stringify(dto),
      },
    ),

  list: (workspaceId: string, boardId: string, cardId: string) =>
    apiFetch<CardAttachment[]>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/attachments`,
    ),

  update: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    attachmentId: string,
    dto: { name?: string; url?: string },
  ) =>
    apiFetch<CardAttachment>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/attachments/${attachmentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(dto),
      },
    ),

  delete: (
    workspaceId: string,
    boardId: string,
    cardId: string,
    attachmentId: string,
  ) =>
    apiFetch<void>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/attachments/${attachmentId}`,
      { method: 'DELETE' },
    ),
}

// ── Document Endpoints ────────────────────────────────────────────────────────

export const documentApi = {
  create: (
    workspaceId: string,
    dto: { title?: string; parentCardId?: string; cardId?: string },
  ) => {
    const payload: Record<string, unknown> = {}
    if (dto.title !== undefined) payload.title = dto.title
    if (dto.parentCardId) payload.parentCardId = dto.parentCardId
    else if (dto.cardId) payload.parentCardId = dto.cardId
    return apiFetch<Document>(`/workspaces/${workspaceId}/documents`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  list: (
    workspaceId: string,
    query: { cursor?: string; limit?: number; search?: string } = {},
  ) => {
    const params = new URLSearchParams()
    if (query.cursor) params.set('cursor', query.cursor)
    if (query.limit) params.set('limit', String(query.limit || 20))
    if (query.search) params.set('search', query.search)
    return apiFetch<PaginatedResult<Document>>(
      `/workspaces/${workspaceId}/documents?${params.toString()}`,
    )
  },

  get: (workspaceId: string, documentId: string) =>
    apiFetch<Document>(`/workspaces/${workspaceId}/documents/${documentId}`),

  getById: (workspaceId: string, documentId: string) =>
    apiFetch<Document>(`/workspaces/${workspaceId}/documents/${documentId}`),

  rename: (workspaceId: string, documentId: string, dto: { title: string }) =>
    apiFetch<Document>(`/workspaces/${workspaceId}/documents/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  archive: (workspaceId: string, documentId: string) =>
    apiFetch<void>(`/workspaces/${workspaceId}/documents/${documentId}`, {
      method: 'DELETE',
    }),

  listByCard: (workspaceId: string, cardId: string) =>
    apiFetch<Document[]>(`/workspaces/${workspaceId}/cards/${cardId}/documents`),

  listByBoard: (workspaceId: string, boardId: string) =>
    apiFetch<Document[]>(`/workspaces/${workspaceId}/boards/${boardId}/documents`),

  // Snapshots
  createSnapshot: (
    workspaceId: string,
    documentId: string,
    dto: { name?: string; snapshotName?: string } = {},
  ) => {
    const payload: { name?: string; snapshotName?: string } = {}
    if (dto.name || dto.snapshotName) {
      payload.name = dto.name || dto.snapshotName
      payload.snapshotName = dto.snapshotName || dto.name
    }
    return apiFetch<DocumentSnapshot>(
      `/workspaces/${workspaceId}/documents/${documentId}/snapshots`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
  },

  listSnapshots: (workspaceId: string, documentId: string) =>
    apiFetch<DocumentSnapshot[]>(
      `/workspaces/${workspaceId}/documents/${documentId}/snapshots`,
    ),

  restoreSnapshot: (
    workspaceId: string,
    documentId: string,
    snapshotId: string,
  ) =>
    apiFetch<Document>(
      `/workspaces/${workspaceId}/documents/${documentId}/snapshots/${snapshotId}/restore`,
      { method: 'POST' },
    ),
}

// ── Health Endpoint ───────────────────────────────────────────────────────────

export const healthApi = {
  getHealth: () => apiFetch<HealthStatusResponse>('/health'),
}
