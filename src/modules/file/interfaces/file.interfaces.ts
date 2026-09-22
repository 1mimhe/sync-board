import type { FileEntityType } from '../constants/file.constants';

/**
 * Result of a presigned-upload request: identifiers plus the PUT target.
 */
export interface PresignedUploadResult {
  fileId: string;
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

/**
 * Input for requesting a presigned upload URL.
 */
export interface RequestUploadInput {
  fileName: string;
  mimeType: string;
  fileSize: number;
  entityType: FileEntityType;
  entityId: string;
}
