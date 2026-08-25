import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import type { CardCommentWithAuthor } from '../../board/interfaces/board.interfaces';

/**
 * Author summary fields included with every comment (response mapping contract).
 */
export const AUTHOR_SUMMARY_SELECT = {
  select: { id: true, displayName: true, avatarUrl: true },
} as const;

/**
 * Repository handling database operations for card comments.
 */
@Injectable()
export class CardCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new comment on a card and returns it with author details.
   *
   * @param data - Comment creation payload
   * @returns The created comment with author details
   */
  async create(
    data: Prisma.CardCommentUncheckedCreateInput,
  ): Promise<CardCommentWithAuthor> {
    const comment = await this.prisma.cardComment.create({ data });

    return this.prisma.cardComment.findUniqueOrThrow({
      where: { id: comment.id },
      include: {
        author: AUTHOR_SUMMARY_SELECT,
      },
    });
  }

  /**
   * Finds an active (non-deleted) comment by ID with author details, optionally scoped to a card.
   *
   * @param id - Comment UUID
   * @param cardId - Optional card UUID filter
   * @returns The comment or null if not found/deleted
   */
  async findActiveById(
    id: string,
    cardId?: string,
  ): Promise<CardCommentWithAuthor | null> {
    return this.prisma.cardComment.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(cardId && { cardId }),
      },
      include: {
        author: AUTHOR_SUMMARY_SELECT,
      },
    });
  }

  /**
   * Fetch a cursor page of active comments for a card, newest first.
   * Fetches limit + 1 rows so callers can compute hasMore.
   *
   * Unknown/stale cursors are tolerated: when Prisma cannot locate the cursor row,
   * the query is retried without it, returning the newest page.
   *
   * @param cardId - Card UUID
   * @param cursor - Last item id of the previous page (optional)
   * @param limit - Page size; one extra row is fetched to detect the next page
   * @returns Array of comments with author details (length up to limit + 1)
   */
  async findCardCommentsPage(
    cardId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CardCommentWithAuthor[]> {
    try {
      return await this.prisma.cardComment.findMany({
        where: { cardId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { author: AUTHOR_SUMMARY_SELECT },
      });
    } catch (error) {
      if (
        cursor &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Unknown/stale cursor — degrade gracefully to the newest page
        return this.prisma.cardComment.findMany({
          where: { cardId, deletedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          include: { author: AUTHOR_SUMMARY_SELECT },
        });
      }
      throw error;
    }
  }

  /**
   * Updates the content of an existing comment.
   *
   * @param id - Comment UUID
   * @param content - New comment text
   * @returns The updated comment with author details
   */
  async update(id: string, content: string): Promise<CardCommentWithAuthor> {
    await this.prisma.cardComment.update({
      where: { id },
      data: { content },
    });

    return this.prisma.cardComment.findUniqueOrThrow({
      where: { id },
      include: {
        author: AUTHOR_SUMMARY_SELECT,
      },
    });
  }

  /**
   * Soft-deletes a comment by setting `deletedAt` timestamp.
   *
   * @param id - Comment UUID
   */
  async softDelete(id: string): Promise<void> {
    await this.prisma.cardComment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
