import type { ActionType, ActivityEvent, Prisma } from '@prisma/client';
import type { ActivityEventResponseDto } from '../dto/activity-response.dto';
import type { ActivityResponseDto } from '../../board/core/dto/activity-response.dto';
import type { ActivityEventWithActor } from '../repositories/activity.repository';

function asObject(value: Prisma.JsonValue): Prisma.JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

export function toActivityEventResponseDto(
  event: ActivityEvent,
): ActivityEventResponseDto {
  return {
    id: event.id.toString(),
    workspaceId: event.workspaceId,
    boardId: event.boardId,
    entityType: event.entityType,
    entityId: event.entityId,
    action: event.action,
    actorId: event.actorId,
    payload: asObject(event.payload),
    metadata: event.metadata === null ? null : asObject(event.metadata),
    createdAt: event.createdAt,
  };
}

export function toLegacyActivityResponseDto(
  event: ActivityEventWithActor,
): ActivityResponseDto {
  const payload = asObject(event.payload);
  return {
    id: event.legacyId,
    boardId: event.boardId ?? '',
    user: event.actor,
    action: event.action as ActionType,
    entityType: event.entityType,
    entityId: event.entityId,
    entityTitle:
      typeof payload.entityTitle === 'string' ? payload.entityTitle : null,
    fromListId:
      typeof payload.fromListId === 'string' ? payload.fromListId : null,
    toListId: typeof payload.toListId === 'string' ? payload.toListId : null,
    details: payload.details ?? null,
    createdAt: event.createdAt,
  };
}
