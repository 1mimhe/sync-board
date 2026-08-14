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
  CreateLabelDto,
  UpdateLabelDto,
  BoardResponseDto,
  BoardWithContentResponseDto,
  BoardLabelResponseDto,
  BoardContentQueryDto,
  ActivityResponseDto,
} from '../dto';
import {
  toActivityResponseDto,
  toBoardLabelResponseDto,
  toBoardResponseDto,
  toBoardWithContentResponseDto,
} from '../mappers/board.mapper';
import { WorkspaceAuth } from '../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

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
   * Lists all boards in a workspace for the authenticated user.
   */
  @Get()
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'List all boards in workspace' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiOkResponse({
    description: 'List of workspace boards',
    type: [BoardResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listWorkspaceBoards(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<BoardResponseDto[]> {
    const boards = await this.boardService.listWorkspaceBoards(
      workspaceId,
      user.sub,
    );
    return boards.map(toBoardResponseDto);
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
  // LABELS ENDPOINTS
  // ============================================================

  /**
   * Creates a board-scoped label.
   */
  @Post(':boardId/labels')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Create a label on board' })
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
    description: 'Label created',
    type: BoardLabelResponseDto,
  })
  async createLabel(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: CreateLabelDto,
  ): Promise<BoardLabelResponseDto> {
    const label = await this.boardService.createLabel(
      boardId,
      workspaceId,
      dto,
    );
    return toBoardLabelResponseDto(label);
  }

  /**
   * Lists all labels available for a board.
   */
  @Get(':boardId/labels')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'List all labels on board' })
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
    description: 'List of board labels',
    type: [BoardLabelResponseDto],
  })
  async getBoardLabels(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
  ): Promise<BoardLabelResponseDto[]> {
    const labels = await this.boardService.getBoardLabels(boardId, workspaceId);
    return labels.map(toBoardLabelResponseDto);
  }

  /**
   * Updates a board-scoped label's name or color.
   */
  @Patch(':boardId/labels/:labelId')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Update label name or color' })
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
    name: 'labelId',
    type: String,
    format: 'uuid',
    description: 'Label UUID',
  })
  @ApiOkResponse({ description: 'Label updated', type: BoardLabelResponseDto })
  async updateLabel(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
    @Body() dto: UpdateLabelDto,
  ): Promise<BoardLabelResponseDto> {
    const label = await this.boardService.updateLabel(
      boardId,
      workspaceId,
      labelId,
      dto,
    );
    return toBoardLabelResponseDto(label);
  }

  /**
   * Deletes a board label.
   */
  @Delete(':boardId/labels/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Delete label from board' })
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
    name: 'labelId',
    type: String,
    format: 'uuid',
    description: 'Label UUID',
  })
  @ApiNoContentResponse({ description: 'Label deleted' })
  async deleteLabel(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ): Promise<void> {
    await this.boardService.deleteLabel(boardId, workspaceId, labelId);
  }

  // ============================================================
  // ACTIVITY LOG ENDPOINTS
  // ============================================================

  /**
   * Retrieves audit activity logs for a board.
   */
  @Get(':boardId/activities')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'List recent board activities (audit log)' })
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
    description: 'List of recent board activities',
    type: [ActivityResponseDto],
  })
  async getActivities(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
  ): Promise<ActivityResponseDto[]> {
    const activities = await this.boardService.getBoardActivities(
      boardId,
      workspaceId,
    );
    return activities.map(toActivityResponseDto);
  }
}
