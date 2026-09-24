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
import { CardFieldService } from '../services/card-field.service';
import { CreateFieldDefDto, UpdateFieldDefDto } from '../dto/field-def.dto';
import { CardFieldDefResponseDto } from '../dto/field-response.dto';
import { toCardFieldDefResponseDto } from '../mappers/field.mapper';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import {
  WORKSPACE_ADMIN_ROLES,
  WORKSPACE_READ_ROLES,
} from '../../../../common/guards/rbac.constants';

/**
 * Controller exposing REST endpoints for custom fields.
 */
@ApiTags('Card Custom Fields')
@Controller('workspaces/:workspaceId/field-defs')
export class CardFieldDefController {
  constructor(private readonly fieldService: CardFieldService) {}

  /**
   * Creates a custom field definition.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(...WORKSPACE_ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a custom field definition' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiCreatedResponse({
    description: 'Field definition created',
    type: CardFieldDefResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Field name already exists' })
  async createDef(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateFieldDefDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CardFieldDefResponseDto> {
    const def = await this.fieldService.createDef(workspaceId, dto, user.sub);
    return toCardFieldDefResponseDto(def);
  }

  /**
   * Lists all field definitions in a workspace.
   */
  @Get()
  @WorkspaceAuth(...WORKSPACE_READ_ROLES)
  @ApiOperation({ summary: 'List all custom field definitions in a workspace' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiOkResponse({
    description: 'Field definitions retrieved',
    type: [CardFieldDefResponseDto],
  })
  async listDefs(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<CardFieldDefResponseDto[]> {
    const defs = await this.fieldService.listDefs(workspaceId);
    return defs.map(toCardFieldDefResponseDto);
  }

  /**
   * Updates a field definition.
   */
  @Patch(':fieldId')
  @WorkspaceAuth(...WORKSPACE_ADMIN_ROLES)
  @ApiOperation({ summary: 'Update a custom field definition' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiParam({
    name: 'fieldId',
    type: String,
    format: 'uuid',
    description: 'Field Definition UUID',
  })
  @ApiOkResponse({
    description: 'Field definition updated',
    type: CardFieldDefResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Field definition not found' })
  @ApiResponse({ status: 409, description: 'Field name already exists' })
  async updateDef(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() dto: UpdateFieldDefDto,
  ): Promise<CardFieldDefResponseDto> {
    const def = await this.fieldService.updateDef(workspaceId, fieldId, dto);
    return toCardFieldDefResponseDto(def);
  }

  /**
   * Deletes a field definition.
   */
  @Delete(':fieldId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(...WORKSPACE_ADMIN_ROLES)
  @ApiOperation({ summary: 'Delete a custom field definition' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiParam({
    name: 'fieldId',
    type: String,
    format: 'uuid',
    description: 'Field Definition UUID',
  })
  @ApiNoContentResponse({ description: 'Field definition deleted' })
  @ApiResponse({ status: 404, description: 'Field definition not found' })
  async deleteDef(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
  ): Promise<void> {
    await this.fieldService.deleteDef(workspaceId, fieldId);
  }
}
