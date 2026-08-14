import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { List } from '@prisma/client';
import { ListRepository } from '../repositories/list.repository';
import { BoardRepository } from '../repositories/board.repository';
import { LexorankService } from './lexorank.service';
import { CreateListDto } from '../dto/create-list.dto';
import { UpdateListDto } from '../dto/update-list.dto';
import { MoveListDto } from '../dto/move-list.dto';
import { EntityNotFoundException } from '../../../common/exceptions/app.exception';
import {
  ListCreatedEvent,
  ListUpdatedEvent,
  ListMovedEvent,
  ListArchivedEvent,
  ListUnarchivedEvent,
} from '../events/board.events';
import { LIST_EVENTS } from '../events/board-events.constants';

/**
 * Service handling business logic for board lists (creation, renaming, LexoRank reordering, archiving).
 */
@Injectable()
export class ListService {
  private readonly logger = new Logger(ListService.name);

  constructor(
    private readonly listRepo: ListRepository,
    private readonly boardRepo: BoardRepository,
    private readonly lexorank: LexorankService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Verifies that a board exists within the given workspace and is active.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Optional workspace UUID
   * @throws {EntityNotFoundException} If board is not found or archived
   */
  private async verifyBoardInWorkspace(
    boardId: string,
    workspaceId?: string,
  ): Promise<void> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }
  }

  /**
   * Creates a new list at the end of a board with automatic LexoRank calculation.
   *
   * @param boardId - Target board UUID
   * @param workspaceId - Workspace UUID
   * @param dto - List creation data
   * @param userId - Creating user UUID
   * @returns The created list
   * @throws {EntityNotFoundException} If board is not found
   * @emits list.created - After successful creation
   */
  async create(
    boardId: string,
    workspaceId: string,
    dto: CreateListDto,
    userId: string,
  ): Promise<List> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const lastList = await this.listRepo.findLastInBoard(boardId);
    const rank = lastList
      ? this.lexorank.getRankBetween(lastList.rank, null)
      : this.lexorank.getInitialRank();

    const list = await this.listRepo.create({
      boardId,
      title: dto.title,
      rank,
    });

    this.eventEmitter.emit(
      LIST_EVENTS.created,
      new ListCreatedEvent(list, userId),
    );

    this.logger.log(`List created: ${list.id} in board ${boardId}`);
    return list;
  }

  /**
   * Updates an existing list's title.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param listId - List UUID
   * @param dto - Update data
   * @param userId - Modifying user UUID
   * @returns The updated list
   * @throws {EntityNotFoundException} If board or list is not found
   * @emits list.updated - After successful update
   */
  async update(
    boardId: string,
    workspaceId: string,
    listId: string,
    dto: UpdateListDto,
    userId: string,
  ): Promise<List> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const list = await this.listRepo.findActiveById(listId, boardId);
    if (!list) {
      throw new EntityNotFoundException('List', listId);
    }

    const updated = await this.listRepo.update(listId, {
      ...(dto.title !== undefined && { title: dto.title }),
    });

    this.eventEmitter.emit(
      LIST_EVENTS.updated,
      new ListUpdatedEvent(updated, userId),
    );

    return updated;
  }

  /**
   * Reorders a list using LexoRank calculated between adjacent lists.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param listId - List UUID to move
   * @param dto - Previous and next rank strings
   * @param userId - Modifying user UUID
   * @returns The moved list with new rank
   * @throws {EntityNotFoundException} If board or list is not found
   * @emits list.moved - After successful move
   */
  async move(
    boardId: string,
    workspaceId: string,
    listId: string,
    dto: MoveListDto,
    userId: string,
  ): Promise<List> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const list = await this.listRepo.findActiveById(listId, boardId);
    if (!list) {
      throw new EntityNotFoundException('List', listId);
    }

    const newRank = this.lexorank.getRankBetween(dto.prevRank, dto.nextRank);
    const updated = await this.listRepo.update(listId, { rank: newRank });

    this.eventEmitter.emit(
      LIST_EVENTS.moved,
      new ListMovedEvent(listId, boardId, newRank, userId),
    );

    return updated;
  }

  /**
   * Soft-deletes (archives) a list.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param listId - List UUID to archive
   * @param userId - User UUID who archived the list
   * @throws {EntityNotFoundException} If board or list is not found
   * @emits list.archived - After successful archiving
   */
  async archive(
    boardId: string,
    workspaceId: string,
    listId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const list = await this.listRepo.findActiveById(listId, boardId);
    if (!list) {
      throw new EntityNotFoundException('List', listId);
    }

    await this.listRepo.archive(listId);

    this.eventEmitter.emit(
      LIST_EVENTS.archived,
      new ListArchivedEvent(listId, boardId, userId),
    );

    this.logger.log(`List archived: ${listId} by user ${userId}`);
  }

  /**
   * Restores an archived list.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param listId - List UUID to restore
   * @param userId - User UUID who restored the list
   * @returns The restored list
   * @throws {EntityNotFoundException} If board or list is not found
   * @emits list.unarchived - After successful restoration
   */
  async unarchive(
    boardId: string,
    workspaceId: string,
    listId: string,
    userId: string,
  ): Promise<List> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const list = await this.listRepo.findByIdIncludingArchived(listId, boardId);
    if (!list) {
      throw new EntityNotFoundException('List', listId);
    }

    const restored = await this.listRepo.unarchive(listId);

    this.eventEmitter.emit(
      LIST_EVENTS.unarchived,
      new ListUnarchivedEvent(restored, userId),
    );

    this.logger.log(`List unarchived: ${listId} by user ${userId}`);
    return restored;
  }
}
