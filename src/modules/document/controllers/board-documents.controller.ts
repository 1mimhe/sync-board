import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';
import { DocumentService } from '../services/document.service';
import { DocumentResponseDto } from '../dto';
import { toDocumentResponseDto } from '../mappers/document.mapper';
import { WorkspaceAuth } from '../../workspace/decorators/workspace-auth.decorator';

/**
 * Controller exposing the list of documents associated with a board
 * (specifically documents attached to any card on this board).
 */
@ApiTags('Documents')
@Controller('workspaces/:workspaceId/boards/:boardId/documents')
export class BoardDocumentsController {
  constructor(private readonly documentService: DocumentService) {}

  /**
   * Lists all active documents linked to cards in a board, newest activity first.
   */
  @Get()
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({
    summary: 'List documents for a board, including all attached card docs',
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
  @ApiOkResponse({
    type: [DocumentResponseDto],
    description: 'Documents linked to cards on the board',
  })
  async listByBoard(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
  ): Promise<DocumentResponseDto[]> {
    const documents = await this.documentService.listByBoard(
      workspaceId,
      boardId,
    );
    return documents.map(toDocumentResponseDto);
  }
}
