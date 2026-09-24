import type { Activity, EntityType, Prisma } from '@prisma/client';

/** Domain types for the activity audit log. */
export type ActivityEntityType = EntityType;
export type ActivityActionType = string;

export interface RecordActivityInput {
  workspaceId: string;
  boardId?: string | null;
  entityType: EntityType;
  entityId: string;
  action: string;
  actorId: string;
  payload?: Prisma.InputJsonObject;
  metadata?: Prisma.InputJsonObject;
}

export interface ActivityFilters {
  entityType?: EntityType;
  entityId?: string;
  actorId?: string;
  boardId?: string;
}

export interface ActivityWithActor extends Activity {
  actor: { id: string; displayName: string; avatarUrl: string | null };
}
