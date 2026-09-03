import {
  Controller,
  Get,
  Post,
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
  ApiParam,
} from '@nestjs/swagger';
import { SnapshotService } from '../services/snapshot.service';
import {
  CreateSnapshotDto,
  SnapshotResponseDto,
  DocumentResponseDto,
} from '../dto';
import {
  toDocumentResponseDto,
  toSnapshotResponseDto,
} from '../mappers/document.mapper';
import { WorkspaceAuth } from '../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

/**
 * Controller exposing document snapshot endpoints: capture, history, restore.
 */
@ApiTags('Documents')
@Controller('workspaces/:workspaceId/documents/:documentId/snapshots')
export class DocumentSnapshotController {
  constructor(private readonly snapshotService: SnapshotService) {}

  /**
   * Captures the document's current CRDT state as a snapshot.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth('owner', 'admin', 'member')
  @ApiOperation({ summary: 'Create a snapshot of the document content' })
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
  @ApiCreatedResponse({
    type: SnapshotResponseDto,
    description: 'Snapshot created successfully',
  })
  async create(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSnapshotDto,
  ): Promise<SnapshotResponseDto> {
    const snapshot = await this.snapshotService.create(
      documentId,
      dto,
      user.sub,
    );
    return toSnapshotResponseDto(snapshot);
  }

  /**
   * Lists the document's snapshots, newest first (metadata only).
   */
  @Get()
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'List document snapshots' })
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
    type: [SnapshotResponseDto],
    description: 'Snapshot history of the document',
  })
  async list(
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<SnapshotResponseDto[]> {
    const snapshots = await this.snapshotService.list(documentId);
    return snapshots.map(toSnapshotResponseDto);
  }

  /**
   * Restores a snapshot's content into the live document (owner/admin only).
   */
  @Post(':snapshotId/restore')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth('owner', 'admin')
  @ApiOperation({ summary: 'Restore a snapshot into the live document' })
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
  @ApiParam({
    name: 'snapshotId',
    type: String,
    format: 'uuid',
    description: 'Snapshot UUID',
  })
  @ApiOkResponse({
    type: DocumentResponseDto,
    description: 'Snapshot restored successfully',
  })
  async restore(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('snapshotId', ParseUUIDPipe) snapshotId: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.snapshotService.restore(documentId, snapshotId);
    return toDocumentResponseDto(document);
  }
}
