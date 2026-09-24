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
  ApiQuery,
} from '@nestjs/swagger';
import { CardCommentService } from '../services/comment.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CardCommentResponseDto,
  PaginatedCommentsResponseDto,
} from '../dto';
import { CursorPaginationQueryDto } from '../../../../common/dto/cursor-pagination-query.dto';
import { toCardCommentResponseDto } from '../../core/mappers/board.mapper';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import {
  WORKSPACE_READ_ROLES,
  WORKSPACE_WRITE_ROLES,
} from '../../../../common/guards/rbac.constants';

/**
 * Controller exposing REST endpoints for managing card comments.
 */
@ApiTags('Card Comments')
@Controller('workspaces/:workspaceId/boards/:boardId/cards/:cardId/comments')
export class CardCommentController {
  constructor(private readonly commentService: CardCommentService) {}

  /**
   * Adds a comment to a card.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(...WORKSPACE_WRITE_ROLES)
  @ApiOperation({ summary: 'Add a comment to a card' })
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
  @ApiCreatedResponse({
    description: 'Comment created',
    type: CardCommentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CardCommentResponseDto> {
    const comment = await this.commentService.create(
      boardId,
      workspaceId,
      cardId,
      dto,
      user.sub,
    );
    return toCardCommentResponseDto(comment);
  }

  /**
   * Lists comments on a card with pagination.
   */
  @Get()
  @WorkspaceAuth(...WORKSPACE_READ_ROLES)
  @ApiOperation({ summary: 'List comments on a card (paginated)' })
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
    description: 'Paginated comments: { items, pagination }',
    type: PaginatedCommentsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async list(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Query() query: CursorPaginationQueryDto,
  ): Promise<PaginatedCommentsResponseDto> {
    const result = await this.commentService.getCardComments(
      boardId,
      workspaceId,
      cardId,
      query,
    );
    return {
      items: result.items.map(toCardCommentResponseDto),
      pagination: result.pagination,
    };
  }

  /**
   * Updates an existing comment's text.
   */
  @Patch(':commentId')
  @WorkspaceAuth(...WORKSPACE_WRITE_ROLES)
  @ApiOperation({ summary: 'Update own comment content' })
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
  @ApiParam({
    name: 'commentId',
    type: String,
    format: 'uuid',
    description: 'Comment UUID',
  })
  @ApiOkResponse({
    description: 'Comment updated',
    type: CardCommentResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden (not the author)' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CardCommentResponseDto> {
    const comment = await this.commentService.update(
      boardId,
      workspaceId,
      cardId,
      commentId,
      dto,
      user.sub,
    );
    return toCardCommentResponseDto(comment);
  }

  /**
   * Lists a comment thread (parent plus direct replies, unpaginated).
   */
  @Get(':commentId/replies')
  @WorkspaceAuth(...WORKSPACE_READ_ROLES)
  @ApiOperation({
    summary: 'List a comment thread (parent + replies, unpaginated)',
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
  @ApiParam({
    name: 'cardId',
    type: String,
    format: 'uuid',
    description: 'Card UUID',
  })
  @ApiParam({
    name: 'commentId',
    type: String,
    format: 'uuid',
    description: 'Parent Comment UUID',
  })
  @ApiOkResponse({
    description: 'Parent comment with replies',
    type: CardCommentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Parent comment not found' })
  async listThread(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<{
    parent: CardCommentResponseDto;
    replies: CardCommentResponseDto[];
  }> {
    const thread = await this.commentService.listThread(
      boardId,
      workspaceId,
      cardId,
      commentId,
    );
    return {
      parent: toCardCommentResponseDto(thread),
      replies: thread.replies.map(toCardCommentResponseDto),
    };
  }

  /**
   * Soft-deletes a comment.
   */
  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(...WORKSPACE_WRITE_ROLES)
  @ApiOperation({ summary: 'Delete own comment' })
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
  @ApiParam({
    name: 'commentId',
    type: String,
    format: 'uuid',
    description: 'Comment UUID',
  })
  @ApiNoContentResponse({ description: 'Comment deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden (not the author)' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async delete(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.commentService.delete(
      boardId,
      workspaceId,
      cardId,
      commentId,
      user.sub,
    );
  }
}
