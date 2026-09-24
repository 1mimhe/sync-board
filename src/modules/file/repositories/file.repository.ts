import { Injectable } from '@nestjs/common';
import { FileAttachment, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import type { FileEntityType } from '../interfaces/file.interfaces';

/**
 * Repository handling database operations for S3-backed file attachments.
 */
@Injectable()
export class FileRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a pending file attachment row for a 2-phase upload.
   *
   * @param data - Pending row payload
   * @returns The created pending row
   */
  async createPending(
    data: Prisma.FileAttachmentUncheckedCreateInput,
  ): Promise<FileAttachment> {
    return this.prisma.fileAttachment.create({ data });
  }

  /**
   * Finds an active (non-archived) file by ID.
   *
   * @param id - File UUID
   * @returns The file row or null if not found or archived
   */
  async findActiveById(id: string): Promise<FileAttachment | null> {
    return this.prisma.fileAttachment.findFirst({
      where: { id, archivedAt: null },
    });
  }

  /**
   * Transitions a pending row to completed.
   *
   * @param id - File UUID
   * @returns The completed row
   */
  async confirm(id: string): Promise<FileAttachment> {
    return this.prisma.fileAttachment.update({
      where: { id },
      data: { status: 'completed' },
    });
  }

  /**
   * Marks stale pending uploads as failed.
   *
   * @param cutoff - Rows created before this date are failed
   * @returns Number of rows marked failed
   */
  async markStalePendingAsFailed(cutoff: Date): Promise<number> {
    const result = await this.prisma.fileAttachment.updateMany({
      where: { status: 'pending', createdAt: { lt: cutoff } },
      data: { status: 'failed' },
    });
    return result.count;
  }

  /**
   * Lists active files for a hosting entity, newest first.
   *
   * @param entityType - Hosting entity type
   * @param entityId - Hosting entity UUID
   * @returns Active file rows ordered newest first
   */
  async listForEntity(
    entityType: FileEntityType,
    entityId: string,
  ): Promise<FileAttachment[]> {
    return this.prisma.fileAttachment.findMany({
      where: { entityType, entityId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Archives a file row (restorable soft-delete; bytes stay in S3).
   *
   * @param id - File UUID
   * @returns The archived row
   */
  async archive(id: string): Promise<FileAttachment> {
    return this.prisma.fileAttachment.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }
}
