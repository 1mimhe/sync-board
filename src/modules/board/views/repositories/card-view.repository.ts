import { Injectable } from '@nestjs/common';
import { Card, CardPriority, CardStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import type { PaginatedResult } from '../../../../common/interfaces/pagination.interface';
import type { CardWithDetails } from '../../core/interfaces/board.interfaces';
import type { CardTableFilters } from '../interfaces/card-view.interfaces';

/** Repository handling read-only view queries for cards. */
@Injectable()
export class CardViewRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds cards with dueDate in [from, to] range (calendar view).
   * Active cards only, ordered by dueDate ascending.
   */
  async calendarPage(
    boardId: string,
    from: Date,
    to: Date,
    cursor: string | undefined,
    limit: number,
  ): Promise<PaginatedResult<Card>> {
    const cards = await this.prisma.card.findMany({
      where: {
        list: { boardId },
        archivedAt: null,
        deletedAt: null,
        dueDate: { gte: from, lte: to },
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = cards.length > limit;
    const items = hasMore ? cards.slice(0, limit) : cards;
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    return { items, pagination: { cursor: nextCursor, hasMore } };
  }

  /**
   * Finds cards ordered by createdAt (timeline view).
   * Active cards only, ordered by createdAt ascending.
   */
  async timelinePage(
    boardId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<PaginatedResult<Card>> {
    const cards = await this.prisma.card.findMany({
      where: {
        list: { boardId },
        archivedAt: null,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = cards.length > limit;
    const items = hasMore ? cards.slice(0, limit) : cards;
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    return { items, pagination: { cursor: nextCursor, hasMore } };
  }

  /**
   * Flat table page with optional filters (status, priority, assignee).
   * Active cards only, ordered by updatedAt descending.
   */
  async tablePage(
    boardId: string,
    filters: CardTableFilters,
    cursor: string | undefined,
    limit: number,
  ): Promise<PaginatedResult<CardWithDetails>> {
    const where: Prisma.CardWhereInput = {
      list: { boardId },
      archivedAt: null,
      deletedAt: null,
    };
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assigneeId) {
      where.assignees = { some: { userId: filters.assigneeId } };
    }
    if (filters.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
    }

    const sortField = [
      'title',
      'dueDate',
      'priority',
      'status',
      'createdAt',
      'updatedAt',
    ].includes(filters.sortBy || '')
      ? (filters.sortBy as string)
      : 'updatedAt';
    const sortDirection = filters.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.CardOrderByWithRelationInput[] = [
      { [sortField]: sortDirection },
      { id: 'desc' },
    ];

    const cards = await this.prisma.card.findMany({
      where,
      include: {
        assignees: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
        labels: { include: { label: true } },
        attachments: {
          where: { archivedAt: null },
          include: {
            uploadedBy: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = cards.length > limit;
    const items = (hasMore
      ? cards.slice(0, limit)
      : cards) as unknown as CardWithDetails[];
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    return { items, pagination: { cursor: nextCursor, hasMore } };
  }
}
