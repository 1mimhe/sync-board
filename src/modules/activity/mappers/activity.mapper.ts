import type { Activity, Prisma } from '@prisma/client';
import type { ActivityResponseDto } from '../dto/activity-response.dto';
import type { ActivityWithActor } from '../repositories/activity.repository';

function asObject(value: Prisma.JsonValue): Prisma.JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

export function toActivityResponseDto(
  event: ActivityWithActor,
): ActivityResponseDto {
  return {
    id: event.id.toString(),
    workspaceId: event.workspaceId,
    boardId: event.boardId,
    entityType: event.entityType,
    entityId: event.entityId,
    action: event.action,
    actorId: event.actorId,
    actor: event.actor,
    payload: asObject(event.payload),
    metadata: event.metadata === null ? null : asObject(event.metadata),
    createdAt: event.createdAt,
  };
}
