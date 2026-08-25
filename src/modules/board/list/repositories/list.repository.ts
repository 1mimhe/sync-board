import { Injectable } from '@nestjs/common';
import { List, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';

/**
 * Repository handling database operations for board lists.
 */
@Injectable()
export class ListRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new list record in the database.
   *
   * @param data - List creation payload
   * @returns The created list
   */
  async create(data: Prisma.ListUncheckedCreateInput): Promise<List> {
    return this.prisma.list.create({ data });
  }

  /**
   * Finds an active (non-archived) list by ID, optionally scoped to a board.
   *
   * @param id - List UUID
   * @param boardId - Optional board UUID filter
   * @returns The list or null if not found/archived
   */
  async findActiveById(id: string, boardId?: string): Promise<List | null> {
    return this.prisma.list.findFirst({
      where: {
        id,
        archivedAt: null,
        ...(boardId && { boardId }),
      },
    });
  }

  /**
   * Finds a list by ID including archived lists, optionally scoped to a board.
   *
   * @param id - List UUID
   * @param boardId - Optional board UUID filter
   * @returns The list or null if not found
   */
  async findByIdIncludingArchived(
    id: string,
    boardId?: string,
  ): Promise<List | null> {
    return this.prisma.list.findFirst({
      where: {
        id,
        ...(boardId && { boardId }),
      },
    });
  }

  /**
   * Finds the last active list in a board (highest rank) for rank calculation.
   *
   * @param boardId - Board UUID
   * @returns The last list or null if board has no lists
   */
  async findLastInBoard(boardId: string): Promise<List | null> {
    return this.prisma.list.findFirst({
      where: { boardId, archivedAt: null },
      orderBy: { rank: 'desc' },
    });
  }

  /**
   * Finds all active lists belonging to a board ordered by rank.
   *
   * @param boardId - Board UUID
   * @returns Array of active lists
   */
  async findBoardLists(boardId: string): Promise<List[]> {
    return this.prisma.list.findMany({
      where: { boardId, archivedAt: null },
      orderBy: { rank: 'asc' },
    });
  }

  /**
   * Updates fields of an existing list.
   *
   * @param id - List UUID
   * @param data - Update payload
   * @returns The updated list
   */
  async update(id: string, data: Prisma.ListUpdateInput): Promise<List> {
    return this.prisma.list.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft-deletes a list by setting `archivedAt` timestamp.
   *
   * @param id - List UUID
   * @returns The archived list
   */
  async archive(id: string): Promise<List> {
    return this.prisma.list.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  /**
   * Restores an archived list by clearing `archivedAt`.
   *
   * @param id - List UUID
   * @returns The restored list
   */
  async unarchive(id: string): Promise<List> {
    return this.prisma.list.update({
      where: { id },
      data: { archivedAt: null },
    });
  }
}
