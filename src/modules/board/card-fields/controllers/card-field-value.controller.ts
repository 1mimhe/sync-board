import {
  Controller,
  Put,
  Get,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import type { CardFieldValue, CardFieldDef } from '@prisma/client';
import { CardFieldService } from '../services/card-field.service';
import { SetFieldValueDto } from '../dto/field-def.dto';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';

/**
 * Controller exposing REST endpoints for card field values.
 */
@ApiTags('Card Custom Fields')
@Controller('workspaces/:workspaceId/boards/:boardId/cards/:cardId/fields')
export class CardFieldValueController {
  constructor(private readonly fieldService: CardFieldService) {}

  /**
   * Sets a field value on a card (idempotent upsert).
   */
  @Put(':fieldId')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Set a custom field value on a card' })
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
    name: 'fieldId',
    type: String,
    format: 'uuid',
    description: 'Field Definition UUID',
  })
  @ApiOkResponse({ description: 'Field value set' })
  @ApiResponse({ status: 400, description: 'Invalid value for field type' })
  @ApiResponse({
    status: 404,
    description: 'Card or field definition not found',
  })
  async setValue(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() dto: SetFieldValueDto,
  ): Promise<CardFieldValue> {
    return this.fieldService.setValue(
      boardId,
      workspaceId,
      cardId,
      fieldId,
      dto,
    );
  }

  /**
   * Lists all field values for a card.
   */
  @Get()
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'List all custom field values for a card' })
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
  @ApiOkResponse({ description: 'Field values retrieved' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async listValues(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<(CardFieldValue & { field: CardFieldDef })[]> {
    return this.fieldService.listValues(boardId, workspaceId, cardId);
  }
}
