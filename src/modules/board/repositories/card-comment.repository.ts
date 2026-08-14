import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import type { CardCommentWithAuthor } from '../interfaces/board.interfaces';

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
        author: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
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
        author: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * Finds active comments on a card with pagination and author details.
   *
   * @param cardId - Card UUID
   * @param skip - Number of items to skip
   * @param take - Number of items to take
   * @returns Array of comments with author details
   */
  async findCardComments(
    cardId: string,
    skip: number = 0,
    take?: number,
  ): Promise<CardCommentWithAuthor[]> {
    return this.prisma.cardComment.findMany({
      where: { cardId, deletedAt: null },
      include: {
        author: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    });
  }

  /**
   * Counts total active (non-deleted) comments on a card.
   *
   * @param cardId - Card UUID
   * @returns Total active comment count
   */
  async countByCardId(cardId: string): Promise<number> {
    return this.prisma.cardComment.count({
      where: { cardId, deletedAt: null },
    });
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
        author: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
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
