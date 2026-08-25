import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Card } from '@prisma/client';
import { CardRepository } from '../repositories/card.repository';
import { BoardRepository } from '../../board/repositories/board.repository';
import { ListRepository } from '../../list/repositories/list.repository';
import { LabelRepository } from '../../label/repositories/label.repository';
import { LexorankService } from '../../lexorank/services/lexorank.service';
import { WorkspaceService } from '../../../workspace/services/workspace.service';
import { CreateCardDto, UpdateCardDto, MoveCardDto } from '../dto';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';
import {
  CardCreatedEvent,
  CardMovedEvent,
  CardUpdatedEvent,
  CardArchivedEvent,
  CardUnarchivedEvent,
} from '../events/card.events';
import { CARD_EVENTS } from '../events/card-events.constants';
import type { CardWithDetails } from '../../board/interfaces/board.interfaces';

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
    workspaceId: string,
  ): Promise<void> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }
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
   * Validates that candidate label IDs are available for the target board within the workspace.
   *
   * @param workspaceId - Workspace UUID
   * @param boardId - Board UUID
   * @param labelIds - Candidate label UUIDs
   * @throws {BadRequestException} If any label does not exist or does not belong to the board/workspace
   */
  private async validateLabels(
    workspaceId: string,
    boardId: string,
    labelIds?: string[],
  ): Promise<void> {
    if (!labelIds || labelIds.length === 0) return;
    for (const labelId of labelIds) {
      const label = await this.labelRepo.findById(labelId);
      if (
        !label ||
        label.workspaceId !== workspaceId ||
        (label.boardId !== null && label.boardId !== boardId)
      ) {
        throw new BadRequestException(
          `Label ${labelId} is not available for board ${boardId}`,
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
    const list = await this.listRepo.findActiveById(listId, boardId);
    if (!list) {
      throw new EntityNotFoundException('List', listId);
    }

    await this.validateAssignees(workspaceId, dto.assigneeIds);
    await this.validateLabels(workspaceId, boardId, dto.labelIds);

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
        createdBy: userId,
      },
      dto.assigneeIds,
      dto.labelIds,
    );

    this.eventEmitter.emit(
      CARD_EVENTS.created,
      new CardCreatedEvent(card, boardId, listId, userId),
    );

    this.logger.log(`Card created: ${card.id} in list ${listId}`);
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
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const existing = await this.cardRepo.findActiveById(cardId, boardId);
    if (!existing) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const updated = await this.cardRepo.update(cardId, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.dueDate !== undefined && {
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      }),
      ...(dto.isComplete !== undefined && { isComplete: dto.isComplete }),
      ...(dto.coverImageUrl !== undefined && {
        coverImageUrl: dto.coverImageUrl,
      }),
    });

    this.eventEmitter.emit(
      CARD_EVENTS.updated,
      new CardUpdatedEvent(updated, boardId, userId),
    );

    return updated;
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

    this.logger.log(`Card unarchived: ${cardId} by user ${userId}`);
    return restored;
  }

  /**
   * Assigns a user to a card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param assigneeUserId - Target user UUID to assign
   * @throws {EntityNotFoundException} If card is not found
   * @throws {BadRequestException} If assigned user is not a member of the workspace
   */
  async addAssignee(
    boardId: string,
    workspaceId: string,
    cardId: string,
    assigneeUserId: string,
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
  }

  /**
   * Removes an assigned user from a card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param assigneeUserId - User UUID to remove from card
   * @throws {EntityNotFoundException} If board or card is not found
   */
  async removeAssignee(
    boardId: string,
    workspaceId: string,
    cardId: string,
    assigneeUserId: string,
  ): Promise<void> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    await this.cardRepo.removeAssignee(cardId, assigneeUserId);
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
    if (
      !label ||
      label.workspaceId !== workspaceId ||
      (label.boardId !== null && label.boardId !== boardId)
    ) {
      throw new BadRequestException(
        `Label ${labelId} is not available for board ${boardId}`,
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
}
