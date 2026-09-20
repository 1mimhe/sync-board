import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ActivityService } from '../services/activity.service';
import {
  ActivityEventResponseDto,
  PaginatedActivityEventResponseDto,
} from '../dto/activity-response.dto';
import { ActivityFeedQueryDto } from '../dto/activity-feed-query.dto';
import {
  ActivityResponseDto,
  PaginatedLegacyActivityResponseDto,
} from '../../board/core/dto/activity-response.dto';
import { CursorPaginationQueryDto } from '../../../common/dto/cursor-pagination-query.dto';
import { WorkspaceAuth } from '../../workspace/decorators/workspace-auth.decorator';
import type { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import {
  toActivityEventResponseDto,
  toLegacyActivityResponseDto,
} from '../mappers/activity.mapper';

@ApiTags('Activity')
@Controller('workspaces/:workspaceId/activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'Workspace activity feed (cursor paginated)' })
  @ApiOkResponse({
    type: PaginatedActivityEventResponseDto,
    description: 'Paginated activity event feed',
  })
  async getWorkspaceFeed(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() query: ActivityFeedQueryDto,
  ): Promise<PaginatedResult<ActivityEventResponseDto>> {
    const page = await this.activityService.getWorkspaceFeed(
      workspaceId,
      query,
    );
    return { ...page, items: page.items.map(toActivityEventResponseDto) };
  }
}

@ApiTags('Activity')
@Controller('workspaces/:workspaceId/boards/:boardId')
export class BoardActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('activities')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'Legacy board activity feed (UUID cursor)' })
  @ApiOkResponse({
    type: PaginatedLegacyActivityResponseDto,
    description: 'Legacy board activity feed',
  })
  async getBoardFeed(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query() query: CursorPaginationQueryDto,
  ): Promise<PaginatedResult<ActivityResponseDto>> {
    const page = await this.activityService.getLegacyBoardFeed(
      workspaceId,
      boardId,
      query,
    );
    return { ...page, items: page.items.map(toLegacyActivityResponseDto) };
  }

  @Get('activity')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'Board activity feed (composite cursor)' })
  @ApiOkResponse({
    type: PaginatedActivityEventResponseDto,
    description: 'Board activity feed with composite cursor',
  })
  async getBoardActivity(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query() query: ActivityFeedQueryDto,
  ): Promise<PaginatedResult<ActivityEventResponseDto>> {
    const page = await this.activityService.getBoardFeed(
      workspaceId,
      boardId,
      query,
    );
    return { ...page, items: page.items.map(toActivityEventResponseDto) };
  }
}
