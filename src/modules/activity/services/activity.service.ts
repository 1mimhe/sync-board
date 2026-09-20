import { Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../common/exceptions/app.exception';
import { AuthService } from '../../auth/services/auth.service';
import type { ActivityEvent } from '@prisma/client';
import {
  ActivityRepository,
  ActivityEventWithActor,
} from '../repositories/activity.repository';
import { BoardService } from '../../board/core/services/board.service';
import type { ActivityFeedQueryDto } from '../dto/activity-feed-query.dto';
import type { CursorPaginationQueryDto } from '../../../common/dto/cursor-pagination-query.dto';
import type { PaginatedResult } from '../../../common/interfaces/pagination.interface';

/**
 * Service orchestrating workspace and board activity feed queries across
 * the partitioned activity audit log.
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
   * supporting optional filtering by entity, actor, and board.
   *
   * @param workspaceId - Target workspace UUID
   * @param query - Filter options, pagination limit, and composite cursor
   * @returns Paginated result containing ActivityEvent rows and cursor metadata
   */
  async getWorkspaceFeed(
    workspaceId: string,
    query: ActivityFeedQueryDto,
  ): Promise<PaginatedResult<ActivityEvent>> {
    const { cursor, limit = 20, ...filters } = query;
    return this.activityRepo.getWorkspacePage(
      workspaceId,
      filters,
      cursor,
      limit,
    );
  }

  /**
   * Retrieves a cursor-paginated activity feed scoped to a specific board.
   *
   * @param workspaceId - Owning workspace UUID
   * @param boardId - Target board UUID
   * @param query - Filter options, pagination limit, and composite cursor
   * @returns Paginated result containing ActivityEvent rows scoped to the board
   * @throws {EntityNotFoundException} If the board does not exist or is inactive in the workspace
   */
  async getBoardFeed(
    workspaceId: string,
    boardId: string,
    query: ActivityFeedQueryDto,
  ): Promise<PaginatedResult<ActivityEvent>> {
    await this.boardService.assertActiveBoard(boardId, workspaceId);
    return this.getWorkspaceFeed(workspaceId, { ...query, boardId });
  }

  /**
   * Retrieves legacy board activity history using UUID cursor pagination,
   * enriched with actor user profiles for backward compatibility.
   *
   * @param workspaceId - Owning workspace UUID
   * @param boardId - Target board UUID
   * @param query - Cursor pagination query with legacy UUID cursor
   * @returns Paginated result containing activity entries with actor profiles
   * @throws {EntityNotFoundException} If the board does not exist in the workspace
   * @throws {BadRequestException} If an invalid legacy cursor is supplied
   */
  async getLegacyBoardFeed(
    workspaceId: string,
    boardId: string,
    query: CursorPaginationQueryDto,
  ): Promise<PaginatedResult<ActivityEventWithActor>> {
    await this.boardService.assertActiveBoard(boardId, workspaceId);
    const page = await this.activityRepo.getLegacyBoardPage(
      workspaceId,
      boardId,
      query.cursor,
      query.limit ?? 20,
    );
    const actors = new Map(
      await Promise.all(
        [...new Set(page.items.map((row) => row.actorId))].map(async (id) => {
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
    return {
      items: page.items.map((row) => ({
        ...row,
        actor: actors.get(row.actorId) ?? {
          id: row.actorId,
          displayName: 'Unknown user',
          avatarUrl: null,
        },
      })),
      pagination: page.pagination,
    };
  }
}
