import { randomUUID } from 'crypto';
import { FILE_NAME_MAX_LENGTH } from '../constants/file.constants';
import type { FileEntityType } from '../interfaces/file.interfaces';

/**
 * Sanitizes a user-supplied file name for safe S3 key embedding.
 * Strips directory components, replaces unsafe chars with `_`, truncates,
 * and never returns an empty string.
 *
 * @param fileName - Raw user-supplied file name
 * @returns Sanitized file name (1..FILE_NAME_MAX_LENGTH chars)
 */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, FILE_NAME_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : 'file';
}

/**
 * Builds the canonical S3 object key for an attachment.
 *
 * @param workspaceId - Owning workspace UUID
 * @param entityType - Hosting entity type
 * @param entityId - Hosting entity UUID
 * @param fileName - Raw user-supplied file name (sanitized inline)
 * @returns Namespaced S3 key
 */
export function buildS3Key(
  workspaceId: string,
  entityType: FileEntityType,
  entityId: string,
  fileName: string,
): string {
  const safe = sanitizeFileName(fileName);
  const suffix = randomUUID().slice(0, 8);
  return `workspaces/${workspaceId}/${entityType}s/${entityId}/${suffix}-${safe}`;
}
