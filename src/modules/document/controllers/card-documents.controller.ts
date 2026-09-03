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
 * Controller exposing the list of documents linked to a card.
 * Naturally bounded per card, so this endpoint is intentionally unpaginated.
 */
@ApiTags('Documents')
@Controller('workspaces/:workspaceId/cards/:cardId/documents')
export class CardDocumentsController {
  constructor(private readonly documentService: DocumentService) {}

  /**
   * Lists all active documents linked to a card, newest activity first.
   */
  @Get()
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'List documents linked to a card' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiParam({
    name: 'cardId',
    type: String,
    format: 'uuid',
    description: 'Card UUID',
  })
  @ApiOkResponse({
    type: [DocumentResponseDto],
    description: 'Documents linked to the card',
  })
  async listByCard(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ): Promise<DocumentResponseDto[]> {
    const documents = await this.documentService.listByCard(
      workspaceId,
      cardId,
    );
    return documents.map(toDocumentResponseDto);
  }
}
