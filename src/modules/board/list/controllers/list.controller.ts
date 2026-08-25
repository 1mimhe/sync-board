import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ListService } from '../services/list.service';
import {
  CreateListDto,
  UpdateListDto,
  MoveListDto,
  ListResponseDto,
} from '../dto';
import { toListResponseDto } from '../../board/mappers/board.mapper';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

/**
 * Controller exposing REST endpoints for managing board lists (create, rename, LexoRank reorder, archive).
 */
@ApiTags('Lists')
@Controller('workspaces/:workspaceId/boards/:boardId/lists')
export class ListController {
  constructor(private readonly listService: ListService) {}

  /**
   * Creates a new list at the end of a board.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Create a new list on board' })
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
  @ApiCreatedResponse({
    description: 'List created successfully',
    type: ListResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: CreateListDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ListResponseDto> {
    const list = await this.listService.create(
      boardId,
      workspaceId,
      dto,
      user.sub,
    );
    return toListResponseDto(list);
  }

  /**
   * Updates a list's title.
   */
  @Patch(':listId')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Update list title' })
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
    name: 'listId',
    type: String,
    format: 'uuid',
    description: 'List UUID',
  })
  @ApiOkResponse({
    description: 'List updated successfully',
    type: ListResponseDto,
  })
  @ApiResponse({ status: 404, description: 'List not found' })
  async update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: UpdateListDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ListResponseDto> {
    const list = await this.listService.update(
      boardId,
      workspaceId,
      listId,
      dto,
      user.sub,
    );
    return toListResponseDto(list);
  }

  /**
   * Reorders a list using LexoRank.
   */
  @Patch(':listId/move')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Reorder list using LexoRank' })
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
    name: 'listId',
    type: String,
    format: 'uuid',
    description: 'List UUID',
  })
  @ApiOkResponse({
    description: 'List moved successfully',
    type: ListResponseDto,
  })
  @ApiResponse({ status: 404, description: 'List not found' })
  async move(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: MoveListDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ListResponseDto> {
    const list = await this.listService.move(
      boardId,
      workspaceId,
      listId,
      dto,
      user.sub,
    );
    return toListResponseDto(list);
  }

  /**
   * Soft-deletes (archives) a list.
   */
  @Delete(':listId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Archive a list' })
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
    name: 'listId',
    type: String,
    format: 'uuid',
    description: 'List UUID',
  })
  @ApiNoContentResponse({ description: 'List archived' })
  @ApiResponse({ status: 404, description: 'List not found' })
  async archive(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.listService.archive(boardId, workspaceId, listId, user.sub);
  }

  /**
   * Restores an archived list.
   */
  @Patch(':listId/unarchive')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Unarchive a list' })
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
    name: 'listId',
    type: String,
    format: 'uuid',
    description: 'List UUID',
  })
  @ApiOkResponse({ description: 'List unarchived', type: ListResponseDto })
  @ApiResponse({ status: 404, description: 'List not found' })
  async unarchive(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ListResponseDto> {
    const list = await this.listService.unarchive(
      boardId,
      workspaceId,
      listId,
      user.sub,
    );
    return toListResponseDto(list);
  }
}
