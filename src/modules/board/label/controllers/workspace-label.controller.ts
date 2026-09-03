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
import { LabelService } from '../services/label.service';
import { CreateLabelDto, UpdateLabelDto, LabelResponseDto } from '../dto';
import { CardWithDetailsResponseDto } from '../../card/dto/card-response.dto';
import {
  toLabelResponseDto,
  toCardWithDetailsResponseDto,
} from '../../board/mappers/board.mapper';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

/**
 * Controller exposing workspace-scoped REST endpoints for managing labels.
 */
@ApiTags('Workspace Labels')
@Controller('workspaces/:workspaceId/labels')
export class WorkspaceLabelController {
  constructor(private readonly labelService: LabelService) {}

  /**
   * Creates a workspace-level label, optionally attaching it to an existing card.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Create a label in the workspace' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiCreatedResponse({
    description: 'Label created successfully',
    type: LabelResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async createWorkspaceLabel(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateLabelDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LabelResponseDto> {
    const label = await this.labelService.createWorkspaceLabel(
      workspaceId,
      dto,
      user?.sub,
    );
    return toLabelResponseDto(label);
  }

  /**
   * Lists all labels created within the workspace.
   */
  @Get()
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'List all labels in the workspace' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiOkResponse({
    description: 'Workspace labels retrieved successfully',
    type: [LabelResponseDto],
  })
  async getWorkspaceLabels(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<LabelResponseDto[]> {
    const labels = await this.labelService.getWorkspaceLabels(workspaceId);
    return labels.map(toLabelResponseDto);
  }

  /**
   * Retrieves all active cards tagged with a workspace label.
   */
  @Get(':labelId/cards')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'Get all active cards tagged with this label' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiParam({
    name: 'labelId',
    type: String,
    format: 'uuid',
    description: 'Label UUID',
  })
  @ApiOkResponse({
    description: 'Tagged cards retrieved successfully',
    type: [CardWithDetailsResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Label not found' })
  async getCardsForLabel(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ): Promise<CardWithDetailsResponseDto[]> {
    const cards = await this.labelService.getCardsForLabel(
      workspaceId,
      labelId,
    );
    return cards.map(toCardWithDetailsResponseDto);
  }

  /**
   * Updates a workspace label's name or color.
   */
  @Patch(':labelId')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Update a workspace label' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiParam({
    name: 'labelId',
    type: String,
    format: 'uuid',
    description: 'Label UUID',
  })
  @ApiOkResponse({
    description: 'Label updated successfully',
    type: LabelResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  async updateWorkspaceLabel(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
    @Body() dto: UpdateLabelDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LabelResponseDto> {
    const updated = await this.labelService.updateWorkspaceLabel(
      workspaceId,
      labelId,
      dto,
      user?.sub,
    );
    return toLabelResponseDto(updated);
  }

  /**
   * Permanently deletes a workspace label, removing it from all cards.
   */
  @Delete(':labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Delete a workspace label' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiParam({
    name: 'labelId',
    type: String,
    format: 'uuid',
    description: 'Label UUID',
  })
  @ApiNoContentResponse({ description: 'Label deleted successfully' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  async deleteWorkspaceLabel(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.labelService.deleteWorkspaceLabel(
      workspaceId,
      labelId,
      user?.sub,
    );
  }
}
