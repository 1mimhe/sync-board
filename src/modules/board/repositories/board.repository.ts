import { Injectable } from '@nestjs/common';
import { Board, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import type {
  BoardContentQuery,
  BoardWithFullContent,
} from '../interfaces/board.interfaces';

/**
 * Repository handling database access for boards, board memberships/stars, and nested board content.
 */
@Injectable()
export class BoardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new board record in the database.
   *
   * @param data - Board creation payload
   * @returns The created board
   */
  async create(data: Prisma.BoardUncheckedCreateInput): Promise<Board> {
    return this.prisma.board.create({ data });
  }

  /**
   * Finds an active (non-archived) board by ID, optionally scoped to a workspace.
   *
   * @param id - Board UUID
   * @param workspaceId - Optional workspace UUID filter
   * @returns The board or null if not found/archived
   */
  async findById(id: string, workspaceId?: string): Promise<Board | null> {
    return this.prisma.board.findFirst({
      where: {
        id,
        archivedAt: null,
        ...(workspaceId && { workspaceId }),
      },
    });
  }

  /**
   * Finds a board by ID including archived boards, optionally scoped to a workspace.
   *
   * @param id - Board UUID
   * @param workspaceId - Optional workspace UUID filter
   * @returns The board or null if not found
   */
  async findByIdIncludingArchived(
    id: string,
    workspaceId?: string,
  ): Promise<Board | null> {
    return this.prisma.board.findFirst({
      where: {
        id,
        ...(workspaceId && { workspaceId }),
      },
    });
  }

  /**
   * Finds a board by ID with its nested relational structure (lists, cards, assignees, labels, attachments, starred status).
   *
   * @param id - Board UUID
   * @param userId - Requesting user UUID for calculating starred status
   * @param query - Pagination settings for lists and cards
   * @param workspaceId - Optional workspace UUID filter
   * @returns The board with full nested content, or null if not found
   */
  async findByIdWithContent(
    id: string,
    userId: string,
    query: BoardContentQuery = {},
    workspaceId?: string,
  ): Promise<BoardWithFullContent | null> {
    const board = await this.prisma.board.findFirst({
      where: {
        id,
        archivedAt: null,
        ...(workspaceId && { workspaceId }),
      },
      include: {
        labels: true,
        lists: {
          where: { archivedAt: null },
          orderBy: { rank: 'asc' },
          skip: query.listSkip ?? 0,
          take: query.listTake,
          include: {
            _count: {
              select: { cards: { where: { archivedAt: null } } },
            },
            cards: {
              where: { archivedAt: null },
              orderBy: { rank: 'asc' },
              skip: query.cardSkip ?? 0,
              take: query.cardTake,
              include: {
                assignees: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        displayName: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
                labels: {
                  include: {
                    label: true,
                  },
                },
                attachments: {
                  where: { archivedAt: null },
                  include: {
                    uploadedBy: {
                      select: {
                        id: true,
                        displayName: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        starredBy: {
          where: { userId },
        },
      },
    });

    if (!board) {
      return null;
    }

    const { starredBy, ...rest } = board;
    return {
      ...rest,
      isStarred: starredBy.length > 0,
      lists: board.lists.map(({ _count, ...list }) => ({
        ...list,
        cardCount: _count.cards,
      })),
    } as unknown as BoardWithFullContent;
  }

  /**
   * Counts active (non-archived) lists belonging to a board.
   *
   * @param boardId - Board UUID
   * @returns Total active lists count
   */
  async countLists(boardId: string): Promise<number> {
    return this.prisma.list.count({
      where: { boardId, archivedAt: null },
    });
  }

  /**
   * Counts active (non-archived) cards across all lists in a board.
   *
   * @param boardId - Board UUID
   * @returns Total active cards count
   */
  async countCards(boardId: string): Promise<number> {
    return this.prisma.card.count({
      where: { list: { boardId }, archivedAt: null },
    });
  }

  /**
   * Finds all active boards within a workspace.
   *
   * @param workspaceId - Workspace UUID
   * @param userId - Current user UUID for starred status queries
   * @returns List of active boards
   */
  async findWorkspaceBoards(
    workspaceId: string,
    userId: string,
  ): Promise<Board[]> {
    return this.prisma.board.findMany({
      where: { workspaceId, archivedAt: null },
      include: {
        starredBy: {
          where: { userId },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Updates an existing board's fields.
   *
   * @param id - Board UUID
   * @param data - Update payload
   * @returns The updated board
   */
  async update(id: string, data: Prisma.BoardUpdateInput): Promise<Board> {
    return this.prisma.board.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft-deletes a board by setting `archivedAt` timestamp.
   *
   * @param id - Board UUID
   * @returns The archived board
   */
  async archive(id: string): Promise<Board> {
    return this.prisma.board.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  /**
   * Restores an archived board by setting `archivedAt` to null.
   *
   * @param id - Board UUID
   * @returns The restored board
   */
  async unarchive(id: string): Promise<Board> {
    return this.prisma.board.update({
      where: { id },
      data: { archivedAt: null },
    });
  }

  /**
   * Adds a star on a board for a user.
   *
   * @param userId - User UUID
   * @param boardId - Board UUID
   */
  async starBoard(userId: string, boardId: string): Promise<void> {
    await this.prisma.userStarredBoard.upsert({
      where: { userId_boardId: { userId, boardId } },
      create: { userId, boardId },
      update: {},
    });
  }

  /**
   * Removes a star on a board for a user.
   *
   * @param userId - User UUID
   * @param boardId - Board UUID
   */
  async unstarBoard(userId: string, boardId: string): Promise<void> {
    await this.prisma.userStarredBoard.deleteMany({
      where: { userId, boardId },
    });
  }

  /**
   * Checks if a board is starred by a user.
   *
   * @param userId - User UUID
   * @param boardId - Board UUID
   * @returns True if starred, false otherwise
   */
  async isStarredByUser(userId: string, boardId: string): Promise<boolean> {
    const star = await this.prisma.userStarredBoard.findUnique({
      where: { userId_boardId: { userId, boardId } },
    });
    return !!star;
  }
}
