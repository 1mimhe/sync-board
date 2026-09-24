import { Injectable, Logger } from '@nestjs/common';
import type { Card, CardStatus, CardPriority } from '@prisma/client';
import { CardViewRepository } from '../repositories/card-view.repository';
import { BoardRepository } from '../../core/repositories/board.repository';
import { BusinessRuleException } from '../../../../common/exceptions/app.exception';
import { assertBoardInWorkspace } from '../../utils/board-access.util';
import type { PaginatedResult } from '../../../../common/interfaces/pagination.interface';
import type {
  CalendarViewQueryDto,
  TimelineViewQueryDto,
  TableViewQueryDto,
} from '../dto/view-query.dto';
import type { CardWithDetails } from '../../core/interfaces/board.interfaces';
import type { CardTableFilters } from '../interfaces/card-view.interfaces';

/**
 * Service handling read-only board view queries (calendar, timeline, table).
 */
@Injectable()
export class CardViewService {
  private readonly logger = new Logger(CardViewService.name);

  constructor(
    private readonly viewRepo: CardViewRepository,
    private readonly boardRepo: BoardRepository,
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
   * Calendar view: active cards with dueDate inside [from, to].
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param query - Date range plus cursor pagination
   * @returns Paginated cards ordered by dueDate
   * @throws {EntityNotFoundException} If board is not found
   * @throws {BusinessRuleException} If DATE_RANGE_TOO_LARGE (range exceeds 366 days)
   */
  async calendar(
    boardId: string,
    workspaceId: string,
    query: CalendarViewQueryDto,
  ): Promise<PaginatedResult<Card>> {
    this.logger.debug('Querying calendar view', { boardId });
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const limit = query.limit ?? 20;
    const startStr = query.from || query.startDate;
    const endStr = query.to || query.endDate;
    if (!startStr || !endStr) {
      throw new BusinessRuleException(
        'INVALID_DATE_RANGE',
        'Both from (or startDate) and to (or endDate) must be provided',
      );
    }
    const from = new Date(startStr);
    const to = new Date(endStr);

    if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
      throw new BusinessRuleException(
        'DATE_RANGE_TOO_LARGE',
        'Calendar range cannot exceed 366 days',
      );
    }

    return this.viewRepo.calendarPage(boardId, from, to, query.cursor, limit);
  }

  /**
   * Timeline view: active cards ordered by creation time.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param query - Cursor pagination
   * @returns Paginated cards ordered by createdAt
   * @throws {EntityNotFoundException} If board is not found
   */
  async timeline(
    boardId: string,
    workspaceId: string,
    query: TimelineViewQueryDto,
  ): Promise<PaginatedResult<Card>> {
    this.logger.debug('Querying timeline view', { boardId });
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const limit = query.limit ?? 20;
    return this.viewRepo.timelinePage(boardId, query.cursor, limit);
  }

  /**
   * Table view: flat active cards with optional status, priority, and assignee filters.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param query - Filters plus cursor pagination
   * @returns Paginated card details ordered by updatedAt
   * @throws {EntityNotFoundException} If board is not found
   */
  async table(
    boardId: string,
    workspaceId: string,
    query: TableViewQueryDto,
  ): Promise<PaginatedResult<CardWithDetails>> {
    this.logger.debug('Querying table view', { boardId });
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const limit = query.limit ?? 20;
    const filters: CardTableFilters = {
      status: query.status,
      priority: query.priority,
      assigneeId: query.assigneeId,
    };
    if (query.search) filters.search = query.search;
    if (query.sortBy) filters.sortBy = query.sortBy;
    if (query.sortOrder) filters.sortOrder = query.sortOrder;

    return this.viewRepo.tablePage(boardId, filters, query.cursor, limit);
  }
}
