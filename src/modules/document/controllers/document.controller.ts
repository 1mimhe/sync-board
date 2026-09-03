import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import type {
  DocumentMetadata,
  DocumentWithParentCard,
} from '../repositories/document.repository';
import { DocumentService } from '../services/document.service';
import {
  CreateDocumentDto,
  RenameDocumentDto,
  SearchDocumentsDto,
  DocumentResponseDto,
  PaginatedDocumentsResponseDto,
  CursorPaginationQueryDto,
} from '../dto';
import { toDocumentResponseDto } from '../mappers/document.mapper';
import { WorkspaceAuth } from '../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import type { PaginatedResult } from '../../../common/interfaces/pagination.interface';

/**
 * Controller exposing REST endpoints for workspace document CRUD and search.
 */
@ApiTags('Documents')
@Controller('workspaces/:workspaceId/documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  /**
   * Creates a new document in the workspace.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Create a new collaborative document' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiCreatedResponse({
    type: DocumentResponseDto,
    description: 'Document created successfully',
  })
  async create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.create(
      workspaceId,
      dto,
      user.sub,
    );
    return toDocumentResponseDto(document);
  }

  /**
   * Lists or full-text searches active workspace documents (cursor page).
   */
  @Get()
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({
    summary:
      'List workspace documents (cursor pagination, optional ?search= full-text)',
  })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    type: PaginatedDocumentsResponseDto,
    description: 'Paginated documents: { items, pagination }',
  })
  async list(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() query: SearchDocumentsDto,
  ): Promise<PaginatedDocumentsResponseDto> {
    const result = await this.documentService.listInWorkspace(
      workspaceId,
      query,
    );
    return this.toPaginatedResponse(result);
  }

  /**
   * Fetches a single active document.
   */
  @Get(':documentId')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'Get a single active document' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiParam({
    name: 'documentId',
    type: String,
    format: 'uuid',
    description: 'Document UUID',
  })
  @ApiOkResponse({
    type: DocumentResponseDto,
    description: 'Document retrieved successfully',
  })
  async get(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.findById(
      documentId,
      workspaceId,
    );
    return toDocumentResponseDto(document);
  }

  /**
   * Renames a document.
   */
  @Patch(':documentId')
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Rename a document' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiParam({
    name: 'documentId',
    type: String,
    format: 'uuid',
    description: 'Document UUID',
  })
  @ApiOkResponse({
    type: DocumentResponseDto,
    description: 'Document renamed successfully',
  })
  async rename(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RenameDocumentDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentService.rename(
      documentId,
      dto,
      user.sub,
      workspaceId,
    );
    return toDocumentResponseDto(document);
  }

  /**
   * Archives a document (soft lifecycle; no content deletion).
   */
  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Archive a document' })
  @ApiParam({
    name: 'workspaceId',
    type: String,
    format: 'uuid',
    description: 'Workspace UUID',
  })
  @ApiParam({
    name: 'documentId',
    type: String,
    format: 'uuid',
    description: 'Document UUID',
  })
  @ApiNoContentResponse({ description: 'Document archived successfully' })
  async archive(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.documentService.archive(documentId, user.sub, workspaceId);
  }

  /**
   * Maps a service-level paginated result to the public response envelope.
   */
  private toPaginatedResponse(
    result: PaginatedResult<DocumentWithParentCard>,
  ): PaginatedDocumentsResponseDto {
    return {
      items: result.items.map(toDocumentResponseDto),
      pagination: result.pagination,
    };
  }
}
