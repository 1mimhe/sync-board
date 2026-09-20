import type { NotificationType } from '@prisma/client';

/** Payload carried on notification.exchange (see docs/08 §4.1). */
export interface NotificationMessagePayload {
  userId: string;
  workspaceId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  boardId?: string;
  cardId?: string;
  actorId?: string;
  actorName?: string;
}

export const NOTIFICATION_ROUTING_KEYS = {
  cardAssigned: 'notification.card.assigned',
  commentAdded: 'notification.comment.added',
  commentMentioned: 'notification.comment.mentioned',
  cardStatusChanged: 'notification.card.status',
  cardPriorityChanged: 'notification.card.priority',
  cardLinked: 'notification.card.linked',
  workspaceInvited: 'notification.workspace.invited',
  workspaceRoleChanged: 'notification.workspace.role_changed',
} as const;
