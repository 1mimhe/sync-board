import { Injectable, Logger } from '@nestjs/common';
import { Activity, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { getReplicaClient } from '../../../common/database/replica.client';
import { buildCursorPagination } from '../../../common/utils/pagination.util';
import type { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import {
  decodeActivityCursor,
  encodeActivityCursor,
} from '../utils/activity-cursor.util';
import type {
  ActivityFilters,
  RecordActivityInput,
} from '../interfaces/activity.interfaces';

/**
 * Database repository managing the partitioned activity audit log
 * (Prisma model `Activity`, table `activities`).
 */
@Injectable()
export class ActivityRepository {
  private readonly logger = new Logger(ActivityRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends an audit log record into the partitioned `activities` table.
   *
   * @param data - Activity input including workspace, entity, actor, and payload
   * @returns Promise resolving when the record has been persisted
   */
  async record(data: RecordActivityInput): Promise<void> {
    await this.prisma.activity.create({
      data: {
        ...data,
        boardId: data.boardId ?? null,
        payload: data.payload ?? {},
      },
    });
  }

  /**
   * Retrieves a page of activities using a composite cursor (createdAt, id),
   * ordered newest-first. Supports workspace-wide and filtered queries.
   *
   * @param workspaceId - Workspace UUID
   * @param filters - Optional filters by entityType, entityId, actorId, boardId
   * @param cursor - Optional encoded composite cursor string
   * @param limit - Maximum items to return
   * @returns Paginated result containing activities and next-page cursor
   * @throws {BadRequestException} If the composite cursor is malformed
   */
  async getWorkspacePage(
    workspaceId: string,
    filters: ActivityFilters,
    cursor: string | undefined,
    limit: number,
  ): Promise<PaginatedResult<Activity>> {
    const { entityType, entityId, actorId, boardId } = filters;
    const where: Prisma.ActivityWhereInput = {
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
    const replica = getReplicaClient();
    const db = replica ?? this.prisma;
    this.logger.debug(
      `Activity feed served from ${replica ? 'replica' : 'primary'}`,
    );
    const rows = await db.activity.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return buildCursorPagination(rows, limit, (row) =>
      encodeActivityCursor(row.createdAt, row.id.toString()),
    );
  }

  /**
   * Pre-creates monthly partitions for the activities table.
   *
   * @returns Promise resolving when partition upkeep completes
   */
  async ensurePartitions(): Promise<void> {
    await this.prisma.$executeRaw`SELECT ensure_activity_partitions()`;
  }
}
