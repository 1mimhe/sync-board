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
   * Finds recent activities for a board with actor user details.
   *
   * @param boardId - Board UUID
   * @param limit - Maximum number of activities to retrieve (defaults to 50)
   * @returns Array of activities with user details ordered newest first
   */
  async findByBoardId(
    boardId: string,
    limit = 50,
  ): Promise<ActivityWithAuthor[]> {
    return this.prisma.activity.findMany({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
      take: limit,
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
  }
}
