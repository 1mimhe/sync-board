import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Card, CardPriority, CardStatus } from '@prisma/client';
import { CardRepository } from '../repositories/card.repository';
import { BoardRepository } from '../../core/repositories/board.repository';
import { ListRepository } from '../../list/repositories/list.repository';
import { LabelRepository } from '../../label/repositories/label.repository';
import { LexorankService } from '../../lexorank/lexorank.service';
import { WorkspaceService } from '../../../workspace/services/workspace.service';
import {
  CreateCardDto,
  UpdateCardDto,
  MoveCardDto,
  UpdateCardPriorityDto,
  UpdateCardStatusDto,
} from '../dto';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../../common/exceptions/app.exception';
import { assertBoardInWorkspace } from '../../utils/board-access.util';
import {
  CardCreatedEvent,
  CardMovedEvent,
  CardUpdatedEvent,
  CardArchivedEvent,
  CardUnarchivedEvent,
  CardAssigneeAddedEvent,
  CardAssigneeRemovedEvent,
  CardDeletedEvent,
  CardPriorityChangedEvent,
  CardStatusChangedEvent,
  CardSubcardCreatedEvent,
} from '../events/card.events';
import { CARD_EVENTS } from '../events/card-events.constants';
import type { CardWithDetails } from '../../core/interfaces/board.interfaces';
import type { PaginatedResult } from '../../../../common/interfaces/pagination.interface';
import { CursorPaginationQueryDto } from '../../../../common/dto/cursor-pagination-query.dto';
import {
  isCompleteFromStatus,
  isStatusTransitionAllowed,
} from '../utils/card-status.util';

/**
 * Service encapsulating business logic for card operations, ordering, assignments, and labels.
 */
@Injectable()
export class CardService {
  private readonly logger = new Logger(CardService.name);

  constructor(
    private readonly cardRepo: CardRepository,
    private readonly boardRepo: BoardRepository,
    private readonly listRepo: ListRepository,
    private readonly labelRepo: LabelRepository,
    private readonly workspaceService: WorkspaceService,
    private readonly lexorank: LexorankService,
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
   * Validates that all candidate assignee IDs belong to the active workspace members.
   *
   * @param workspaceId - Workspace UUID
   * @param assigneeIds - Candidate assignee user UUIDs
   * @throws {BadRequestException} If any user is not a member of the workspace
   */
  private async validateAssignees(
    workspaceId: string,
    assigneeIds?: string[],
  ): Promise<void> {
    if (!assigneeIds || assigneeIds.length === 0) return;
    for (const userId of assigneeIds) {
      const isMember = await this.workspaceService.isUserMember(
        workspaceId,
        userId,
      );
      if (!isMember) {
        throw new BadRequestException(
          `User ${userId} is not a member of workspace ${workspaceId}`,
        );
      }
    }
  }

  /**
   * Validates that candidate label IDs are available within the workspace.
   *
   * @param workspaceId - Workspace UUID
   * @param labelIds - Candidate label UUIDs
   * @throws {BadRequestException} If any label does not exist or does not belong to the workspace
   */
  private async validateLabels(
    workspaceId: string,
    labelIds?: string[],
  ): Promise<void> {
    if (!labelIds || labelIds.length === 0) return;
    for (const labelId of labelIds) {
      const label = await this.labelRepo.findById(labelId);
      if (!label || label.workspaceId !== workspaceId) {
        throw new BadRequestException(
          `Label ${labelId} is not available in workspace ${workspaceId}`,
        );
      }
    }
  }

  /**
   * Creates a new card in a list with automatic LexoRank calculation, assignees, and labels.
   *
   * @param boardId - Target board UUID
   * @param workspaceId - Workspace UUID
   * @param listId - Target list UUID
   * @param dto - Card creation payload
   * @param userId - Creating user UUID
   * @returns The created card with full details
   * @throws {EntityNotFoundException} If list is not found
   * @throws {BadRequestException} If assignees or labels are invalid
   * @emits card.created - After successful creation
   */
  async create(
    boardId: string,
    workspaceId: string,
    listId: string,
    dto: CreateCardDto,
    userId: string,
  ): Promise<CardWithDetails> {
    this.logger.debug('Creating card', { boardId, listId, userId });
    const list = await this.listRepo.findActiveById(listId, boardId);
    if (!list) {
      throw new EntityNotFoundException('List', listId);
    }

    await this.validateAssignees(workspaceId, dto.assigneeIds);
    await this.validateLabels(workspaceId, dto.labelIds);

    let parentCardId: string | undefined;
    if (dto.parentCardId) {
      const parent = await this.cardRepo.findActiveById(
        dto.parentCardId,
        boardId,
      );
      if (!parent) {
        throw new EntityNotFoundException('Card', dto.parentCardId);
      }
      if (parent.parentCardId) {
        throw new BusinessRuleException(
          'MAX_DEPTH',
          'Cannot create subcard under a subcard (max depth 2)',
        );
      }
      parentCardId = parent.id;
    }

    const status = dto.status ?? 'not_started';
    const isComplete = isCompleteFromStatus(status);

    const lastCard = await this.cardRepo.findLastInList(listId);
    let rank: string;
    try {
      rank = lastCard
        ? this.lexorank.getRankBetween(lastCard.rank, null)
        : this.lexorank.getInitialRank();
    } catch {
      rank = this.lexorank.getInitialRank();
    }

    const card = await this.cardRepo.create(
      {
        listId,
        title: dto.title,
        description: dto.description,
        rank,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        coverImageUrl: dto.coverImageUrl ?? undefined,
        priority: dto.priority ?? undefined,
        status,
        isComplete,
        parentCardId,
        estimateMinutes: dto.estimateMinutes ?? undefined,
        createdBy: userId,
      },
      dto.assigneeIds,
      dto.labelIds,
    );

    this.eventEmitter.emit(
      CARD_EVENTS.created,
      new CardCreatedEvent(card, boardId, listId, userId),
    );

    this.logger.log('Card created', { cardId: card.id, listId, userId });
    return card;
  }

  /**
   * Retrieves card details with assignees, labels, and attachments.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @returns The card with full details
   * @throws {EntityNotFoundException} If board or card is not found
   */
  async getCardDetails(
    boardId: string,
    workspaceId: string,
    cardId: string,
  ): Promise<CardWithDetails> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }
    return card;
  }

  /**
   * Updates fields of an existing card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param dto - Card update payload
   * @param userId - Modifying user UUID
   * @returns The updated card
   * @throws {EntityNotFoundException} If board or card is not found
   * @emits card.updated - After successful update
   */
  async update(
    boardId: string,
    workspaceId: string,
    cardId: string,
    dto: UpdateCardDto,
    userId: string,
  ): Promise<Card> {
    this.logger.debug('Updating card', { boardId, cardId, userId });
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const existing = await this.cardRepo.findActiveById(cardId, boardId);
    if (!existing) {
      throw new EntityNotFoundException('Card', cardId);
    }

    let status = dto.status;
    let isComplete = dto.isComplete;
    if (status !== undefined) {
      isComplete = isCompleteFromStatus(status);
    } else if (isComplete !== undefined) {
      if (isComplete && existing.status !== 'closed') status = 'done';
      else if (!isComplete && existing.status !== 'not_started')
        status = 'active';
      else status = existing.status;
    }

    const updated = await this.cardRepo.update(cardId, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.dueDate !== undefined && {
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      }),
      ...(isComplete !== undefined && { isComplete }),
      ...(status !== undefined && { status }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.estimateMinutes !== undefined && {
        estimateMinutes: dto.estimateMinutes,
      }),
      ...(dto.coverImageUrl !== undefined && {
        coverImageUrl: dto.coverImageUrl,
      }),
    });

    this.eventEmitter.emit(
      CARD_EVENTS.updated,
      new CardUpdatedEvent(updated, boardId, userId),
    );

    this.logger.log('Card updated', { cardId, userId });
    return updated;
  }

  /**
   * Changes a card's named priority stage.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param dto - New priority stage
   * @param userId - Acting user UUID
   * @returns The updated card
   * @throws {EntityNotFoundException} If board or card is not found
   * @emits card.priority_changed - After successful change
   */
  async updatePriority(
    boardId: string,
    workspaceId: string,
    cardId: string,
    dto: UpdateCardPriorityDto,
    userId: string,
  ): Promise<Card> {
    this.logger.debug('Updating card priority', { boardId, cardId, userId });
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const existing = await this.cardRepo.findActiveById(cardId, boardId);
    if (!existing) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const from = existing.priority;
    const to = dto.priority;
    if (from === to) return existing;

    const updated = await this.cardRepo.updatePriority(cardId, to);

    this.eventEmitter.emit(
      CARD_EVENTS.priorityChanged,
      new CardPriorityChangedEvent(cardId, boardId, from, to, userId),
    );

    this.logger.log('Card priority changed', { cardId, from, to, userId });
    return updated;
  }

  /**
   * Moves a card through not_started -> active -> done -> closed.
   * Derives isComplete from status; emits `card.status_changed`.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param dto - New status
   * @param userId - Acting user UUID
   * @returns The updated card
   * @throws {EntityNotFoundException} If board or card is not found
   * @emits card.status_changed - After successful change
   */
  async updateStatus(
    boardId: string,
    workspaceId: string,
    cardId: string,
    dto: UpdateCardStatusDto,
    userId: string,
  ): Promise<Card> {
    this.logger.debug('Updating card status', { boardId, cardId, userId });
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const existing = await this.cardRepo.findActiveById(cardId, boardId);
    if (!existing) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const from = existing.status;
    const to = dto.status;
    if (!isStatusTransitionAllowed(from, to)) return existing;

    const isComplete = isCompleteFromStatus(to);
    const updated = await this.cardRepo.updateStatus(cardId, to, isComplete);

    this.eventEmitter.emit(
      CARD_EVENTS.statusChanged,
      new CardStatusChangedEvent(cardId, boardId, from, to, isComplete, userId),
    );

    this.logger.log('Card status changed', {
      cardId,
      from,
      to,
      isComplete,
      userId,
    });
    return updated;
  }

  /**
   * Creates a subcard under a parent on the same board (depth ≤ 2).
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param parentId - Parent card UUID (must be active, same board, depth 1)
   * @param dto - Subcard creation payload (parentCardId ignored, parent list used)
   * @param userId - Creating user UUID
   * @returns The created subcard with full details
   * @throws {EntityNotFoundException} If board or parent is not found
   * @throws {BusinessRuleException} If MAX_DEPTH is violated
   * @emits card.subcard_created - After successful creation
   */
  async createSubcard(
    boardId: string,
    workspaceId: string,
    parentId: string,
    dto: CreateCardDto,
    userId: string,
  ): Promise<CardWithDetails> {
    this.logger.debug('Creating subcard', { boardId, parentId, userId });
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const parent = await this.cardRepo.findActiveById(parentId, boardId);
    if (!parent) {
      throw new EntityNotFoundException('Card', parentId);
    }

    if (parent.parentCardId) {
      throw new BusinessRuleException(
        'MAX_DEPTH',
        'Cannot create subcard under a subcard (max depth 2)',
      );
    }

    await this.validateAssignees(workspaceId, dto.assigneeIds);
    await this.validateLabels(workspaceId, dto.labelIds);

    const status = dto.status ?? 'not_started';

    const lastCard = await this.cardRepo.findLastInList(parent.listId);
    let rank: string;
    try {
      rank = lastCard
        ? this.lexorank.getRankBetween(lastCard.rank, null)
        : this.lexorank.getInitialRank();
    } catch {
      rank = this.lexorank.getInitialRank();
    }

    const card = await this.cardRepo.create(
      {
        listId: parent.listId,
        title: dto.title,
        description: dto.description,
        rank,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        coverImageUrl: dto.coverImageUrl ?? undefined,
        priority: dto.priority ?? undefined,
        status,
        isComplete: isCompleteFromStatus(status),
        createdBy: userId,
        parentCardId: parentId,
        estimateMinutes: dto.estimateMinutes ?? undefined,
      },
      dto.assigneeIds,
      dto.labelIds,
    );

    this.eventEmitter.emit(
      CARD_EVENTS.subcardCreated,
      new CardSubcardCreatedEvent(parentId, card.id, boardId, userId),
    );

    this.logger.log('Subcard created', { cardId: card.id, parentId, userId });
    return card;
  }

  /**
   * Attaches an existing card as a subcard (same validations as creation).
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param parentId - Parent card UUID
   * @param subcardId - Child card UUID to attach
   * @param userId - Acting user UUID
   * @returns The attached child card
   * @throws {EntityNotFoundException} If board, parent, or child is not found
   * @throws {BusinessRuleException} If CYCLE, MAX_DEPTH, ALREADY_HAS_PARENT, or HAS_SUBCARDS is violated
   * @emits card.subcard_created - After successful attach
   */
  async attachSubcard(
    boardId: string,
    workspaceId: string,
    parentId: string,
    subcardId: string,
    userId: string,
  ): Promise<Card> {
    this.logger.debug('Attaching subcard', {
      boardId,
      parentId,
      subcardId,
      userId,
    });
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const parent = await this.cardRepo.findActiveById(parentId, boardId);
    if (!parent) {
      throw new EntityNotFoundException('Card', parentId);
    }
    if (parent.parentCardId) {
      throw new BusinessRuleException(
        'MAX_DEPTH',
        'Cannot attach subcard under a subcard (max depth 2)',
      );
    }

    const child = await this.cardRepo.findActiveById(subcardId, boardId);
    if (!child) {
      throw new EntityNotFoundException('Card', subcardId);
    }
    if (child.id === parentId) {
      throw new BusinessRuleException(
        'CYCLE',
        'A card cannot be its own parent',
      );
    }
    if (child.parentCardId) {
      throw new BusinessRuleException(
        'ALREADY_HAS_PARENT',
        'Card already has a parent',
      );
    }
    const subcardCount = await this.cardRepo.countSubcards(child.id);
    if (subcardCount > 0) {
      throw new BusinessRuleException(
        'HAS_SUBCARDS',
        'A card with subcards cannot become a subcard',
      );
    }

    const attached = await this.cardRepo.attachSubcard(subcardId, parentId);

    this.eventEmitter.emit(
      CARD_EVENTS.subcardCreated,
      new CardSubcardCreatedEvent(parentId, subcardId, boardId, userId),
    );

    this.logger.log('Subcard attached', { parentId, subcardId, userId });
    return attached;
  }

  /**
   * Detaches a subcard (parentCardId → null).
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param subcardId - Child card UUID
   * @param userId - Acting user UUID
   * @returns The detached card
   * @throws {EntityNotFoundException} If board or child is not found
   * @throws {BusinessRuleException} If NO_PARENT (card is not a subcard)
   * @emits card.updated - After successful detach
   */
  async detachSubcard(
    boardId: string,
    workspaceId: string,
    subcardId: string,
    userId: string,
  ): Promise<Card> {
    this.logger.debug('Detaching subcard', { boardId, subcardId, userId });
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const child = await this.cardRepo.findActiveById(subcardId, boardId);
    if (!child) {
      throw new EntityNotFoundException('Card', subcardId);
    }
    if (!child.parentCardId) {
      throw new BusinessRuleException('NO_PARENT', 'Card is not a subcard');
    }

    const detached = await this.cardRepo.detachSubcard(subcardId);

    this.eventEmitter.emit(
      CARD_EVENTS.updated,
      new CardUpdatedEvent(detached, boardId, userId),
    );

    this.logger.log('Subcard detached', { subcardId, userId });
    return detached;
  }

  /**
   * Returns a parent with active subcards plus a progress rollup.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Parent card UUID
   * @returns Parent details with subcards and rollup totals
   * @throws {EntityNotFoundException} If board or card is not found
   */
  async getWithSubcards(
    boardId: string,
    workspaceId: string,
    cardId: string,
  ): Promise<
    CardWithDetails & {
      subcards: Card[];
      subcardRollup: {
        total: number;
        done: number;
        estimateSum: number;
        loggedSum: number;
      };
    }
  > {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const parent = await this.cardRepo.findActiveById(cardId, boardId);
    if (!parent) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const subcards = await this.cardRepo.findSubcards(cardId);

    const rollup = {
      total: subcards.length,
      done: subcards.filter((c) => isCompleteFromStatus(c.status)).length,
      estimateSum: subcards.reduce(
        (sum, c) => sum + (c.estimateMinutes ?? 0),
        0,
      ),
      loggedSum: subcards.reduce((sum, c) => sum + c.loggedMinutes, 0),
    };

    return { ...parent, subcards, subcardRollup: rollup };
  }

  /**
   * Moves or reorders a card within a list or across lists on the same board.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param dto - Target list UUID and rank positioning strings
   * @param userId - Modifying user UUID
   * @returns The moved card with updated listId and rank
   * @throws {EntityNotFoundException} If board or card is not found
   * @throws {BadRequestException} If target list does not belong to board
   * @emits card.moved - After successful move
   */
  async move(
    boardId: string,
    workspaceId: string,
    cardId: string,
    dto: MoveCardDto,
    userId: string,
  ): Promise<Card> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const targetList = await this.listRepo.findActiveById(
      dto.targetListId,
      boardId,
    );
    if (!targetList) {
      throw new BadRequestException(
        `Target list ${dto.targetListId} does not belong to board ${boardId}`,
      );
    }

    const sourceListId = card.listId;
    let newRank: string;
    try {
      newRank = this.lexorank.getRankBetween(dto.prevRank, dto.nextRank);
    } catch {
      newRank = this.lexorank.getInitialRank();
    }

    const moved = await this.cardRepo.moveCard(
      cardId,
      dto.targetListId,
      newRank,
    );

    this.eventEmitter.emit(
      CARD_EVENTS.moved,
      new CardMovedEvent(
        cardId,
        boardId,
        sourceListId,
        dto.targetListId,
        newRank,
        userId,
      ),
    );

    return moved;
  }

  /**
   * Soft-deletes (archives) a card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param userId - User UUID who archived the card
   * @throws {EntityNotFoundException} If board or card is not found
   * @emits card.archived - After successful archiving
   */
  async archive(
    boardId: string,
    workspaceId: string,
    cardId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    await this.cardRepo.archive(cardId);

    this.eventEmitter.emit(
      CARD_EVENTS.archived,
      new CardArchivedEvent(cardId, boardId, card.listId, userId),
    );
  }

  /**
   * Restores an archived card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param userId - User UUID who restored the card
   * @returns The restored card
   * @throws {EntityNotFoundException} If board or card is not found
   * @emits card.unarchived - After successful restoration
   */
  async unarchive(
    boardId: string,
    workspaceId: string,
    cardId: string,
    userId: string,
  ): Promise<Card> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findByIdIncludingArchived(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const restored = await this.cardRepo.unarchive(cardId);

    this.eventEmitter.emit(
      CARD_EVENTS.unarchived,
      new CardUnarchivedEvent(restored, boardId, restored.listId, userId),
    );

    this.logger.log('Card unarchived', { cardId, userId });
    return restored;
  }

  /**
   * Retrieves a cursor page of archived (non-deleted) cards in a board.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param query - Cursor and limit parameters
   * @returns PaginatedResult with items and pagination
   * @throws {EntityNotFoundException} If board is not found
   */
  async listArchivedCardsPaginated(
    boardId: string,
    workspaceId: string,
    query: CursorPaginationQueryDto = {},
  ): Promise<PaginatedResult<CardWithDetails>> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }
    const limit = query.limit ?? 20;
    const result = await this.cardRepo.findArchivedByBoardIdPage(
      boardId,
      query.cursor,
      limit,
    );
    return result;
  }

  /**
   * Permanently deletes a card (sets deletedAt). Can be called directly
   * on active cards or on archived cards. Deleted cards are not retrievable
   * or restorable.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param userId - User UUID who deleted the card
   * @throws {EntityNotFoundException} If board or card is not found
   * @throws {BusinessRuleException} If card is already deleted
   * @emits card.deleted - After successful deletion
   */
  async deletePermanently(
    boardId: string,
    workspaceId: string,
    cardId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findByIdIncludingDeleted(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    if (card.deletedAt) {
      throw new BusinessRuleException(
        'CARD_ALREADY_DELETED',
        'Card is already deleted',
      );
    }

    const listId = card.listId;

    await this.cardRepo.deletePermanently(cardId);

    this.eventEmitter.emit(
      CARD_EVENTS.deleted,
      new CardDeletedEvent(cardId, boardId, listId, userId),
    );

    this.logger.log('Card permanently deleted', { cardId, userId });
  }

  /**
   * Assigns a user to a card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param assigneeUserId - Target user UUID to assign
   * @param addedBy - UUID of the acting user
   * @throws {EntityNotFoundException} If card is not found
   * @throws {BadRequestException} If assigned user is not a member of the workspace
   */
  async addAssignee(
    boardId: string,
    workspaceId: string,
    cardId: string,
    assigneeUserId: string,
    addedBy: string,
  ): Promise<void> {
    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const isMember = await this.workspaceService.isUserMember(
      workspaceId,
      assigneeUserId,
    );
    if (!isMember) {
      throw new BadRequestException(
        `User ${assigneeUserId} is not a member of workspace ${workspaceId}`,
      );
    }

    await this.cardRepo.addAssignee(cardId, assigneeUserId);

    this.eventEmitter.emit(
      CARD_EVENTS.assigneeAdded,
      new CardAssigneeAddedEvent(cardId, boardId, assigneeUserId, addedBy),
    );
  }

  /**
   * Removes an assigned user from a card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param assigneeUserId - User UUID to remove from card
   * @param removedBy - UUID of the acting user
   * @throws {EntityNotFoundException} If board or card is not found
   */
  async removeAssignee(
    boardId: string,
    workspaceId: string,
    cardId: string,
    assigneeUserId: string,
    removedBy: string,
  ): Promise<void> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    await this.cardRepo.removeAssignee(cardId, assigneeUserId);

    this.eventEmitter.emit(
      CARD_EVENTS.assigneeRemoved,
      new CardAssigneeRemovedEvent(cardId, boardId, assigneeUserId, removedBy),
    );
  }

  /**
   * Attaches a board label to a card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param labelId - Label UUID to attach
   * @throws {EntityNotFoundException} If card is not found
   * @throws {BadRequestException} If label is not available for this board
   */
  async addLabel(
    boardId: string,
    workspaceId: string,
    cardId: string,
    labelId: string,
  ): Promise<void> {
    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const label = await this.labelRepo.findById(labelId);
    if (!label || label.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `Label ${labelId} is not available in workspace ${workspaceId}`,
      );
    }

    await this.cardRepo.addLabel(cardId, labelId);
  }

  /**
   * Detaches a label from a card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param labelId - Label UUID to detach
   * @throws {EntityNotFoundException} If board or card is not found
   */
  async removeLabel(
    boardId: string,
    workspaceId: string,
    cardId: string,
    labelId: string,
  ): Promise<void> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    await this.cardRepo.removeLabel(cardId, labelId);
  }

  /**
   * Returns a card title for notification/activity rendering without leaking relations.
   *
   * @param cardId - Card UUID
   * @returns Title string, or null when the card is missing/archived/deleted
   */
  async findTitleById(cardId: string): Promise<string | null> {
    const card = await this.cardRepo.findActiveById(cardId);
    return card?.title ?? null;
  }

  /**
   * Lists assignee userIds for fan-out (comment notifications).
   *
   * @param cardId - Card UUID
   * @returns Active assignee user UUIDs (empty when card missing)
   */
  async findAssigneeIdsByCardId(cardId: string): Promise<string[]> {
    const card = await this.cardRepo.findActiveById(cardId);
    return (card?.assignees ?? [])
      .map((a) => a.user?.id)
      .filter((id): id is string => Boolean(id));
  }
}
