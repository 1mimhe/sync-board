import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CardViewService } from '../services/card-view.service';
import {
  CalendarViewQueryDto,
  TimelineViewQueryDto,
  TableViewQueryDto,
} from '../dto/view-query.dto';
import {
  CardResponseDto,
  CardWithDetailsResponseDto,
} from '../../card/dto/card-response.dto';
import {
  toCardResponseDto,
  toCardWithDetailsResponseDto,
} from '../../core/mappers/board.mapper';
import type { PaginatedResult } from '../../../../common/interfaces/pagination.interface';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';

/**
 * Controller exposing read-only board views (calendar, timeline, table).
 */
@ApiTags('Board Views')
@Controller('workspaces/:workspaceId/boards/:boardId/views')
export class BoardViewController {
  constructor(private readonly viewService: CardViewService) {}

  /**
   * Calendar view - cards with dueDate in range.
   */
  @Get('calendar')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'Get calendar view of cards by due date' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiParam({
    name: 'boardId',
    type: String,
    format: 'uuid',
    description: 'Board UUID',
  })
  @ApiOkResponse({ description: 'Calendar view data', type: [CardResponseDto] })
  @ApiResponse({
    status: 400,
    description: 'Invalid date range (max 366 days)',
  })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async calendar(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query() query: CalendarViewQueryDto,
  ): Promise<PaginatedResult<CardResponseDto>> {
    const result = await this.viewService.calendar(boardId, workspaceId, query);
    return {
      items: result.items.map(toCardResponseDto),
      pagination: result.pagination,
    };
  }

  /**
   * Timeline view - cards ordered by createdAt.
   */
  @Get('timeline')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'Get timeline view of cards by creation date' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiParam({
    name: 'boardId',
    type: String,
    format: 'uuid',
    description: 'Board UUID',
  })
  @ApiOkResponse({ description: 'Timeline view data', type: [CardResponseDto] })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async timeline(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query() query: TimelineViewQueryDto,
  ): Promise<PaginatedResult<CardResponseDto>> {
    const result = await this.viewService.timeline(boardId, workspaceId, query);
    return {
      items: result.items.map(toCardResponseDto),
      pagination: result.pagination,
    };
  }

  /**
   * Table view - flat list with filters.
   */
  @Get('table')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'Get table view of cards with filters' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiParam({
    name: 'boardId',
    type: String,
    format: 'uuid',
    description: 'Board UUID',
  })
  @ApiOkResponse({
    description: 'Table view data',
    type: [CardWithDetailsResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async table(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query() query: TableViewQueryDto,
  ): Promise<PaginatedResult<CardWithDetailsResponseDto>> {
    const result = await this.viewService.table(boardId, workspaceId, query);
    return {
      items: result.items.map(toCardWithDetailsResponseDto),
      pagination: result.pagination,
    };
  }
}
