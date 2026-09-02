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
import { CardService } from '../services/card.service';
import {
  CreateCardDto,
  UpdateCardDto,
  MoveCardDto,
  CardResponseDto,
  CardWithDetailsResponseDto,
} from '../dto';
import {
  toCardResponseDto,
  toCardWithDetailsResponseDto,
} from '../../board/mappers/board.mapper';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import { CursorPaginationQueryDto } from '../../board/dto';
import type { PaginatedResult } from '../../../../common/interfaces/pagination.interface';

/**
 * Controller exposing REST endpoints for managing cards, card assignments, and card label attachments.
 */
@ApiTags('Cards')
@Controller('workspaces/:workspaceId/boards/:boardId')
export class CardController {
  constructor(private readonly cardService: CardService) {}

  /**
   * Creates a new card in a list.
   */
  @Post('lists/:listId/cards')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Create a new card in a list' })
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
  @ApiCreatedResponse({
    description: 'Card created successfully',
    type: CardWithDetailsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'List not found' })
  async create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: CreateCardDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CardWithDetailsResponseDto> {
    const card = await this.cardService.create(
      boardId,
      workspaceId,
      listId,
      dto,
      user.sub,
    );
    return toCardWithDetailsResponseDto(card);
  }

  /**
   * Lists archived cards in a board (paginated, owner/admin/member).
   */
  @Get('cards/archived')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'List archived cards in board (paginated)' })
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
    description: 'Paginated list of archived cards: { items, pagination }',
    type: [CardWithDetailsResponseDto],
  })
  async listArchived(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query() query: CursorPaginationQueryDto,
  ): Promise<PaginatedResult<CardWithDetailsResponseDto>> {
    const result = await this.cardService.listArchivedCardsPaginated(boardId, workspaceId, query);
    return {
      items: result.items.map(toCardWithDetailsResponseDto),
      pagination: result.pagination,
    };
  }

  /**
   * Retrieves full details for a card.
   */
  @Get('cards/:cardId')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'Get detailed card information' })
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
    description: 'Card details',
    type: CardWithDetailsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async getOne(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<CardWithDetailsResponseDto> {
    const card = await this.cardService.getCardDetails(
      boardId,
      workspaceId,
      cardId,
    );
    return toCardWithDetailsResponseDto(card);
  }

  /**
   * Updates card fields (title, description, due date, completion, cover image).
   */
  @Patch('cards/:cardId')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({
    summary:
      'Update card details (title, description, due date, completion status, cover image)',
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
  @ApiOkResponse({
    description: 'Card updated successfully',
    type: CardResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: UpdateCardDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CardResponseDto> {
    const card = await this.cardService.update(
      boardId,
      workspaceId,
      cardId,
      dto,
      user.sub,
    );
    return toCardResponseDto(card);
  }

  /**
   * Moves or reorders a card using LexoRank.
   */
  @Patch('cards/:cardId/move')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({
    summary:
      'Move/reorder card within list or across lists on the same board using LexoRank',
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
  @ApiOkResponse({
    description: 'Card moved successfully',
    type: CardResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid destination list' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async move(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: MoveCardDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CardResponseDto> {
    const card = await this.cardService.move(
      boardId,
      workspaceId,
      cardId,
      dto,
      user.sub,
    );
    return toCardResponseDto(card);
  }

  /**
   * Soft-deletes (archives) a card.
   */
  @Delete('cards/:cardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Archive a card' })
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
  @ApiNoContentResponse({ description: 'Card archived' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async archive(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.cardService.archive(boardId, workspaceId, cardId, user.sub);
  }

  /**
   * Restores an archived card.
   */
  @Patch('cards/:cardId/unarchive')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Unarchive a card' })
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
  @ApiOkResponse({ description: 'Card unarchived', type: CardResponseDto })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async unarchive(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CardResponseDto> {
    const card = await this.cardService.unarchive(
      boardId,
      workspaceId,
      cardId,
      user.sub,
    );
    return toCardResponseDto(card);
  }

  /**
   * Permanently deletes a card (sets deletedAt). Can be called directly
   * without archiving first. Only owner and admin can perform this operation.
   * Emits card.deleted event.
   */
  @Delete('cards/:cardId/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin')
  @ApiOperation({ summary: 'Permanently delete a card (direct delete)' })
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
  @ApiNoContentResponse({ description: 'Card permanently deleted' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async deletePermanently(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.cardService.deletePermanently(boardId, workspaceId, cardId, user.sub);
  }

  /**
   * Assigns a user to a card.
   */
  @Post('cards/:cardId/assignees/:targetUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Assign a user to card' })
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
    name: 'targetUserId',
    type: String,
    format: 'uuid',
    description: 'Target User UUID',
  })
  @ApiNoContentResponse({ description: 'User assigned to card' })
  async addAssignee(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.cardService.addAssignee(
      boardId,
      workspaceId,
      cardId,
      targetUserId,
      user.sub,
    );
  }

  /**
   * Removes an assigned user from a card.
   */
  @Delete('cards/:cardId/assignees/:targetUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Remove an assigned user from card' })
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
    name: 'targetUserId',
    type: String,
    format: 'uuid',
    description: 'Target User UUID',
  })
  @ApiNoContentResponse({ description: 'User unassigned from card' })
  async removeAssignee(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.cardService.removeAssignee(
      boardId,
      workspaceId,
      cardId,
      targetUserId,
      user.sub,
    );
  }

  /**
   * Attaches a board label to a card.
   */
  @Post('cards/:cardId/labels/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Attach a board label to card' })
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
    name: 'labelId',
    type: String,
    format: 'uuid',
    description: 'Label UUID',
  })
  @ApiNoContentResponse({ description: 'Label attached to card' })
  async addLabel(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ): Promise<void> {
    await this.cardService.addLabel(boardId, workspaceId, cardId, labelId);
  }

  /**
   * Detaches a board label from a card.
   */
  @Delete('cards/:cardId/labels/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Detach a board label from card' })
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
    name: 'labelId',
    type: String,
    format: 'uuid',
    description: 'Label UUID',
  })
  @ApiNoContentResponse({ description: 'Label detached from card' })
  async removeLabel(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ): Promise<void> {
    await this.cardService.removeLabel(boardId, workspaceId, cardId, labelId);
  }
}
