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
  ApiParam,
} from '@nestjs/swagger';
import { LabelService } from '../services/label.service';
import { CreateLabelDto, UpdateLabelDto, LabelResponseDto } from '../dto';
import { toLabelResponseDto } from '../../core/mappers/board.mapper';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import {
  WORKSPACE_READ_ROLES,
  WORKSPACE_WRITE_ROLES,
} from '../../../../common/guards/rbac.constants';

/**
 * Controller exposing REST endpoints for managing board labels.
 */
@ApiTags('Labels')
@Controller('workspaces/:workspaceId/boards/:boardId')
export class LabelController {
  constructor(private readonly labelService: LabelService) {}

  /**
   * Creates a board-scoped label.
   */
  @Post('labels')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(...WORKSPACE_WRITE_ROLES)
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
    type: LabelResponseDto,
  })
  async createLabel(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: CreateLabelDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LabelResponseDto> {
    const label = await this.labelService.createLabel(
      boardId,
      workspaceId,
      dto,
      user.sub,
    );
    return toLabelResponseDto(label);
  }

  /**
   * Lists all labels available for a board.
   */
  @Get('labels')
  @WorkspaceAuth(...WORKSPACE_READ_ROLES)
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
    type: [LabelResponseDto],
  })
  async getLabelsForBoard(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
  ): Promise<LabelResponseDto[]> {
    const labels = await this.labelService.getLabelsForBoard(
      boardId,
      workspaceId,
    );
    return labels.map(toLabelResponseDto);
  }

  /**
   * Updates a board-scoped label's name or color.
   */
  @Patch('labels/:labelId')
  @WorkspaceAuth(...WORKSPACE_WRITE_ROLES)
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
  @ApiOkResponse({ description: 'Label updated', type: LabelResponseDto })
  async updateLabel(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
    @Body() dto: UpdateLabelDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LabelResponseDto> {
    const label = await this.labelService.updateLabel(
      boardId,
      workspaceId,
      labelId,
      dto,
      user.sub,
    );
    return toLabelResponseDto(label);
  }

  /**
   * Deletes a board label.
   */
  @Delete('labels/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(...WORKSPACE_WRITE_ROLES)
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
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.labelService.deleteLabel(
      boardId,
      workspaceId,
      labelId,
      user.sub,
    );
  }
}
