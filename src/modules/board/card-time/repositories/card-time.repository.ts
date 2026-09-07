import { Injectable } from '@nestjs/common';
import { CardTimeEntry, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';
import type { PaginatedResult } from '../../../../common/interfaces/pagination.interface';

/** Repository handling database operations for card time entries. */
@Injectable()
export class CardTimeRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Adds a new time entry and increments the card's loggedMinutes counter atomically.
   *
   * @param data - Time entry creation payload
   * @returns The created time entry
   */
  async addEntry(
    data: Prisma.CardTimeEntryUncheckedCreateInput,
  ): Promise<CardTimeEntry> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const entry = await tx.cardTimeEntry.create({ data });

        await tx.card.update({
          where: { id: data.cardId },
          data: { loggedMinutes: { increment: data.minutes } },
        });

        return entry;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new EntityNotFoundException('Card', data.cardId);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new EntityNotFoundException('Card', data.cardId);
      }
      throw error;
    }
  }

  /**
   * Lists time entries for a card with cursor pagination.
   *
   * @param cardId - Card UUID
   * @param cursor - Last item id of the previous page
   * @param limit - Page size
   * @returns PaginatedResult with items and pagination
   */
  async listForCard(
    cardId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<PaginatedResult<CardTimeEntry>> {
    const entries = await this.prisma.cardTimeEntry.findMany({
      where: { cardId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            email: true,
          },
        },
      },
    });

    const hasMore = entries.length > limit;
    const items = hasMore ? entries.slice(0, limit) : entries;
    const nextCursor = items.length > 0 ? items[items.length - 1].id : null;

    return { items, pagination: { cursor: nextCursor, hasMore } };
  }

  /**
   * Gets the total logged minutes for a card.
   *
   * @param cardId - Card UUID
   * @returns Total logged minutes
   */
  async sumForCard(cardId: string): Promise<number> {
    const result = await this.prisma.cardTimeEntry.aggregate({
      where: { cardId },
      _sum: { minutes: true },
    });
    return result._sum.minutes ?? 0;
  }
}
