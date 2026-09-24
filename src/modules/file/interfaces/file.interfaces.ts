import type { SUPPORTED_ENTITY_TYPES } from '../constants/file.constants';

/** Entity types that can host a file attachment. */
export type FileEntityType = (typeof SUPPORTED_ENTITY_TYPES)[number];

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
