import { ApiProperty } from '@nestjs/swagger';
import { AttachmentStatus } from '@prisma/client';
import { SUPPORTED_ENTITY_TYPES } from '../constants/file.constants';

/**
 * Response DTO representing a stored file attachment.
 */
export class FileResponseDto {
  @ApiProperty({ description: 'File UUID' })
  id!: string;

  @ApiProperty({ description: 'Original file name' })
  originalName!: string;

  @ApiProperty({ description: 'File MIME type' })
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes' })
  fileSize!: number;

  @ApiProperty({
    description: 'Hosting entity type',
    enum: SUPPORTED_ENTITY_TYPES,
  })
  entityType!: string;

  @ApiProperty({ description: 'Hosting entity UUID' })
  entityId!: string;

  @ApiProperty({
    description: 'Upload lifecycle status',
    enum: AttachmentStatus,
  })
  status!: AttachmentStatus;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;
}

/**
 * Response DTO returned after requesting a presigned upload URL.
 */
export class PresignedUploadResponseDto {
  @ApiProperty({ description: 'Pending file UUID for the confirm step' })
  fileId!: string;

  @ApiProperty({ description: 'Presigned PUT URL for direct-to-S3 upload' })
  uploadUrl!: string;

  @ApiProperty({ description: 'S3 object key' })
  s3Key!: string;

  @ApiProperty({ description: 'URL validity in seconds' })
  expiresIn!: number;
}

/**
 * Response DTO returned after confirming an upload completed.
 */
export class ConfirmUploadResponseDto {
  @ApiProperty({ description: 'Confirmed file UUID' })
  fileId!: string;

  @ApiProperty({
    description: 'Upload lifecycle status',
    enum: AttachmentStatus,
  })
  status!: AttachmentStatus;
}

/**
 * Response DTO carrying a presigned download URL.
 */
export class FileDownloadResponseDto {
  @ApiProperty({ description: 'Presigned GET URL for downloading bytes' })
  downloadUrl!: string;

  @ApiProperty({ description: 'URL validity in seconds' })
  expiresIn!: number;
}
