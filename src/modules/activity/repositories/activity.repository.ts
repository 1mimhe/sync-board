import { Injectable } from '@nestjs/common';
import { Activity, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import type { ActivityWithAuthor } from '../../board/board/interfaces/board.interfaces';

/**
 * Repository handling database operations for board activity logs.
 */
@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new activity log record in the database.
   *
   * @param data - Activity creation payload
   * @returns The created activity record
   */
  async create(data: Prisma.ActivityUncheckedCreateInput): Promise<Activity> {
    return this.prisma.activity.create({
      data,
    });
  }

  /**
   * Finds a cursor page of activities for a board with actor user details,
   * newest first. Fetches limit + 1 rows so callers can compute hasMore.
   *
   * Unknown/stale cursors are tolerated: when Prisma cannot locate the cursor row,
   * the query is retried without it, returning the newest page.
   *
   * @param boardId - Board UUID
   * @param cursor - Last item id of the previous page (optional)
   * @param limit - Page size; one extra row is fetched to detect the next page
   * @returns Array of activities with user details (length up to limit + 1)
   */
  async findByBoardIdPage(
    boardId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<ActivityWithAuthor[]> {
    const find = (withCursor: boolean) =>
      this.prisma.activity.findMany({
        where: { boardId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(withCursor && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

    try {
      return await find(true);
    } catch (error) {
      if (
        cursor &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Unknown/stale cursor — degrade gracefully to the newest page
        return find(false);
      }
      throw error;
    }
  }
}
