import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CardTimeService } from '../services/card-time.service';
import { TimeTrackingResponseDto } from '../../card/dto/card-response.dto';
import { UpdateEstimateDto, LogTimeDto } from '../dto';
import { toCardResponseDto } from '../../core/mappers/board.mapper';
import { CardResponseDto } from '../../card/dto/card-response.dto';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import { CursorPaginationQueryDto } from '../../../../common/dto/cursor-pagination-query.dto';
import {
  WORKSPACE_READ_ROLES,
  WORKSPACE_WRITE_ROLES,
} from '../../../../common/guards/rbac.constants';

/**
 * Controller exposing REST endpoints for card time tracking.
 */
@ApiTags('Card Time')
@Controller('workspaces/:workspaceId/boards/:boardId/cards/:cardId')
export class CardTimeController {
  constructor(private readonly timeService: CardTimeService) {}

  /**
   * Sets the time estimate for a card.
   */
  @Patch('estimate')
  @WorkspaceAuth(...WORKSPACE_WRITE_ROLES)
  @ApiOperation({ summary: 'Set time estimate for a card' })
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
  @ApiParam({
    name: 'cardId',
    type: String,
    format: 'uuid',
    description: 'Card UUID',
  })
  @ApiOkResponse({ description: 'Estimate updated', type: CardResponseDto })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async setEstimate(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: UpdateEstimateDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CardResponseDto> {
    const card = await this.timeService.setEstimate(
      boardId,
      workspaceId,
      cardId,
      dto,
      user.sub,
    );
    return toCardResponseDto(card);
  }

  /**
   * Logs time spent on a card.
   */
  @Post('time')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(...WORKSPACE_WRITE_ROLES)
  @ApiOperation({ summary: 'Log time spent on a card' })
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
  @ApiParam({
    name: 'cardId',
    type: String,
    format: 'uuid',
    description: 'Card UUID',
  })
  @ApiCreatedResponse({ description: 'Time logged', type: CardResponseDto })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async logTime(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: LogTimeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CardResponseDto> {
    const card = await this.timeService.logTime(
      boardId,
      workspaceId,
      cardId,
      dto,
      user.sub,
    );
    return toCardResponseDto(card);
  }

  /**
   * Gets time tracking summary for a card.
   */
  @Get('time')
  @WorkspaceAuth(...WORKSPACE_READ_ROLES)
  @ApiOperation({
    summary: 'Get time tracking summary (estimate, logged, remaining, entries)',
  })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
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
  @ApiParam({
    name: 'cardId',
    type: String,
    format: 'uuid',
    description: 'Card UUID',
  })
  @ApiOkResponse({
    description: 'Time tracking data',
    type: TimeTrackingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async getTracking(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Query() query: CursorPaginationQueryDto = {},
  ): Promise<TimeTrackingResponseDto> {
    const result = await this.timeService.getTracking(
      boardId,
      workspaceId,
      cardId,
      query.cursor,
      query.limit ?? 20,
    );
    return {
      estimate: result.estimate,
      logged: result.logged,
      remaining: result.remaining,
      entries: {
        items: result.entries.items,
        pagination: result.entries.pagination,
      },
    };
  }
}
