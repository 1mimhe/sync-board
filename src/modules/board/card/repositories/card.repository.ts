import { Injectable } from '@nestjs/common';
import { Card, CardPriority, CardStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';
import type { CardWithDetails } from '../../core/interfaces/board.interfaces';
import type { PaginatedResult } from '../../../../common/interfaces/pagination.interface';

/**
 * Repository handling database operations for cards, card assignees, and card labels.
 */
@Injectable()
export class CardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new card record along with initial assignees and labels in an atomic transaction.
   *
   * @param data - Card creation payload
   * @param assigneeIds - Optional array of user UUIDs to assign
   * @param labelIds - Optional array of label UUIDs to attach
   * @returns The newly created card with its full relation graph
   */
  async create(
    data: Prisma.CardUncheckedCreateInput,
    assigneeIds?: string[],
    labelIds?: string[],
  ): Promise<CardWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.card.create({ data });

      if (assigneeIds && assigneeIds.length > 0) {
        await tx.cardAssignee.createMany({
          data: assigneeIds.map((userId) => ({ cardId: card.id, userId })),
          skipDuplicates: true,
        });
      }

      if (labelIds && labelIds.length > 0) {
        await tx.cardLabel.createMany({
          data: labelIds.map((labelId) => ({ cardId: card.id, labelId })),
          skipDuplicates: true,
        });
      }

      return tx.card.findUniqueOrThrow({
        where: { id: card.id },
        include: {
          assignees: {
            include: {
              user: {
                select: { id: true, displayName: true, avatarUrl: true },
              },
            },
          },
          labels: {
            include: { label: true },
          },
          attachments: {
            where: { archivedAt: null },
            include: {
              uploadedBy: {
                select: { id: true, displayName: true, avatarUrl: true },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Finds an active (non-archived, non-deleted) card by ID with its full relational graph, optionally scoped to a board.
   *
   * @param id - Card UUID
   * @param boardId - Optional board UUID filter
   * @returns The card with details, or null if not found/archived/deleted
   */
  async findActiveById(
    id: string,
    boardId?: string,
  ): Promise<CardWithDetails | null> {
    return this.prisma.card.findFirst({
      where: {
        id,
        archivedAt: null,
        deletedAt: null,
        ...(boardId && { list: { boardId } }),
      },
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
        labels: {
          include: { label: true },
        },
        attachments: {
          where: { archivedAt: null },
          include: {
            uploadedBy: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });
  }

  /**
   * Finds a card by ID including archived cards, optionally scoped to a board.
   *
   * @param id - Card UUID
   * @param boardId - Optional board UUID filter
   * @returns The card or null if not found
   */
  async findByIdIncludingArchived(
    id: string,
    boardId?: string,
  ): Promise<Card | null> {
    return this.prisma.card.findFirst({
      where: {
        id,
        ...(boardId && { list: { boardId } }),
      },
    });
  }

  /**
   * Finds the last active card in a list (highest rank) for rank calculation.
   *
   * @param listId - List UUID
   * @returns The last card in the list or null if empty
   */
  async findLastInList(listId: string): Promise<Card | null> {
    return this.prisma.card.findFirst({
      where: { listId, archivedAt: null, deletedAt: null },
      orderBy: { rank: 'desc' },
    });
  }

  /**
   * Updates fields of an existing card.
   *
   * @param id - Card UUID
   * @param data - Update payload
   * @returns The updated card
   */
  async update(id: string, data: Prisma.CardUpdateInput): Promise<Card> {
    return this.prisma.card.update({
      where: { id },
      data,
    });
  }

  /**
   * Moves a card to a target list and updates its rank.
   *
   * @param cardId - Card UUID
   * @param targetListId - Destination list UUID
   * @param newRank - Newly calculated LexoRank string
   * @returns The updated card
   */
  async moveCard(
    cardId: string,
    targetListId: string,
    newRank: string,
  ): Promise<Card> {
    return this.prisma.card.update({
      where: { id: cardId },
      data: {
        listId: targetListId,
        rank: newRank,
      },
    });
  }

  /**
   * Soft-deletes a card by setting `archivedAt` timestamp.
   *
   * @param id - Card UUID
   * @returns The archived card
   */
  async archive(id: string): Promise<Card> {
    return this.prisma.card.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  /**
   * Restores an archived card by clearing `archivedAt`.
   *
   * @param id - Card UUID
   * @returns The restored card
   */
  async unarchive(id: string): Promise<Card> {
    return this.prisma.card.update({
      where: { id },
      data: { archivedAt: null },
    });
  }

  /**
   * Assigns a user to a card.
   *
   * @param cardId - Card UUID
   * @param userId - User UUID to assign
   */
  async addAssignee(cardId: string, userId: string): Promise<void> {
    await this.prisma.cardAssignee.upsert({
      where: { cardId_userId: { cardId, userId } },
      create: { cardId, userId },
      update: {},
    });
  }

  /**
   * Removes an assigned user from a card.
   *
   * @param cardId - Card UUID
   * @param userId - User UUID to remove
   */
  async removeAssignee(cardId: string, userId: string): Promise<void> {
    await this.prisma.cardAssignee.deleteMany({
      where: { cardId, userId },
    });
  }

  /**
   * Attaches a label to a card.
   *
   * @param cardId - Card UUID
   * @param labelId - Label UUID to attach
   */
  async addLabel(cardId: string, labelId: string): Promise<void> {
    await this.prisma.cardLabel.upsert({
      where: { cardId_labelId: { cardId, labelId } },
      create: { cardId, labelId },
      update: {},
    });
  }

  /**
   * Detaches a label from a card.
   *
   * @param cardId - Card UUID
   * @param labelId - Label UUID to detach
   */
  async removeLabel(cardId: string, labelId: string): Promise<void> {
    await this.prisma.cardLabel.deleteMany({
      where: { cardId, labelId },
    });
  }

  /**
   * Finds a cursor page of archived (non-deleted) cards in a board.
   *
   * @param boardId - Board UUID
   * @param cursor - Last item id of the previous page
   * @param limit - Page size
   * @returns PaginatedResult with items and pagination cursor/hasMore
   */
  async findArchivedByBoardIdPage(
    boardId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<PaginatedResult<CardWithDetails>> {
    const cards = (await this.prisma.card.findMany({
      where: {
        archivedAt: { not: null },
        deletedAt: null,
        list: { boardId },
      },
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
        labels: {
          include: { label: true },
        },
        attachments: {
          where: { archivedAt: null },
          include: {
            uploadedBy: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: [{ archivedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })) as unknown as CardWithDetails[];

    const hasMore = cards.length > limit;
    const items = hasMore ? cards.slice(0, limit) : cards;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      pagination: { cursor: nextCursor, hasMore },
    };
  }

  /**
   * Finds a card by ID including deleted cards, optionally scoped to a board.
   *
   * @param id - Card UUID
   * @param boardId - Optional board UUID filter
   * @returns The card or null if not found
   */
  async findByIdIncludingDeleted(
    id: string,
    boardId?: string,
  ): Promise<Card | null> {
    return this.prisma.card.findFirst({
      where: {
        id,
        ...(boardId && { list: { boardId } }),
      },
    });
  }

  /**
   * Permanently marks a card as deleted by setting deletedAt timestamp.
   * Deleted cards are not retrievable or restorable.
   *
   * @param id - Card UUID
   * @returns The updated card with deletedAt set
   */
  async deletePermanently(id: string): Promise<Card> {
    return this.prisma.card.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Updates a card's priority stage.
   *
   * @param id - Card UUID
   * @param priority - New priority value
   * @returns The updated card
   */
  async updatePriority(id: string, priority: CardPriority): Promise<Card> {
    try {
      return await this.prisma.card.update({
        where: { id },
        data: { priority },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new EntityNotFoundException('Card', id);
      }
      throw error;
    }
  }

  /**
   * Updates a card's status and derived isComplete.
   *
   * @param id - Card UUID
   * @param status - New status value
   * @param isComplete - Derived completion flag
   * @returns The updated card
   * @throws {EntityNotFoundException} If the card does not exist
   */
  async updateStatus(
    id: string,
    status: CardStatus,
    isComplete: boolean,
  ): Promise<Card> {
    try {
      return await this.prisma.card.update({
        where: { id },
        data: { status, isComplete },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new EntityNotFoundException('Card', id);
      }
      throw error;
    }
  }

  /**
   * Finds active subcards of a parent card.
   *
   * @param parentId - Parent card UUID
   * @returns Array of active subcards ordered by rank
   */
  async findSubcards(parentId: string): Promise<Card[]> {
    return this.prisma.card.findMany({
      where: { parentCardId: parentId, archivedAt: null, deletedAt: null },
      orderBy: { rank: 'asc' },
    });
  }

  /**
   * Attaches an existing card as a subcard to a parent.
   *
   * @param childId - Child card UUID
   * @param parentId - Parent card UUID
   * @returns The updated child card
   */
  async attachSubcard(childId: string, parentId: string): Promise<Card> {
    return this.prisma.card.update({
      where: { id: childId },
      data: { parentCardId: parentId },
    });
  }

  /**
   * Detaches a subcard from its parent (sets parentCardId to null).
   *
   * @param childId - Child card UUID
   * @returns The updated child card
   */
  async detachSubcard(childId: string): Promise<Card> {
    return this.prisma.card.update({
      where: { id: childId },
      data: { parentCardId: null },
    });
  }

  /**
   * Counts active subcards of a parent.
   *
   * @param parentId - Parent card UUID
   * @returns Number of active subcards
   */
  async countSubcards(parentId: string): Promise<number> {
    return this.prisma.card.count({
      where: { parentCardId: parentId, archivedAt: null, deletedAt: null },
    });
  }
}
