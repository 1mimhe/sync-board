import { Injectable } from '@nestjs/common';
import { List, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import type { PaginatedResult } from '../../../../common/interfaces/pagination.interface';

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
   * Finds an active (non-archived, non-deleted) list by ID, optionally scoped to a board.
   *
   * @param id - List UUID
   * @param boardId - Optional board UUID filter
   * @returns The list or null if not found/archived/deleted
   */
  async findActiveById(id: string, boardId?: string): Promise<List | null> {
    return this.prisma.list.findFirst({
      where: {
        id,
        archivedAt: null,
        deletedAt: null,
        ...(boardId && { boardId }),
      },
    });
  }

  /**
   * Finds a list by ID including archived and deleted lists, optionally scoped to a board.
   *
   * @param id - List UUID
   * @param boardId - Optional board UUID filter
   * @returns The list or null if not found
   */
  async findByIdIncludingDeleted(
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
   * Alias for findByIdIncludingDeleted — kept for backward compatibility.
   *
   * @param id - List UUID
   * @param boardId - Optional board UUID filter
   * @returns The list or null if not found
   */
  async findByIdIncludingArchived(
    id: string,
    boardId?: string,
  ): Promise<List | null> {
    return this.findByIdIncludingDeleted(id, boardId);
  }

  /**
   * Finds the last active list in a board (highest rank) for rank calculation.
   *
   * @param boardId - Board UUID
   * @returns The last list or null if board has no lists
   */
  async findLastInBoard(boardId: string): Promise<List | null> {
    return this.prisma.list.findFirst({
      where: { boardId, archivedAt: null, deletedAt: null },
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
      where: { boardId, archivedAt: null, deletedAt: null },
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

  /**
   * Finds a cursor page of archived (non-deleted) lists in a board.
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
  ): Promise<PaginatedResult<List>> {
    const lists = await this.prisma.list.findMany({
      where: {
        boardId,
        archivedAt: { not: null },
        deletedAt: null,
      },
      orderBy: [{ archivedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = lists.length > limit;
    const items = hasMore ? lists.slice(0, limit) : lists;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      pagination: { cursor: nextCursor, hasMore },
    };
  }

  /**
   * Permanently marks a list as deleted by setting deletedAt timestamp.
   * Deleted lists are not retrievable or restorable.
   *
   * @param id - List UUID
   * @returns The updated list with deletedAt set
   */
  async deletePermanently(id: string): Promise<List> {
    return this.prisma.list.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
