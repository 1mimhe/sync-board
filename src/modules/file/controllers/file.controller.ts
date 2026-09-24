import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileService } from '../services/file.service';
import {
  ConfirmUploadResponseDto,
  FileDownloadResponseDto,
  PresignedUploadRequestDto,
  PresignedUploadResponseDto,
} from '../dto';
import {
  toConfirmUploadResponseDto,
  toFileDownloadResponseDto,
  toPresignedUploadResponseDto,
} from '../mappers/file.mapper';
import { WorkspaceAuth } from '../../workspace/decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import {
  WORKSPACE_READ_ROLES,
  WORKSPACE_WRITE_ROLES,
} from '../../../common/guards/rbac.constants';

/**
 * Controller exposing the 2-phase S3 upload flow for workspace files.
 */
@ApiTags('Files')
@Controller('workspaces/:workspaceId/files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * Validates an upload request and returns a presigned PUT URL.
   */
  @Post('presigned-upload')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(...WORKSPACE_WRITE_ROLES)
  @ApiOperation({ summary: 'Request a presigned upload URL' })
  @ApiParam({ name: 'workspaceId', type: String, format: 'uuid' })
  @ApiCreatedResponse({
    description: 'Presigned upload URL created',
    type: PresignedUploadResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Host entity not found' })
  @ApiResponse({
    status: 422,
    description: 'MIME not allowed or file too large',
  })
  async requestUpload(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: PresignedUploadRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PresignedUploadResponseDto> {
    const result = await this.fileService.requestUpload(
      workspaceId,
      dto,
      user.sub,
    );
    return toPresignedUploadResponseDto(result);
  }

  /**
   * Confirms a pending upload as completed after bytes reach S3.
   */
  @Post(':fileId/confirm')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(...WORKSPACE_WRITE_ROLES)
  @ApiOperation({ summary: 'Confirm an upload as completed' })
  @ApiParam({ name: 'workspaceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'fileId', type: String, format: 'uuid' })
  @ApiOkResponse({
    description: 'Upload confirmed',
    type: ConfirmUploadResponseDto,
  })
  @ApiResponse({ status: 404, description: 'File not found' })
  async confirm(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConfirmUploadResponseDto> {
    const file = await this.fileService.confirm(fileId, user.sub);
    return toConfirmUploadResponseDto(file);
  }

  /**
   * Returns a presigned GET URL for downloading file bytes.
   */
  @Get(':fileId/download')
  @WorkspaceAuth(...WORKSPACE_READ_ROLES)
  @ApiOperation({ summary: 'Get a presigned download URL' })
  @ApiParam({ name: 'workspaceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'fileId', type: String, format: 'uuid' })
  @ApiOkResponse({
    description: 'Presigned download URL',
    type: FileDownloadResponseDto,
  })
  @ApiResponse({ status: 404, description: 'File not found' })
  async download(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<FileDownloadResponseDto> {
    const { downloadUrl, expiresIn } = await this.fileService.download(
      fileId,
      user.sub,
    );
    return toFileDownloadResponseDto(downloadUrl, expiresIn);
  }

  /**
   * Archives a file (uploader-or-admin; enforced in the service).
   */
  @Delete(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(...WORKSPACE_WRITE_ROLES)
  @ApiOperation({ summary: 'Archive a file' })
  @ApiParam({ name: 'workspaceId', type: String, format: 'uuid' })
  @ApiParam({ name: 'fileId', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'File archived' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async delete(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.fileService.delete(fileId, user.sub);
  }
}
