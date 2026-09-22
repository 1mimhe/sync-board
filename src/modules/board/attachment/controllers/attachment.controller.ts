import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CardAttachmentResponseDto } from '../dto/card-attachment-response.dto';
import { toLegacyCardAttachmentResponseDto } from '../../../file/mappers/file.mapper';
import { FileService } from '../../../file/services/file.service';
import { BoardRepository } from '../../core/repositories/board.repository';
import { CardRepository } from '../../card/repositories/card.repository';
import {
  assertBoardInWorkspace,
  assertCardInBoard,
} from '../../shared/board-access.util';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

/**
 * Read-only proxy over S3-backed files, preserving the legacy
 * card-attachments listing route for existing clients.
 * Create/update/delete moved to `/workspaces/:workspaceId/files/*`.
 */
@ApiTags('Card Attachments')
@Controller('workspaces/:workspaceId/boards/:boardId/cards/:cardId/attachments')
export class CardAttachmentController {
  constructor(
    private readonly fileService: FileService,
    private readonly boardRepo: BoardRepository,
    private readonly cardRepo: CardRepository,
  ) {}

  /**
   * Lists migrated file attachments on a card in the legacy shape.
   * Bytes are served via `GET /workspaces/:workspaceId/files/:fileId/download`,
   * so `url` is intentionally empty.
   */
  @Get()
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({
    summary:
      'List card attachments (legacy shape; create/update moved to /files/*)',
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
    description: 'List of card attachments',
    type: [CardAttachmentResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async list(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CardAttachmentResponseDto[]> {
    await assertBoardInWorkspace(this.boardRepo, boardId, workspaceId);
    await assertCardInBoard(this.cardRepo, cardId, boardId);
    const files = await this.fileService.listForEntity(
      'card',
      cardId,
      user.sub,
      workspaceId,
    );
    return files.map((file) => toLegacyCardAttachmentResponseDto(file, cardId));
  }
}
