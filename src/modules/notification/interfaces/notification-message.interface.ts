import type { NotificationType } from '@prisma/client';

/** Payload carried on the notification exchange. */
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
