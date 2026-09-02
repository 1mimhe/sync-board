import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
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
import { BoardService } from '../services/board.service';
import {
  CreateBoardDto,
  UpdateBoardDto,
  BoardResponseDto,
  BoardWithContentResponseDto,
  BoardContentQueryDto,
  ActivityResponseDto,
  CursorPaginationQueryDto,
} from '../dto';
import {
  toActivityResponseDto,
  toBoardResponseDto,
  toBoardWithContentResponseDto,
} from '../mappers/board.mapper';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import type { PaginatedResult } from '../../../../common/interfaces/pagination.interface';

/**
 * Controller exposing REST endpoints for managing workspace boards, board-level labels,
 * starred boards, and board activity logs.
 */
@ApiTags('Boards')
@Controller('workspaces/:workspaceId/boards')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  /**
   * Creates a new board in a workspace.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Create a new board in workspace' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiCreatedResponse({
    description: 'Board created successfully',
    type: BoardResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateBoardDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BoardResponseDto> {
    const board = await this.boardService.create(workspaceId, dto, user.sub);
    return toBoardResponseDto(board);
  }

  /**
   * Lists boards in a workspace for the authenticated user (cursor-paginated).
   */
  @Get()
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'List boards in workspace (paginated)' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiOkResponse({
    description: 'Paginated list of workspace boards: { items, pagination }',
    type: [BoardResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listWorkspaceBoards(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: CursorPaginationQueryDto,
  ): Promise<PaginatedResult<BoardResponseDto>> {
    const result = await this.boardService.listWorkspaceBoards(
      workspaceId,
      user.sub,
      query,
    );
    return {
      items: result.items.map(toBoardResponseDto),
      pagination: result.pagination,
    };
  }

  /**
   * Lists archived boards in a workspace (paginated).
   */
  @Get('archived')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'List archived boards in workspace (paginated)' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiOkResponse({
    description: 'Paginated list of archived boards: { items, pagination }',
    type: [BoardResponseDto],
  })
  async listArchived(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() query: CursorPaginationQueryDto,
  ): Promise<PaginatedResult<BoardResponseDto>> {
    const result = await this.boardService.listArchivedBoardsPaginated(workspaceId, query);
    return {
      items: result.items.map(toBoardResponseDto),
      pagination: result.pagination,
    };
  }

  /**
   * Retrieves a single board along with its nested lists, cards, and labels.
   */
  @Get(':boardId')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({
    summary:
      'Get board with nested lists and cards (lists and per-list cards are paginated)',
  })
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
    description: 'Board details with lists & cards',
    type: BoardWithContentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async getOne(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query() query: BoardContentQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BoardWithContentResponseDto> {
    const board = await this.boardService.getBoardWithContent(
      boardId,
      workspaceId,
      user.sub,
      query,
    );
    return toBoardWithContentResponseDto(board);
  }

  /**
   * Updates board title, description, or background color.
   */
  @Patch(':boardId')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({
    summary: 'Update board title, description, or background color',
  })
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
    description: 'Board updated successfully',
    type: BoardResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: UpdateBoardDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BoardResponseDto> {
    const updated = await this.boardService.update(
      boardId,
      workspaceId,
      dto,
      user.sub,
    );
    return toBoardResponseDto(updated);
  }

  /**
   * Soft-deletes (archives) a board.
   */
  @Delete(':boardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin')
  @ApiOperation({ summary: 'Archive a board' })
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
  @ApiNoContentResponse({ description: 'Board archived' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async archive(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.boardService.archive(boardId, workspaceId, user.sub);
  }

  /**
   * Restores an archived board.
   */
  @Patch(':boardId/unarchive')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Unarchive a board' })
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
  @ApiOkResponse({ description: 'Board unarchived', type: BoardResponseDto })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async unarchive(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BoardResponseDto> {
    const restored = await this.boardService.unarchive(
      boardId,
      workspaceId,
      user.sub,
    );
    return toBoardResponseDto(restored);
  }

  /**
   * Permanently deletes a board (sets deletedAt). Can be called directly
   * without archiving first. Only owner and admin can perform this operation.
   * Emits board.deleted event.
   */
  @Delete(':boardId/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin')
  @ApiOperation({ summary: 'Permanently delete a board (direct delete)' })
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
  @ApiNoContentResponse({ description: 'Board permanently deleted' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async deletePermanently(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.boardService.deletePermanently(boardId, workspaceId, user.sub);
  }

  /**
   * Stars a board for the authenticated user.
   */
  @Post(':boardId/star')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'Star board for current user' })
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
  @ApiNoContentResponse({ description: 'Board starred' })
  async star(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.boardService.starBoard(user.sub, boardId, workspaceId);
  }

  /**
   * Removes a star from a board for the authenticated user.
   */
  @Delete(':boardId/star')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'Unstar board for current user' })
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
  @ApiNoContentResponse({ description: 'Board unstarred' })
  async unstar(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.boardService.unstarBoard(user.sub, boardId, workspaceId);
  }

  // ============================================================
  // ACTIVITY LOG ENDPOINTS
  // ============================================================

  /**
   * Retrieves a cursor page of audit activity logs for a board.
   */
  @Get(':boardId/activities')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'List board activities (paginated audit log)' })
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
    description: 'Paginated list of board activities: { items, pagination }',
    type: [ActivityResponseDto],
  })
  async getActivities(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query() query: CursorPaginationQueryDto,
  ): Promise<PaginatedResult<ActivityResponseDto>> {
    const result = await this.boardService.getBoardActivities(
      boardId,
      workspaceId,
      query,
    );
    return {
      items: result.items.map(toActivityResponseDto),
      pagination: result.pagination,
    };
  }
}
