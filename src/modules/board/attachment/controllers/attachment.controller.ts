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
import { CardAttachmentService } from '../services/attachment.service';
import {
  CreateCardAttachmentDto,
  UpdateCardAttachmentDto,
  CardAttachmentResponseDto,
} from '../dto';
import { toCardAttachmentResponseDto } from '../../board/mappers/board.mapper';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

/**
 * Controller exposing REST endpoints for managing card attachments (files, images, links).
 */
@ApiTags('Card Attachments')
@Controller('workspaces/:workspaceId/boards/:boardId/cards/:cardId/attachments')
export class CardAttachmentController {
  constructor(private readonly attachmentService: CardAttachmentService) {}

  /**
   * Attaches a file, image, or link to a card.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Attach a file, image, or link to a card' })
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
    description: 'Attachment created successfully',
    type: CardAttachmentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: CreateCardAttachmentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CardAttachmentResponseDto> {
    const attachment = await this.attachmentService.addAttachment(
      boardId,
      workspaceId,
      cardId,
      dto,
      user.sub,
    );
    return toCardAttachmentResponseDto(attachment);
  }

  /**
   * Lists all attachments on a card.
   */
  @Get()
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'List all attachments on a card' })
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
    description: 'List of card attachments',
    type: [CardAttachmentResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async list(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<CardAttachmentResponseDto[]> {
    const attachments = await this.attachmentService.getAttachments(
      boardId,
      workspaceId,
      cardId,
    );
    return attachments.map(toCardAttachmentResponseDto);
  }

  /**
   * Updates an attachment's metadata or URL.
   */
  @Patch(':attachmentId')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Update attachment metadata or URL' })
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
    name: 'attachmentId',
    type: String,
    format: 'uuid',
    description: 'Attachment UUID',
  })
  @ApiOkResponse({
    description: 'Attachment updated',
    type: CardAttachmentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body() dto: UpdateCardAttachmentDto,
  ): Promise<CardAttachmentResponseDto> {
    const attachment = await this.attachmentService.updateAttachment(
      boardId,
      workspaceId,
      cardId,
      attachmentId,
      dto,
    );
    return toCardAttachmentResponseDto(attachment);
  }

  /**
   * Permanently deletes an attachment from a card.
   */
  @Delete(':attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Delete attachment from card' })
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
    name: 'attachmentId',
    type: String,
    format: 'uuid',
    description: 'Attachment UUID',
  })
  @ApiNoContentResponse({ description: 'Attachment deleted' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async delete(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.attachmentService.deleteAttachment(
      boardId,
      workspaceId,
      cardId,
      attachmentId,
      user.sub,
    );
  }
}
