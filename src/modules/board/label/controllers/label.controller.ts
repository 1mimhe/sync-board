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
import {
  CreateLabelDto,
  UpdateLabelDto,
  BoardLabelResponseDto,
} from '../dto';
import { toBoardLabelResponseDto } from '../../board/mappers/board.mapper';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';

/**
 * Controller exposing REST endpoints for managing board labels.
 * Mounted under `boards/:boardId` so route URLs are identical to the
 * pre-refactor paths previously served by BoardController.
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
    const label = await this.labelService.createLabel(
      boardId,
      workspaceId,
      dto,
    );
    return toBoardLabelResponseDto(label);
  }

  /**
   * Lists all labels available for a board.
   */
  @Get('labels')
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
  async getLabelsForBoard(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
  ): Promise<BoardLabelResponseDto[]> {
    const labels = await this.labelService.getLabelsForBoard(
      boardId,
      workspaceId,
    );
    return labels.map(toBoardLabelResponseDto);
  }

  /**
   * Updates a board-scoped label's name or color.
   */
  @Patch('labels/:labelId')
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
    const label = await this.labelService.updateLabel(
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
  @Delete('labels/:labelId')
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
    await this.labelService.deleteLabel(boardId, workspaceId, labelId);
  }
}
