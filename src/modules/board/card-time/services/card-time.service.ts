import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Card, CardTimeEntry } from '@prisma/client';
import { CardTimeRepository } from '../repositories/card-time.repository';
import { CardRepository } from '../../card/repositories/card.repository';
import { BoardRepository } from '../../core/repositories/board.repository';
import { UpdateEstimateDto, LogTimeDto } from '../dto';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';
import { assertBoardInWorkspace } from '../../utils/board-access.util';
import {
  CardTimeLoggedEvent,
  CardUpdatedEvent,
} from '../../card/events/card.events';
import { CARD_EVENTS } from '../../card/events/card-events.constants';
import type { PaginatedResult } from '../../../../common/interfaces/pagination.interface';

/**
 * Service handling estimate updates and log-only time entries.
 */
@Injectable()
export class CardTimeService {
  private readonly logger = new Logger(CardTimeService.name);

  constructor(
    private readonly timeRepo: CardTimeRepository,
    private readonly cardRepo: CardRepository,
    private readonly boardRepo: BoardRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Verifies that a board exists within the given workspace and is active.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @throws {EntityNotFoundException} If board is not found
   */
  private async verifyBoardInWorkspace(
    boardId: string,
    workspaceId?: string,
  ): Promise<void> {
    await assertBoardInWorkspace(this.boardRepo, boardId, workspaceId);
  }

  /**
   * Sets the estimate for a card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param dto - Estimate payload (0..100000 minutes)
   * @param userId - Acting user UUID
   * @returns The updated card
   * @throws {EntityNotFoundException} If board or card is not found
   * @emits card.updated - After successful update
   */
  async setEstimate(
    boardId: string,
    workspaceId: string,
    cardId: string,
    dto: UpdateEstimateDto,
    userId: string,
  ): Promise<Card> {
    this.logger.debug('Setting card estimate', { boardId, cardId, userId });
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const existing = await this.cardRepo.findActiveById(cardId, boardId);
    if (!existing) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const updated = await this.cardRepo.update(cardId, {
      estimateMinutes: dto.estimateMinutes,
    });

    this.eventEmitter.emit(
      CARD_EVENTS.updated,
      new CardUpdatedEvent(updated, boardId, userId),
    );

    this.logger.log('Card estimate set', {
      cardId,
      estimateMinutes: dto.estimateMinutes,
      userId,
    });
    return updated;
  }

  /**
   * Appends a time entry and increments loggedMinutes atomically.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param dto - Minutes (1..1440) plus optional note
   * @param userId - Acting user UUID
   * @returns The updated card with incremented loggedMinutes
   * @throws {EntityNotFoundException} If board or card is not found
   * @emits card.time_logged - After successful write
   */
  async logTime(
    boardId: string,
    workspaceId: string,
    cardId: string,
    dto: LogTimeDto,
    userId: string,
  ): Promise<Card> {
    this.logger.debug('Logging time', { boardId, cardId, userId });
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const existing = await this.cardRepo.findActiveById(cardId, boardId);
    if (!existing) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const entry = await this.timeRepo.addEntry({
      cardId,
      userId,
      minutes: dto.minutes,
      note: dto.note ?? undefined,
    });

    const updated = await this.cardRepo.findActiveById(cardId, boardId);
    if (!updated) {
      throw new EntityNotFoundException('Card', cardId);
    }

    this.eventEmitter.emit(
      CARD_EVENTS.timeLogged,
      new CardTimeLoggedEvent(
        cardId,
        boardId,
        dto.minutes,
        updated.loggedMinutes,
        entry.id,
        userId,
      ),
    );

    this.logger.log('Time logged', { cardId, minutes: dto.minutes, userId });
    return updated;
  }

  /**
   * Gets time tracking summary for a card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param cursor - Pagination cursor for entries
   * @param limit - Entries page size
   * @returns Estimate, logged, remaining, and paginated entries
   * @throws {EntityNotFoundException} If board or card is not found
   */
  async getTracking(
    boardId: string,
    workspaceId: string,
    cardId: string,
    cursor?: string,
    limit = 20,
  ): Promise<{
    estimate: number | null;
    logged: number;
    remaining: number;
    entries: PaginatedResult<CardTimeEntry>;
  }> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const entries = await this.timeRepo.listForCard(cardId, cursor, limit);

    const logged = card.loggedMinutes;
    const estimate = card.estimateMinutes ?? null;
    const remaining = estimate !== null ? Math.max(0, estimate - logged) : 0;

    return { estimate, logged, remaining, entries };
  }
}
