import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ChecklistItem, Card } from '@prisma/client';
import { ChecklistRepository } from '../repositories/checklist.repository';
import { CardRepository } from '../../card/repositories/card.repository';
import { BoardRepository } from '../../core/repositories/board.repository';
import { LexorankService } from '../../lexorank/lexorank.service';
import { CardService } from '../../card/services/card.service';
import {
  CreateChecklistDto,
  UpdateChecklistDto,
  CreateChecklistItemDto,
  UpdateChecklistItemDto,
} from '../dto';
import {
  AppException,
  EntityNotFoundException,
} from '../../../../common/exceptions/app.exception';
import { assertBoardInWorkspace } from '../../utils/board-access.util';
import {
  ChecklistCreatedEvent,
  ChecklistUpdatedEvent,
  ChecklistDeletedEvent,
} from '../events/checklist.events';
import { CHECKLIST_EVENTS } from '../events/checklist-events.constants';
import type {
  ChecklistWithItems,
  ItemWithChecklist,
} from '../interfaces/checklist.interfaces';

/**
 * Service handling card checklist business logic (checklist CRUD and item management
 * with Lexorank ordering and WebSocket relay events).
 */
@Injectable()
export class ChecklistService {
  private readonly logger = new Logger(ChecklistService.name);

  constructor(
    private readonly checklistRepo: ChecklistRepository,
    private readonly cardRepo: CardRepository,
    private readonly boardRepo: BoardRepository,
    private readonly lexorank: LexorankService,
    private readonly cardService: CardService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Verifies that a board exists within the given workspace and is active.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @throws {EntityNotFoundException} If board is not found or archived
   */
  private async verifyBoardInWorkspace(
    boardId: string,
    workspaceId?: string,
  ): Promise<void> {
    await assertBoardInWorkspace(this.boardRepo, boardId, workspaceId);
  }

  /**
   * Verifies that a card exists within a board and is active.
   *
   * @param boardId - Board UUID
   * @param cardId - Card UUID
   * @throws {EntityNotFoundException} If card is not found or archived
   */
  private async verifyCardInBoard(
    boardId: string,
    cardId: string,
  ): Promise<void> {
    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }
  }

  /**
   * Fetches a checklist and verifies it belongs to the given card.
   *
   * @param checklistId - Checklist UUID
   * @param cardId - Expected parent card UUID
   * @returns The checklist with its ordered items
   * @throws {EntityNotFoundException} If checklist is missing or belongs to another card
   */
  private async getChecklistInCard(
    checklistId: string,
    cardId: string,
  ): Promise<ChecklistWithItems> {
    const checklist = await this.checklistRepo.findActiveChecklist(checklistId);
    if (!checklist || checklist.cardId !== cardId) {
      throw new EntityNotFoundException('CardChecklist', checklistId);
    }
    return checklist;
  }

  /**
   * Fetches a checklist item and verifies it belongs to the given checklist.
   *
   * @param itemId - Item UUID
   * @param checklistId - Expected parent checklist UUID
   * @returns The item with its parent checklist
   * @throws {EntityNotFoundException} If item is missing or belongs to another checklist
   */
  private async getItemInChecklist(
    itemId: string,
    checklistId: string,
  ): Promise<ItemWithChecklist> {
    const item = await this.checklistRepo.findItem(itemId);
    if (!item || item.checklistId !== checklistId) {
      throw new EntityNotFoundException('ChecklistItem', itemId);
    }
    return item;
  }

  /**
   * Emits `checklist.updated` after any progress/content change.
   */
  private emitUpdated(
    checklistId: string,
    cardId: string,
    boardId: string,
    userId: string,
  ): void {
    this.eventEmitter.emit(
      CHECKLIST_EVENTS.updated,
      new ChecklistUpdatedEvent(checklistId, cardId, boardId, userId),
    );
  }

  /**
   * Creates a checklist on a card, appended after existing checklists via Lexorank.
   *
   * @param workspaceId - Workspace UUID
   * @param boardId - Board UUID
   * @param cardId - Card UUID
   * @param dto - Checklist title data
   * @param userId - Creating user UUID
   * @returns The created checklist with empty items
   * @throws {EntityNotFoundException} If board or card is not found
   * @emits checklist.created - After successful creation
   */
  async createChecklist(
    workspaceId: string,
    boardId: string,
    cardId: string,
    dto: CreateChecklistDto,
    userId: string,
  ): Promise<ChecklistWithItems> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);
    await this.verifyCardInBoard(boardId, cardId);

    const existing = await this.checklistRepo.findChecklistsByCard(cardId);
    const last = existing[existing.length - 1];
    const rank = last
      ? this.lexorank.getRankBetween(last.rank, null)
      : this.lexorank.getInitialRank();

    const checklist = await this.checklistRepo.createChecklist({
      cardId,
      title: dto.title,
      rank,
    });

    this.eventEmitter.emit(
      CHECKLIST_EVENTS.created,
      new ChecklistCreatedEvent(checklist, boardId, userId),
    );

    this.logger.log('Checklist created', {
      checklistId: checklist.id,
      cardId,
      userId,
    });
    return checklist;
  }

  /**
   * Lists all checklists on a card with their items ordered by rank.
   *
   * @param workspaceId - Workspace UUID
   * @param boardId - Board UUID
   * @param cardId - Card UUID
   * @returns Array of checklists with ordered items
   * @throws {EntityNotFoundException} If board or card is not found
   */
  async getChecklists(
    workspaceId: string,
    boardId: string,
    cardId: string,
  ): Promise<ChecklistWithItems[]> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);
    await this.verifyCardInBoard(boardId, cardId);

    return this.checklistRepo.findChecklistsByCard(cardId);
  }

  /**
   * Renames a checklist belonging to the given card.
   *
   * @param workspaceId - Workspace UUID
   * @param boardId - Board UUID
   * @param cardId - Card UUID
   * @param checklistId - Checklist UUID
   * @param dto - New title data
   * @param userId - Modifying user UUID
   * @returns The updated checklist with ordered items
   * @throws {EntityNotFoundException} If checklist is missing or cross-board access attempted
   * @emits checklist.updated - After successful rename
   */
  async renameChecklist(
    workspaceId: string,
    boardId: string,
    cardId: string,
    checklistId: string,
    dto: UpdateChecklistDto,
    userId: string,
  ): Promise<ChecklistWithItems> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);
    await this.verifyCardInBoard(boardId, cardId);
    await this.getChecklistInCard(checklistId, cardId);

    const updated = await this.checklistRepo.updateChecklist(checklistId, {
      ...(dto.title !== undefined && { title: dto.title }),
    });

    this.emitUpdated(checklistId, cardId, boardId, userId);
    return updated;
  }

  /**
   * Deletes a checklist belonging to the given card (items cascade).
   *
   * @param workspaceId - Workspace UUID
   * @param boardId - Board UUID
   * @param cardId - Card UUID
   * @param checklistId - Checklist UUID
   * @param userId - Deleting user UUID
   * @throws {EntityNotFoundException} If checklist is missing or cross-board access attempted
   * @emits checklist.deleted - After successful deletion
   */
  async deleteChecklist(
    workspaceId: string,
    boardId: string,
    cardId: string,
    checklistId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);
    await this.verifyCardInBoard(boardId, cardId);
    await this.getChecklistInCard(checklistId, cardId);

    await this.checklistRepo.deleteChecklist(checklistId);

    this.eventEmitter.emit(
      CHECKLIST_EVENTS.deleted,
      new ChecklistDeletedEvent(checklistId, cardId, boardId, userId),
    );
  }

  /**
   * Adds an item to a checklist, appended after existing items via Lexorank.
   *
   * @param workspaceId - Workspace UUID
   * @param boardId - Board UUID
   * @param cardId - Card UUID
   * @param checklistId - Checklist UUID
   * @param dto - Item content data
   * @param userId - Adding user UUID
   * @returns The created item
   * @throws {EntityNotFoundException} If checklist is missing or cross-board access attempted
   * @emits checklist.updated - After successful creation (progress changed)
   */
  async addItem(
    workspaceId: string,
    boardId: string,
    cardId: string,
    checklistId: string,
    dto: CreateChecklistItemDto,
    userId: string,
  ): Promise<ChecklistItem> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);
    const checklist = await this.getChecklistInCard(checklistId, cardId);

    const last = checklist.items[checklist.items.length - 1];
    const rank = last
      ? this.lexorank.getRankBetween(last.rank, null)
      : this.lexorank.getInitialRank();

    const item = await this.checklistRepo.createItem({
      checklistId,
      content: dto.content,
      rank,
    });

    this.emitUpdated(checklistId, cardId, boardId, userId);
    return item;
  }

  /**
   * Updates a checklist item's content and/or completion state.
   *
   * @param workspaceId - Workspace UUID
   * @param boardId - Board UUID
   * @param cardId - Card UUID
   * @param checklistId - Checklist UUID
   * @param itemId - Item UUID
   * @param dto - Patch data
   * @param userId - Modifying user UUID
   * @returns The updated item
   * @throws {EntityNotFoundException} If item is missing or belongs to another checklist
   * @emits checklist.updated - After successful update
   */
  async updateItem(
    workspaceId: string,
    boardId: string,
    cardId: string,
    checklistId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
    userId: string,
  ): Promise<ChecklistItem> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);
    await this.verifyCardInBoard(boardId, cardId);
    await this.getItemInChecklist(itemId, checklistId);

    const updated = await this.checklistRepo.updateItem(itemId, {
      ...(dto.content !== undefined && { content: dto.content }),
      ...(dto.isDone !== undefined && { isDone: dto.isDone }),
    });

    this.emitUpdated(checklistId, cardId, boardId, userId);
    return updated;
  }

  /**
   * Removes an item from a checklist.
   *
   * @param workspaceId - Workspace UUID
   * @param boardId - Board UUID
   * @param cardId - Card UUID
   * @param checklistId - Checklist UUID
   * @param itemId - Item UUID
   * @param userId - Removing user UUID
   * @throws {EntityNotFoundException} If item is missing or belongs to another checklist
   * @emits checklist.updated - After successful removal (progress changed)
   */
  async removeItem(
    workspaceId: string,
    boardId: string,
    cardId: string,
    checklistId: string,
    itemId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);
    await this.verifyCardInBoard(boardId, cardId);
    await this.getItemInChecklist(itemId, checklistId);

    await this.checklistRepo.deleteItem(itemId);

    this.emitUpdated(checklistId, cardId, boardId, userId);
  }

  /**
   * Converts a checklist item into a subcard of the same card (copies content to title).
   *
   * Checklist items have no soft-delete column, so the source item is marked
   * done as the closest available archive semantic.
   *
   * @param workspaceId - Workspace UUID
   * @param boardId - Board UUID
   * @param cardId - Parent card UUID
   * @param checklistId - Checklist UUID scoping the item
   * @param itemId - Checklist item UUID
   * @param userId - Acting user UUID
   * @returns The created subcard
   * @throws {EntityNotFoundException} If board, card, or item is not found
   * @throws {AppException} If PROMOTE_FAILED (subcard created but item could not be marked done)
   * @emits card.subcard_created - Via CardService after successful creation
   */
  async promoteItemToSubcard(
    workspaceId: string,
    boardId: string,
    cardId: string,
    checklistId: string,
    itemId: string,
    userId: string,
  ): Promise<Card> {
    this.logger.debug('Promoting checklist item to subcard', {
      boardId,
      cardId,
      itemId,
      userId,
    });
    await this.verifyBoardInWorkspace(boardId, workspaceId);
    await this.verifyCardInBoard(boardId, cardId);
    const item = await this.getItemInChecklist(itemId, checklistId);

    const subcard = await this.cardService.createSubcard(
      boardId,
      workspaceId,
      cardId,
      {
        title: item.content,
      },
      userId,
    );

    try {
      await this.checklistRepo.updateItem(itemId, { isDone: true });
    } catch (error) {
      this.logger.error(
        'Failed to archive promoted checklist item',
        (error as Error).stack,
        { itemId, subcardId: subcard.id },
      );
      throw new AppException(
        'PROMOTE_FAILED',
        'Subcard was created but the source item could not be archived',
        500,
      );
    }

    this.emitUpdated(checklistId, cardId, boardId, userId);

    this.logger.log('Checklist item promoted to subcard', {
      itemId,
      subcardId: subcard.id,
      userId,
    });
    return subcard;
  }
}
