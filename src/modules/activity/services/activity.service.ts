import { Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../common/exceptions/app.exception';
import { AuthService } from '../../auth/services/auth.service';
import type { Activity } from '@prisma/client';
import { ActivityRepository } from '../repositories/activity.repository';
import type { ActivityWithActor } from '../interfaces/activity.interfaces';
import { BoardService } from '../../board/core/services/board.service';
import type { ActivityFeedQueryDto } from '../dto/activity-feed-query.dto';
import type { PaginatedResult } from '../../../common/interfaces/pagination.interface';

/**
 * Service orchestrating workspace and board activity feed queries across
 * the partitioned activity audit log, enriched with actor profiles.
 */
@Injectable()
export class ActivityService {
  constructor(
    private readonly activityRepo: ActivityRepository,
    private readonly boardService: BoardService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Retrieves a cursor-paginated activity feed for an entire workspace,
   * supporting optional filtering by entity, actor, and board. Items are
   * enriched with actor profiles (unknown-user fallback).
   *
   * @param workspaceId - Target workspace UUID
   * @param query - Filter options, pagination limit, and composite cursor
   * @returns Paginated result containing activities with actor profiles
   */
  async getWorkspaceFeed(
    workspaceId: string,
    query: ActivityFeedQueryDto,
  ): Promise<PaginatedResult<ActivityWithActor>> {
    const { cursor, limit = 20, ...filters } = query;
    const page = await this.activityRepo.getWorkspacePage(
      workspaceId,
      filters,
      cursor,
      limit,
    );
    return {
      ...page,
      items: await this.enrichWithActors(page.items),
    };
  }

  /**
   * Retrieves a cursor-paginated activity feed scoped to a specific board,
   * enriched with actor profiles.
   *
   * @param workspaceId - Owning workspace UUID
   * @param boardId - Target board UUID
   * @param query - Filter options, pagination limit, and composite cursor
   * @returns Paginated result containing activities scoped to the board
   * @throws {EntityNotFoundException} If the board does not exist or is inactive in the workspace
   */
  async getBoardFeed(
    workspaceId: string,
    boardId: string,
    query: ActivityFeedQueryDto,
  ): Promise<PaginatedResult<ActivityWithActor>> {
    await this.boardService.assertActiveBoard(boardId, workspaceId);
    return this.getWorkspaceFeed(workspaceId, { ...query, boardId });
  }

  private async enrichWithActors(
    rows: Activity[],
  ): Promise<ActivityWithActor[]> {
    const actors = new Map(
      await Promise.all(
        [...new Set(rows.map((row) => row.actorId))].map(async (id) => {
          try {
            const profile = await this.authService.getProfile(id);
            return [
              id,
              {
                id,
                displayName: profile.displayName,
                avatarUrl: profile.avatarUrl,
              },
            ] as const;
          } catch (error) {
            if (!(error instanceof EntityNotFoundException)) throw error;
            return [
              id,
              { id, displayName: 'Unknown user', avatarUrl: null },
            ] as const;
          }
        }),
      ),
    );
    return rows.map((row) => ({
      ...row,
      actor: actors.get(row.actorId) ?? {
        id: row.actorId,
        displayName: 'Unknown user',
        avatarUrl: null,
      },
    }));
  }
}
