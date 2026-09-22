import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileAttachment, WorkspaceRole } from '@prisma/client';
import { FileRepository } from '../repositories/file.repository';
import { S3Service } from './s3.service';
import {
  ALLOWED_MIME_TYPES,
  SUPPORTED_ENTITY_TYPES,
  type FileEntityType,
} from '../constants/file.constants';
import type {
  PresignedUploadResult,
  RequestUploadInput,
} from '../interfaces/file.interfaces';
import { buildS3Key } from '../utils/file-key.util';
import { WorkspaceMemberRepository } from '../../workspace/repositories/workspace-member.repository';
import { MembershipService } from '../../workspace/services/membership.service';
import { CardRepository } from '../../board/card/repositories/card.repository';
import { DocumentService } from '../../document/services/document.service';
import {
  AppException,
  BusinessRuleException,
  EntityNotFoundException,
} from '../../../common/exceptions/app.exception';

/**
 * Business logic for 2-phase S3 file uploads bound to cards or documents.
 * Guards enforce route-level roles; this service re-verifies workspace
 * membership and ownership so direct callers stay safe.
 */
@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private readonly fileRepo: FileRepository,
    private readonly s3: S3Service,
    private readonly config: ConfigService,
    private readonly membershipService: MembershipService,
    private readonly memberRepo: WorkspaceMemberRepository,
    private readonly cardRepo: CardRepository,
    private readonly documentService: DocumentService,
  ) {}

  /**
   * Verifies that a user is a member of the workspace.
   *
   * @param workspaceId - Workspace UUID
   * @param userId - User UUID
   * @returns The member's role
   * @throws {EntityNotFoundException} If the workspace does not exist
   * @throws {ForbiddenException} If the user is not a workspace member
   */
  private async requireMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceRole> {
    await this.membershipService.requireWorkspace(workspaceId);
    const member = await this.memberRepo.findMember(workspaceId, userId);
    if (!member) {
      throw new ForbiddenException('FORBIDDEN');
    }
    return member.role;
  }

  /**
   * Verifies that the hosting entity exists (and, for documents, lives in
   * the given workspace). Card existence is checked without workspace
   * scoping — the route workspace owns the created row.
   *
   * @param workspaceId - Owning workspace UUID
   * @param entityType - Hosting entity type
   * @param entityId - Hosting entity UUID
   * @throws {AppException} 400 when the entity type is unsupported
   * @throws {EntityNotFoundException} When the host entity does not exist
   */
  private async verifyHostExists(
    workspaceId: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    if (!(SUPPORTED_ENTITY_TYPES as readonly string[]).includes(entityType)) {
      throw new AppException(
        'VALIDATION_ERROR',
        `Unsupported entity type: ${entityType}`,
        400,
      );
    }
    if (entityType === 'card') {
      const card = await this.cardRepo.findActiveById(entityId);
      if (!card) {
        throw new EntityNotFoundException('Card', entityId);
      }
      return;
    }
    await this.documentService.findById(entityId, workspaceId);
  }

  /**
   * Validates an upload request, creates a pending row, and returns a
   * presigned PUT URL for direct-to-S3 upload.
   *
   * @param workspaceId - Owning workspace UUID
   * @param dto - Upload request data (pre-sanitized by DTO)
   * @param userId - Requesting user UUID
   * @returns Pending file identifiers plus the PUT target
   * @throws {ForbiddenException} If the user is not a workspace member
   * @throws {BusinessRuleException} MIME_NOT_ALLOWED or FILE_TOO_LARGE
   * @throws {EntityNotFoundException} If the host entity does not exist
   */
  async requestUpload(
    workspaceId: string,
    dto: RequestUploadInput,
    userId: string,
  ): Promise<PresignedUploadResult> {
    this.logger.debug(`Requesting upload in workspace ${workspaceId}`, {
      dto,
      userId,
    });
    await this.requireMembership(workspaceId, userId);
    await this.verifyHostExists(workspaceId, dto.entityType, dto.entityId);

    if (!ALLOWED_MIME_TYPES.has(dto.mimeType)) {
      throw new BusinessRuleException(
        'MIME_NOT_ALLOWED',
        `MIME type ${dto.mimeType} is not allowed`,
        { mimeType: dto.mimeType },
      );
    }
    const maxSize = this.config.get<number>('MAX_FILE_SIZE_BYTES', 26214400);
    if (dto.fileSize < 1 || dto.fileSize > maxSize) {
      throw new BusinessRuleException(
        'FILE_TOO_LARGE',
        `File size must be between 1 and ${maxSize} bytes`,
        { fileSize: dto.fileSize, maxSize },
      );
    }

    const s3Key = buildS3Key(
      workspaceId,
      dto.entityType,
      dto.entityId,
      dto.fileName,
    );
    const expiresIn = this.config.get<number>(
      'S3_PRESIGN_EXPIRES_SECONDS',
      3600,
    );
    const uploadUrl = await this.s3.createPresignedPut(
      s3Key,
      dto.mimeType,
      expiresIn,
    );
    const row = await this.fileRepo.createPending({
      workspaceId,
      uploadedBy: userId,
      s3Bucket: this.s3.getBucket(),
      s3Key,
      originalName: dto.fileName,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      entityType: dto.entityType,
      entityId: dto.entityId,
      status: 'pending',
    });

    this.logger.log('Upload requested successfully', {
      fileId: row.id,
      workspaceId,
      userId,
    });
    return { fileId: row.id, uploadUrl, s3Key, expiresIn };
  }

  /**
   * Confirms a pending upload as completed. Idempotent for completed rows.
   *
   * @param fileId - File UUID
   * @param userId - Confirming user UUID (owner or workspace admin+)
   * @returns The completed row
   * @throws {EntityNotFoundException} If the file does not exist
   * @throws {ForbiddenException} If the user is neither owner nor admin+
   * @throws {BusinessRuleException} If the upload is not confirmable
   */
  async confirm(fileId: string, userId: string): Promise<FileAttachment> {
    const row = await this.fileRepo.findActiveById(fileId);
    if (!row) {
      throw new EntityNotFoundException('FileAttachment', fileId);
    }
    const role = await this.requireMembership(row.workspaceId, userId);
    const isOwner = row.uploadedBy === userId;
    const isAdmin =
      role === WorkspaceRole.owner || role === WorkspaceRole.admin;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('FORBIDDEN');
    }
    if (row.status === 'completed') {
      return row;
    }
    if (row.status !== 'pending') {
      throw new BusinessRuleException(
        'INVALID_FILE_STATUS',
        `Upload with status ${row.status} cannot be confirmed`,
        { status: row.status },
      );
    }
    const confirmed = await this.fileRepo.confirm(fileId);
    this.logger.log('Upload confirmed successfully', { fileId, userId });
    return confirmed;
  }

  /**
   * Returns a presigned GET URL for downloading file bytes.
   * Any workspace member (viewer+) may download.
   *
   * @param fileId - File UUID
   * @param userId - Downloading user UUID
   * @returns Presigned download URL plus validity
   * @throws {EntityNotFoundException} If the file does not exist
   * @throws {ForbiddenException} If the user is not a workspace member
   */
  async download(
    fileId: string,
    userId: string,
  ): Promise<{ downloadUrl: string; expiresIn: number }> {
    const row = await this.fileRepo.findActiveById(fileId);
    if (!row || row.status !== 'completed') {
      throw new EntityNotFoundException('FileAttachment', fileId);
    }
    await this.requireMembership(row.workspaceId, userId);
    const expiresIn = this.config.get<number>(
      'S3_PRESIGN_EXPIRES_SECONDS',
      3600,
    );
    const downloadUrl = await this.s3.createPresignedGet(row.s3Key, expiresIn);
    return { downloadUrl, expiresIn };
  }

  /**
   * Lists active files for a hosting entity, newest first.
   * Collections per entity are naturally bounded, so no pagination.
   *
   * @param entityType - Hosting entity type
   * @param entityId - Hosting entity UUID
   * @param userId - Requesting user UUID
   * @param workspaceId - Owning workspace UUID (verified for membership)
   * @returns Active file rows newest first
   * @throws {ForbiddenException} If the user is not a workspace member
   */
  async listForEntity(
    entityType: FileEntityType,
    entityId: string,
    userId: string,
    workspaceId: string,
  ): Promise<FileAttachment[]> {
    await this.requireMembership(workspaceId, userId);
    const rows = await this.fileRepo.listForEntity(entityType, entityId);
    return rows.filter((row) => row.workspaceId === workspaceId);
  }

  /**
   * Archives a file (uploader-or-admin). S3 deletion is best-effort: the
   * DB archive wins even if the object delete fails.
   *
   * @param fileId - File UUID
   * @param userId - Deleting user UUID (uploader or workspace admin+)
   * @returns Promise resolving when archived
   * @throws {EntityNotFoundException} If the file does not exist
   * @throws {ForbiddenException} If the user is neither uploader nor admin+
   */
  async delete(fileId: string, userId: string): Promise<void> {
    const row = await this.fileRepo.findActiveById(fileId);
    if (!row) {
      throw new EntityNotFoundException('FileAttachment', fileId);
    }
    const role = await this.requireMembership(row.workspaceId, userId);
    const isUploader = row.uploadedBy === userId;
    const isAdmin =
      role === WorkspaceRole.owner || role === WorkspaceRole.admin;
    if (!isUploader && !isAdmin) {
      throw new ForbiddenException('FORBIDDEN');
    }
    await this.fileRepo.archive(fileId);
    try {
      await this.s3.deleteObject(row.s3Key);
    } catch (error) {
      this.logger.warn(`S3 object delete failed for file ${fileId}`, {
        error: (error as Error).message,
      });
    }
    this.logger.log('File archived successfully', { fileId, userId });
  }
}
