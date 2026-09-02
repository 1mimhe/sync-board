import { Injectable } from '@nestjs/common';
import { Card, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import type { CardWithDetails } from '../../board/interfaces/board.interfaces';
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
   * Finds all archived (non-deleted) cards in a board.
   *
   * @param boardId - Board UUID
   * @returns Array of archived cards with details
   */
  async findArchivedByBoardId(boardId: string): Promise<CardWithDetails[]> {
    return this.prisma.card.findMany({
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
      orderBy: { archivedAt: 'desc' },
    }) as unknown as Promise<CardWithDetails[]>;
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
    const cards = await this.prisma.card.findMany({
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
    }) as unknown as CardWithDetails[];

    const hasMore = cards.length > limit;
    const items = hasMore ? cards.slice(0, limit) : cards;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      pagination: { cursor: nextCursor, hasMore },
    };
  }

  /**
   * Finds all archived (non-deleted) cards across a workspace.
   *
   * @param workspaceId - Workspace UUID
   * @returns Array of archived cards with details
   */
  async findArchivedByWorkspaceId(workspaceId: string): Promise<CardWithDetails[]> {
    return this.prisma.card.findMany({
      where: {
        archivedAt: { not: null },
        deletedAt: null,
        list: { board: { workspaceId } },
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
      orderBy: { archivedAt: 'desc' },
    }) as unknown as Promise<CardWithDetails[]>;
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
}
