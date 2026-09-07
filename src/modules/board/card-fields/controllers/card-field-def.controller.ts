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
import type { CardFieldDef } from '@prisma/client';
import { CardFieldService } from '../services/card-field.service';
import { CreateFieldDefDto, UpdateFieldDefDto } from '../dto/field-def.dto';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

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
  @WorkspaceAuth('owner', 'admin')
  @ApiOperation({ summary: 'Create a custom field definition' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiCreatedResponse({ description: 'Field definition created' })
  @ApiResponse({ status: 409, description: 'Field name already exists' })
  async createDef(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateFieldDefDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CardFieldDef> {
    return this.fieldService.createDef(workspaceId, dto, user.sub);
  }

  /**
   * Lists all field definitions in a workspace.
   */
  @Get()
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'List all custom field definitions in a workspace' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiOkResponse({ description: 'Field definitions retrieved' })
  async listDefs(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<CardFieldDef[]> {
    return this.fieldService.listDefs(workspaceId);
  }

  /**
   * Updates a field definition.
   */
  @Patch(':fieldId')
  @WorkspaceAuth('owner', 'admin')
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
  @ApiOkResponse({ description: 'Field definition updated' })
  @ApiResponse({ status: 404, description: 'Field definition not found' })
  @ApiResponse({ status: 409, description: 'Field name already exists' })
  async updateDef(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() dto: UpdateFieldDefDto,
  ): Promise<CardFieldDef> {
    return this.fieldService.updateDef(workspaceId, fieldId, dto);
  }

  /**
   * Deletes a field definition.
   */
  @Delete(':fieldId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin')
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
