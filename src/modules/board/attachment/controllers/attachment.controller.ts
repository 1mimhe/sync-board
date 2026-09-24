import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CardAttachmentResponseDto } from '../dto/card-attachment-response.dto';
import { toCardAttachmentResponseDto } from '../../../file/mappers/file.mapper';
import { FileService } from '../../../file/services/file.service';
import { BoardRepository } from '../../core/repositories/board.repository';
import { CardRepository } from '../../card/repositories/card.repository';
import {
  assertBoardInWorkspace,
  assertCardInBoard,
} from '../../utils/board-access.util';
import { WorkspaceAuth } from '../../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import { WORKSPACE_READ_ROLES } from '../../../../common/guards/rbac.constants';

/**
 * Controller exposing card-scoped attachment listing.
 * Direct file management is handled under `/workspaces/:workspaceId/files/*`.
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
   * Lists file attachments on a card.
   * Bytes are served via `GET /workspaces/:workspaceId/files/:fileId/download`.
   */
  @Get()
  @WorkspaceAuth(...WORKSPACE_READ_ROLES)
  @ApiOperation({
    summary: 'List card attachments',
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
    return files.map((file) => toCardAttachmentResponseDto(file, cardId));
  }
}
