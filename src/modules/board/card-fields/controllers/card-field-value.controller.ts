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
import { CardFieldService } from '../services/card-field.service';
import { SetFieldValueDto } from '../dto/field-def.dto';
import {
  CardFieldValueResponseDto,
  CardFieldValueWithDefResponseDto,
} from '../dto/field-response.dto';
import {
  toCardFieldValueResponseDto,
  toCardFieldValueWithDefResponseDto,
} from '../mappers/field.mapper';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import {
  WORKSPACE_READ_ROLES,
  WORKSPACE_WRITE_ROLES,
} from '../../../../common/guards/rbac.constants';

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
  @WorkspaceAuth(...WORKSPACE_WRITE_ROLES)
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
  @ApiOkResponse({
    description: 'Field value set',
    type: CardFieldValueResponseDto,
  })
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
  ): Promise<CardFieldValueResponseDto> {
    const value = await this.fieldService.setValue(
      boardId,
      workspaceId,
      cardId,
      fieldId,
      dto,
    );
    return toCardFieldValueResponseDto(value);
  }

  /**
   * Lists all field values for a card.
   */
  @Get()
  @WorkspaceAuth(...WORKSPACE_READ_ROLES)
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
  @ApiOkResponse({
    description: 'Field values retrieved',
    type: [CardFieldValueWithDefResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async listValues(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<CardFieldValueWithDefResponseDto[]> {
    const values = await this.fieldService.listValues(
      boardId,
      workspaceId,
      cardId,
    );
    return values.map(toCardFieldValueWithDefResponseDto);
  }
}
