import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ActivityService } from '../services/activity.service';
import {
  ActivityResponseDto,
  PaginatedActivityResponseDto,
} from '../dto/activity-response.dto';
import { ActivityFeedQueryDto } from '../dto/activity-feed-query.dto';
import { WorkspaceAuth } from '../../workspace/decorators/workspace-auth.decorator';
import type { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import { toActivityResponseDto } from '../mappers/activity.mapper';
import { WORKSPACE_READ_ROLES } from '../../../common/guards/rbac.constants';

@ApiTags('Activity')
@Controller('workspaces/:workspaceId/activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @WorkspaceAuth(...WORKSPACE_READ_ROLES)
  @ApiOperation({ summary: 'Workspace activity feed (cursor paginated)' })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    type: PaginatedActivityResponseDto,
    description: 'Paginated activity feed',
  })
  async getWorkspaceFeed(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() query: ActivityFeedQueryDto,
  ): Promise<PaginatedResult<ActivityResponseDto>> {
    const page = await this.activityService.getWorkspaceFeed(
      workspaceId,
      query,
    );
    return { ...page, items: page.items.map(toActivityResponseDto) };
  }
}

@ApiTags('Activity')
@Controller('workspaces/:workspaceId/boards/:boardId')
export class BoardActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('activity')
  @WorkspaceAuth(...WORKSPACE_READ_ROLES)
  @ApiOperation({ summary: 'Board activity feed (composite cursor)' })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    type: PaginatedActivityResponseDto,
    description: 'Board activity feed with composite cursor',
  })
  async getBoardFeed(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query() query: ActivityFeedQueryDto,
  ): Promise<PaginatedResult<ActivityResponseDto>> {
    const page = await this.activityService.getBoardFeed(
      workspaceId,
      boardId,
      query,
    );
    return { ...page, items: page.items.map(toActivityResponseDto) };
  }
}
