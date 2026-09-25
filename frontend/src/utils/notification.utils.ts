import type { Notification } from '../types'

/**
 * Resolves a notification to its target deep-link route per Frontend 6 & WS-CONTRACT-6.
 *
 * Mapping:
 * - card/comment: /workspaces/:w/boards/:b/cards/:id (+?comment=:commentId)
 * - workspace: /workspaces/:id
 * - fallback/unknown: /notifications
 */
export function resolveNotificationRoute(n: Notification): string {
  const entityType = n.entityType ?? ''
  const entityId = n.entityId ?? ''
  const boardId = n.boardId ?? null
  const cardId = n.cardId ?? (entityType === 'card' ? entityId : null)

  if ((entityType === 'card' || entityType === 'comment') && cardId) {
    if (boardId && n.workspaceId) {
      const base = `/workspaces/${n.workspaceId}/boards/${boardId}/cards/${cardId}`
      if (entityType === 'comment' && entityId) {
        return `${base}?comment=${entityId}`
      }
      return base
    }
    return '/notifications'
  }

  if (entityType === 'workspace' && n.workspaceId) {
    return `/workspaces/${n.workspaceId}`
  }

  return '/notifications'
}
