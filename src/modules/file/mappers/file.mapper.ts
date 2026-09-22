import { FileAttachment } from '@prisma/client';
import {
  ConfirmUploadResponseDto,
  FileDownloadResponseDto,
  FileResponseDto,
  PresignedUploadResponseDto,
} from '../dto';
import type { PresignedUploadResult } from '../interfaces/file.interfaces';
import { CardAttachmentResponseDto } from '../../board/attachment/dto/card-attachment-response.dto';
import { AttachmentType } from '@prisma/client';

/**
 * Maps a FileAttachment entity to FileResponseDto.
 *
 * @param file - File attachment entity
 * @returns Mapped FileResponseDto
 */
export function toFileResponseDto(file: FileAttachment): FileResponseDto {
  return {
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    fileSize: file.fileSize,
    entityType: file.entityType,
    entityId: file.entityId,
    status: file.status,
    createdAt: file.createdAt,
  };
}

/**
 * Maps a presigned-upload result to PresignedUploadResponseDto.
 *
 * @param result - Upload identifiers plus PUT target
 * @returns Mapped PresignedUploadResponseDto
 */
export function toPresignedUploadResponseDto(
  result: PresignedUploadResult,
): PresignedUploadResponseDto {
  return {
    fileId: result.fileId,
    uploadUrl: result.uploadUrl,
    s3Key: result.s3Key,
    expiresIn: result.expiresIn,
  };
}

/**
 * Maps a confirmed row to ConfirmUploadResponseDto.
 *
 * @param file - Confirmed file attachment entity
 * @returns Mapped ConfirmUploadResponseDto
 */
export function toConfirmUploadResponseDto(
  file: FileAttachment,
): ConfirmUploadResponseDto {
  return { fileId: file.id, status: file.status };
}

/**
 * Maps a presigned download to FileDownloadResponseDto.
 *
 * @param downloadUrl - Presigned GET URL
 * @param expiresIn - URL validity in seconds
 * @returns Mapped FileDownloadResponseDto
 */
export function toFileDownloadResponseDto(
  downloadUrl: string,
  expiresIn: number,
): FileDownloadResponseDto {
  return { downloadUrl, expiresIn };
}

/**
 * Maps a FileAttachment to the legacy card-attachment shape for the
 * attachment proxy route. Bytes are served via files/download, so the
 * URL is intentionally empty.
 *
 * @param file - File attachment entity
 * @param cardId - Hosting card UUID
 * @returns Legacy-shaped CardAttachmentResponseDto
 */
export function toLegacyCardAttachmentResponseDto(
  file: FileAttachment,
  cardId: string,
): CardAttachmentResponseDto {
  return {
    id: file.id,
    cardId,
    uploadedBy: {
      id: file.uploadedBy,
      displayName: '',
      avatarUrl: null,
    },
    type: file.mimeType.startsWith('image/')
      ? AttachmentType.image
      : AttachmentType.file,
    url: '',
    name: file.originalName,
    mimeType: file.mimeType,
    fileSize: file.fileSize,
    coverUrl: null,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}
