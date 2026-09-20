import { BadRequestException, Injectable } from '@nestjs/common';
import { ActivityEvent, EntityType, Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../../common/database/prisma.service';
import { buildCursorPagination } from '../../../common/utils/pagination.util';
import type { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import {
  decodeActivityCursor,
  encodeActivityCursor,
} from '../utils/activity-cursor.util';

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

export interface ActivityEventWithActor extends ActivityEvent {
  actor: { id: string; displayName: string; avatarUrl: string | null };
}

/**
 * Database repository managing the partitioned activity audit log (`activity_events`).
 */
@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends an audit log record into the partitioned `activity_events` table.
   *
   * @param data - Activity event input including workspace, entity, actor, and payload
   * @returns Promise resolving when the record has been persisted
   */
  async record(data: RecordActivityInput): Promise<void> {
    await this.prisma.activityEvent.create({
      data: {
        ...data,
        boardId: data.boardId ?? null,
        payload: data.payload ?? {},
      },
    });
  }

  /**
   * Retrieves a page of activity events using a composite cursor (createdAt, id),
   * ordered newest-first. Supports workspace-wide and filtered queries.
   *
   * @param workspaceId - Workspace UUID
   * @param filters - Optional filters by entityType, entityId, actorId, boardId
   * @param cursor - Optional encoded composite cursor string
   * @param limit - Maximum items to return
   * @returns Paginated result containing activity events and next-page cursor
   * @throws {BadRequestException} If the composite cursor is malformed
   */
  async getWorkspacePage(
    workspaceId: string,
    filters: ActivityFilters,
    cursor: string | undefined,
    limit: number,
  ): Promise<PaginatedResult<ActivityEvent>> {
    const { entityType, entityId, actorId, boardId } = filters;
    const where: Prisma.ActivityEventWhereInput = {
      workspaceId,
      entityType,
      entityId,
      actorId,
      boardId,
    };
    if (cursor !== undefined) {
      const { createdAt, id } = decodeActivityCursor(cursor);
      where.OR = [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: id } },
      ];
    }
    const rows = await this.prisma.activityEvent.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return buildCursorPagination(rows, limit, (row) =>
      encodeActivityCursor(row.createdAt, row.id.toString()),
    );
  }

  /**
   * Retrieves legacy board activity history using the UUID `legacyId` cursor,
   * preserving backward compatibility for previous API clients.
   *
   * @param workspaceId - Workspace UUID
   * @param boardId - Board UUID
   * @param cursor - Optional UUID cursor pointing to a previous legacyId
   * @param limit - Maximum items to return
   * @returns Paginated result containing activity events with UUID cursors
   * @throws {BadRequestException} If the cursor is not a valid UUID or does not exist
   */
  async getLegacyBoardPage(
    workspaceId: string,
    boardId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<PaginatedResult<ActivityEvent>> {
    if (cursor !== undefined && !isUUID(cursor, '4'))
      throw new BadRequestException('Invalid activity cursor');
    const boundary = cursor
      ? await this.prisma.activityEvent.findFirst({
          where: { workspaceId, boardId, legacyId: cursor },
        })
      : null;
    if (cursor && !boundary)
      throw new BadRequestException('Invalid activity cursor');
    const rows = await this.prisma.activityEvent.findMany({
      where: {
        workspaceId,
        boardId,
        ...(boundary
          ? {
              OR: [
                { createdAt: { lt: boundary.createdAt } },
                {
                  createdAt: boundary.createdAt,
                  legacyId: { lt: boundary.legacyId },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { legacyId: 'desc' }],
      take: limit + 1,
    });
    return buildCursorPagination(rows, limit, (row) => row.legacyId);
  }

  /**
   * Pre-creates monthly partitions for the activity_events table.
   *
   * @returns Promise resolving when partition upkeep completes
   */
  async ensurePartitions(): Promise<void> {
    await this.prisma.$executeRaw`SELECT ensure_activity_partitions()`;
  }
}
