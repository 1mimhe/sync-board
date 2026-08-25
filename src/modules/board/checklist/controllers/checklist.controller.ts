import {
  Controller,
  Post,
  Get,
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
import { ChecklistService } from '../services/checklist.service';
import {
  CreateChecklistDto,
  UpdateChecklistDto,
  CreateChecklistItemDto,
  UpdateChecklistItemDto,
  ChecklistResponseDto,
  ChecklistItemResponseDto,
} from '../dto';
import {
  toChecklistResponseDto,
  toChecklistItemResponseDto,
} from '../mappers/checklist.mapper';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

/**
 * Controller exposing REST endpoints for managing card checklists and their items.
 */
@ApiTags('Card Checklists')
@Controller(
  'workspaces/:workspaceId/boards/:boardId/cards/:cardId/checklists',
)
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  /**
   * Creates a checklist on a card.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Create a checklist on a card' })
  @ApiParam({ name: 'workspaceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'boardId', type: String, format: 'uuid' })
  @ApiParam({ name: 'cardId', type: String, format: 'uuid' })
  @ApiCreatedResponse({
    description: 'Checklist created',
    type: ChecklistResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: CreateChecklistDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ChecklistResponseDto> {
    const checklist = await this.checklistService.createChecklist(
      workspaceId,
      boardId,
      cardId,
      dto,
      user.sub,
    );
    return toChecklistResponseDto(checklist);
  }

  /**
   * Lists all checklists on a card with ordered items.
   */
  @Get()
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'List checklists on a card' })
  @ApiParam({ name: 'workspaceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'boardId', type: String, format: 'uuid' })
  @ApiParam({ name: 'cardId', type: String, format: 'uuid' })
  @ApiOkResponse({
    description: 'List of checklists retrieved successfully',
    type: [ChecklistResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async list(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<ChecklistResponseDto[]> {
    const checklists = await this.checklistService.getChecklists(
      workspaceId,
      boardId,
      cardId,
    );
    return checklists.map(toChecklistResponseDto);
  }

  /**
   * Renames a checklist.
   */
  @Patch(':checklistId')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Rename a checklist' })
  @ApiParam({ name: 'workspaceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'boardId', type: String, format: 'uuid' })
  @ApiParam({ name: 'cardId', type: String, format: 'uuid' })
  @ApiParam({ name: 'checklistId', type: String, format: 'uuid' })
  @ApiOkResponse({
    description: 'Checklist renamed',
    type: ChecklistResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Checklist not found' })
  async rename(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('checklistId', ParseUUIDPipe) checklistId: string,
    @Body() dto: UpdateChecklistDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ChecklistResponseDto> {
    const checklist = await this.checklistService.renameChecklist(
      workspaceId,
      boardId,
      cardId,
      checklistId,
      dto,
      user.sub,
    );
    return toChecklistResponseDto(checklist);
  }

  /**
   * Deletes a checklist (items cascade).
   */
  @Delete(':checklistId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Delete a checklist' })
  @ApiParam({ name: 'workspaceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'boardId', type: String, format: 'uuid' })
  @ApiParam({ name: 'cardId', type: String, format: 'uuid' })
  @ApiParam({ name: 'checklistId', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Checklist deleted' })
  @ApiResponse({ status: 404, description: 'Checklist not found' })
  async delete(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('checklistId', ParseUUIDPipe) checklistId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.checklistService.deleteChecklist(
      workspaceId,
      boardId,
      cardId,
      checklistId,
      user.sub,
    );
  }

  /**
   * Adds an item to a checklist.
   */
  @Post(':checklistId/items')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Add an item to a checklist' })
  @ApiParam({ name: 'workspaceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'boardId', type: String, format: 'uuid' })
  @ApiParam({ name: 'cardId', type: String, format: 'uuid' })
  @ApiParam({ name: 'checklistId', type: String, format: 'uuid' })
  @ApiCreatedResponse({
    description: 'Item added',
    type: ChecklistItemResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Checklist not found' })
  async addItem(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('checklistId', ParseUUIDPipe) checklistId: string,
    @Body() dto: CreateChecklistItemDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ChecklistItemResponseDto> {
    const item = await this.checklistService.addItem(
      workspaceId,
      boardId,
      cardId,
      checklistId,
      dto,
      user.sub,
    );
    return toChecklistItemResponseDto(item);
  }

  /**
   * Updates a checklist item (edit content and/or toggle done).
   */
  @Patch(':checklistId/items/:itemId')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Update a checklist item' })
  @ApiParam({ name: 'workspaceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'boardId', type: String, format: 'uuid' })
  @ApiParam({ name: 'cardId', type: String, format: 'uuid' })
  @ApiParam({ name: 'checklistId', type: String, format: 'uuid' })
  @ApiParam({ name: 'itemId', type: String, format: 'uuid' })
  @ApiOkResponse({
    description: 'Item updated',
    type: ChecklistItemResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async updateItem(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('checklistId', ParseUUIDPipe) checklistId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateChecklistItemDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ChecklistItemResponseDto> {
    const item = await this.checklistService.updateItem(
      workspaceId,
      boardId,
      cardId,
      checklistId,
      itemId,
      dto,
      user.sub,
    );
    return toChecklistItemResponseDto(item);
  }

  /**
   * Removes an item from a checklist.
   */
  @Delete(':checklistId/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Remove an item from a checklist' })
  @ApiParam({ name: 'workspaceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'boardId', type: String, format: 'uuid' })
  @ApiParam({ name: 'cardId', type: String, format: 'uuid' })
  @ApiParam({ name: 'checklistId', type: String, format: 'uuid' })
  @ApiParam({ name: 'itemId', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Item removed' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async removeItem(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('checklistId', ParseUUIDPipe) checklistId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.checklistService.removeItem(
      workspaceId,
      boardId,
      cardId,
      checklistId,
      itemId,
      user.sub,
    );
  }
}
