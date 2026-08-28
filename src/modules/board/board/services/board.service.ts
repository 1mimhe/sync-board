import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Board } from '@prisma/client';
import { BoardRepository } from '../repositories/board.repository';
import { LabelRepository } from '../../label/repositories/label.repository';
import { ActivityRepository } from '../../../activity/repositories/activity.repository';
import {
  CreateBoardDto,
  UpdateBoardDto,
  BoardContentQueryDto,
  CursorPaginationQueryDto,
} from '../dto';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';
import { buildCursorPagination } from '../../../../common/utils/pagination.util';
import type { PaginatedResult } from '../../../../common/interfaces/pagination.interface';
import {
  BoardCreatedEvent,
  BoardUpdatedEvent,
  BoardArchivedEvent,
  BoardUnarchivedEvent,
} from '../events/board.events';
import { BOARD_EVENTS } from '../events/board-events.constants';
import type {
  ActivityWithAuthor,
  BoardWithFullContent,
} from '../interfaces/board.interfaces';

/**
 * Service encapsulating business logic for boards, labels, stars, and board activity history.
 */
@Injectable()
export class BoardService {
  private readonly logger = new Logger(BoardService.name);

  constructor(
    private readonly boardRepo: BoardRepository,
    @Inject(forwardRef(() => LabelRepository))
    private readonly labelRepo: LabelRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new board in a workspace and emits `board.created` event.
   *
   * @param workspaceId - Target workspace UUID
   * @param dto - Board creation data
   * @param userId - Creating user UUID
   * @returns The newly created board
   * @emits board.created - After successful creation
   */
  async create(
    workspaceId: string,
    dto: CreateBoardDto,
    userId: string,
  ): Promise<Board> {
    this.logger.debug(
      `Creating board "${dto.title}" in workspace ${workspaceId}`,
      {
        workspaceId,
        userId,
      },
    );

    const board = await this.boardRepo.create({
      workspaceId,
      title: dto.title,
      description: dto.description,
      backgroundColor: dto.backgroundColor ?? '#1A1A2E',
      createdBy: userId,
    });

    this.eventEmitter.emit(
      BOARD_EVENTS.created,
      new BoardCreatedEvent(board, userId),
    );

    this.logger.log(`Board created: ${board.id} in workspace ${workspaceId}`);
    return board;
  }

  /**
   * Retrieves a board with nested lists, cards, available labels, and pagination metadata.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param userId - Requesting user UUID
   * @param query - Optional list and card pagination options
   * @returns Board with nested relations and pagination metadata
   * @throws {EntityNotFoundException} If board does not exist or is archived
   */
  async getBoardWithContent(
    boardId: string,
    workspaceId: string,
    userId: string,
    query: BoardContentQueryDto = {},
  ): Promise<BoardWithFullContent> {
    const listPage = query.listPage ?? 1;
    const listPageSize = query.listPageSize ?? 50;
    const cardPageSize = query.cardPageSize ?? 50;

    const board = await this.boardRepo.findByIdWithContent(
      boardId,
      userId,
      {
        listSkip: (listPage - 1) * listPageSize,
        listTake: listPageSize,
        cardSkip: 0,
        cardTake: cardPageSize,
      },
      workspaceId,
    );
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    const [totalLists, totalCards, availableLabels] = await Promise.all([
      this.boardRepo.countLists(boardId),
      this.boardRepo.countCards(boardId),
      this.labelRepo.findAvailableLabels(workspaceId, boardId),
    ]);

    return {
      ...board,
      labels: availableLabels,
      pagination: {
        listPage,
        listPageSize,
        totalLists,
        totalPages: Math.max(1, Math.ceil(totalLists / listPageSize)),
        cardPageSize,
        totalCards,
      },
    };
  }

  /**
   * Lists active boards within a workspace for the requesting user,
   * using cursor-based pagination (newest first).
   *
   * @param workspaceId - Workspace UUID
   * @param userId - Requesting user UUID
   * @param query - Cursor and limit parameters
   * @returns PaginatedResult with `items` and `pagination.cursor/hasMore`
   */
  async listWorkspaceBoards(
    workspaceId: string,
    userId: string,
    query: CursorPaginationQueryDto = {},
  ): Promise<PaginatedResult<Board>> {
    const limit = query.limit ?? 20;
    const rows = await this.boardRepo.findWorkspaceBoardsPage(
      workspaceId,
      userId,
      query.cursor,
      limit,
    );
    return buildCursorPagination(rows, limit);
  }

  /**
   * Updates an existing board's metadata and emits `board.updated` event.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param dto - Update data
   * @param userId - Modifying user UUID
   * @returns The updated board
   * @throws {EntityNotFoundException} If board is not found
   * @emits board.updated - After successful update
   */
  async update(
    boardId: string,
    workspaceId: string,
    dto: UpdateBoardDto,
    userId: string,
  ): Promise<Board> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    const updated = await this.boardRepo.update(boardId, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.backgroundColor !== undefined && {
        backgroundColor: dto.backgroundColor,
      }),
    });

    this.eventEmitter.emit(
      BOARD_EVENTS.updated,
      new BoardUpdatedEvent(updated, userId),
    );

    return updated;
  }

  /**
   * Soft-deletes (archives) a board and emits `board.archived` event.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param userId - User UUID who archived the board
   * @throws {EntityNotFoundException} If board is not found
   * @emits board.archived - After successful archiving
   */
  async archive(
    boardId: string,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    await this.boardRepo.archive(boardId);

    this.eventEmitter.emit(
      BOARD_EVENTS.archived,
      new BoardArchivedEvent(boardId, workspaceId, userId),
    );

    this.logger.log(`Board archived: ${boardId} by user ${userId}`);
  }

  /**
   * Restores an archived board and emits `board.unarchived` event.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param userId - User UUID who restored the board
   * @returns The restored board
   * @throws {EntityNotFoundException} If board is not found
   * @emits board.unarchived - After successful restoration
   */
  async unarchive(
    boardId: string,
    workspaceId: string,
    userId: string,
  ): Promise<Board> {
    const board = await this.boardRepo.findByIdIncludingArchived(
      boardId,
      workspaceId,
    );
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    const restored = await this.boardRepo.unarchive(boardId);

    this.eventEmitter.emit(
      BOARD_EVENTS.unarchived,
      new BoardUnarchivedEvent(restored, userId),
    );

    this.logger.log(`Board unarchived: ${boardId} by user ${userId}`);
    return restored;
  }

  /**
   * Stars a board for the requesting user.
   *
   * @param userId - User UUID
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @throws {EntityNotFoundException} If board is not found
   */
  async starBoard(
    userId: string,
    boardId: string,
    workspaceId: string,
  ): Promise<void> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    await this.boardRepo.starBoard(userId, boardId);
  }

  /**
   * Removes a star from a board for the requesting user.
   *
   * @param userId - User UUID
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @throws {EntityNotFoundException} If board is not found
   */
  async unstarBoard(
    userId: string,
    boardId: string,
    workspaceId: string,
  ): Promise<void> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    await this.boardRepo.unstarBoard(userId, boardId);
  }

  // ============================================================
  // ACTIVITY LOG
  // ============================================================

  /**
   * Retrieves a cursor page of activities (audit log) for a board.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param query - Cursor and limit parameters
   * @returns PaginatedResult with `items` and `pagination.cursor/hasMore`
   * @throws {EntityNotFoundException} If board is not found
   */
  async getBoardActivities(
    boardId: string,
    workspaceId: string,
    query: CursorPaginationQueryDto = {},
  ): Promise<PaginatedResult<ActivityWithAuthor>> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }
    const limit = query.limit ?? 20;
    const rows = await this.activityRepo.findByBoardIdPage(
      boardId,
      query.cursor,
      limit,
    );
    return buildCursorPagination(rows, limit);
  }
}
