import { Injectable, BadRequestException } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import { buildCursorPagination } from '../../../common/utils/pagination.util';
import { NotificationListQueryDto } from '../dto/notification-query.dto';

/**
 * Database repository managing user notifications in PostgreSQL.
 */
@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists a notification record once, skipping duplicate deliveries based on unique constraints.
   *
   * @param data - Unchecked notification creation input
   * @returns Persisted notification row or null when skipped as duplicate
   */
  async createOnce(
    data: Prisma.NotificationUncheckedCreateInput,
  ): Promise<Notification | null> {
    const rows = await this.prisma.notification.createManyAndReturn({
      data: [data],
      skipDuplicates: true,
    });
    return rows[0] ?? null;
  }

  /**
   * Retrieves a cursor-paginated page of notifications for a user, ordered newest-first.
   *
   * @param userId - Target user UUID
   * @param query - Cursor pagination parameters and unread-only filter
   * @returns Paginated result containing notifications and cursor metadata
   * @throws {BadRequestException} If an invalid cursor is provided
   */
  async findPageForUser(
    userId: string,
    query: NotificationListQueryDto,
  ): Promise<PaginatedResult<Notification>> {
    const limit = query.limit ?? 20;
    const boundary = query.cursor
      ? await this.prisma.notification.findFirst({
          where: { id: query.cursor, userId },
        })
      : null;
    if (query.cursor && !boundary)
      throw new BadRequestException('Invalid notification cursor');
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(query.unreadOnly ? { isRead: false } : {}),
        ...(boundary
          ? {
              OR: [
                { createdAt: { lt: boundary.createdAt } },
                { createdAt: boundary.createdAt, id: { lt: boundary.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return buildCursorPagination(rows, limit);
  }

  /**
   * Counts the number of unread notifications for a user.
   *
   * @param userId - Target user UUID
   * @returns Count of unread notifications
   */
  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  /**
   * Marks a specific notification as read if owned by the user.
   *
   * @param userId - Target user UUID
   * @param id - Notification UUID
   * @returns Object containing updated notification and whether it was previously unread, or null if not found
   */
  async markRead(
    userId: string,
    id: string,
  ): Promise<{ notification: Notification; wasUnread: boolean } | null> {
    const current = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!current) return null;
    if (!current.isRead) {
      const updated = await this.prisma.notification.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
      });
      return { notification: updated, wasUnread: true };
    }
    return { notification: current, wasUnread: false };
  }

  /**
   * Marks all unread notifications for a user as read.
   *
   * @param userId - Target user UUID
   */
  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Purges read notifications created before a specified cutoff timestamp.
   *
   * @param cutoff - Deletion threshold date
   * @returns Number of deleted notification records
   */
  async deleteReadOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.notification.deleteMany({
      where: { isRead: true, createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}
