import type { Notification } from '@prisma/client';
import type { NotificationResponseDto } from '../dto/notification-response.dto';

/**
 * Maps a Prisma notification row to its response DTO.
 *
 * @param n - Prisma notification row
 * @returns Response DTO
 */
export function toNotificationResponseDto(
  n: Notification,
): NotificationResponseDto {
  return {
    id: n.id,
    userId: n.userId,
    workspaceId: n.workspaceId,
    type: n.type,
    title: n.title,
    body: n.body,
    entityType: n.entityType,
    entityId: n.entityId,
    boardId: n.boardId ?? null,
    cardId: n.cardId ?? null,
    isRead: n.isRead,
    createdAt: n.createdAt,
  };
}
