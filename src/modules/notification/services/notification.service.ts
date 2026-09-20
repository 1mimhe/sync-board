import { Injectable, Logger } from '@nestjs/common';
import { EntityNotFoundException } from '../../../common/exceptions/app.exception';
import type { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import { RedisService } from '../../../common/redis/redis.service';
import { NotificationRepository } from '../repositories/notification.repository';
import type { NotificationListQueryDto } from '../dto/notification-query.dto';
import type { NotificationResponseDto } from '../dto/notification-response.dto';
import { toNotificationResponseDto } from '../dto/notification-response.dto';

import { UNREAD_COUNT_TTL_SECONDS } from '../notification.constants';
import { unreadCountKey } from '../utils/notification-cache.util';


/** Thin facade over NotificationRepository + Redis unread counter. */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly redis: RedisService,
  ) {}

  /**
   * Lists the caller's notifications newest-first.
   *
   * @param userId - Caller user UUID
   * @param query - Cursor pagination + unreadOnly filter
   * @returns Paginated response DTOs
   */
  async listForUser(
    userId: string,
    query: NotificationListQueryDto,
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    const page = await this.notificationRepo.findPageForUser(userId, query);
    return { ...page, items: page.items.map(toNotificationResponseDto) };
  }

  /**
   * Returns the caller's unread count, preferring the Redis counter.
   *
   * @param userId - Caller user UUID
   * @returns Unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const cached = await this.redis.get(unreadCountKey(userId));
      if (cached !== null) {
        const parsed = Number(cached);
        if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
      }
    } catch (error) {
      this.logger.warn('Unread-count cache read failed, falling back to DB', {
        userId,
        error: (error as Error).message,
      });
    }
    return this.notificationRepo.countUnread(userId);
  }

  /**
   * Marks one notification as read (owner-scoped).
   *
   * @param userId - Caller user UUID
   * @param id - Notification UUID
   * @returns Updated DTO
   * @throws {EntityNotFoundException} When the notification is not owned by the caller
   */
  async markRead(userId: string, id: string): Promise<NotificationResponseDto> {
    const result = await this.notificationRepo.markRead(userId, id);
    if (!result) throw new EntityNotFoundException('Notification', id);
    if (result.wasUnread) {
      try {
        const current =
          Number(await this.redis.get(unreadCountKey(userId))) || 0;
        if (current > 0) await this.redis.decr(unreadCountKey(userId));
        else
          await this.redis.set(
            unreadCountKey(userId),
            '0',
            'EX',
            UNREAD_COUNT_TTL_SECONDS,
          );
      } catch (error) {
        this.logger.warn('Unread-count cache decrement failed', {
          userId,
          error: (error as Error).message,
        });
      }
    }
    return toNotificationResponseDto(result.notification);
  }

  /**
   * Marks all of the caller's notifications as read.
   *
   * @param userId - Caller user UUID
   * @returns Promise resolving when all notifications are marked read and cache is cleared
   */
  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepo.markAllRead(userId);
    try {
      await this.redis.del(unreadCountKey(userId));
    } catch (error) {
      this.logger.warn('Unread-count cache clear failed', {
        userId,
        error: (error as Error).message,
      });
    }
  }
}
