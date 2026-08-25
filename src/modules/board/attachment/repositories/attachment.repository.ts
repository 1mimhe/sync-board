import { Injectable } from '@nestjs/common';
import { CardAttachment, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import type { CardAttachmentWithUser } from '../../board/interfaces/board.interfaces';

const AUTHOR_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
};

/**
 * Repository handling database operations for card attachments (files, images, links).
 */
@Injectable()
export class CardAttachmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new card attachment and returns it with uploader user profile details.
   *
   * @param data - Attachment creation payload
   * @returns The created attachment with uploader details
   */
  async create(
    data: Prisma.CardAttachmentUncheckedCreateInput,
  ): Promise<CardAttachmentWithUser> {
    return this.prisma.cardAttachment.create({
      data,
      include: {
        uploadedBy: { select: AUTHOR_SELECT },
      },
    });
  }

  /**
   * Finds an active (non-archived) attachment by ID with uploader details.
   *
   * @param id - Attachment UUID
   * @returns The attachment with uploader details or null if not found
   */
  async findById(id: string): Promise<CardAttachmentWithUser | null> {
    return this.prisma.cardAttachment.findFirst({
      where: { id, archivedAt: null },
      include: {
        uploadedBy: { select: AUTHOR_SELECT },
      },
    });
  }

  /**
   * Finds all active attachments for a card ordered newest first.
   *
   * @param cardId - Card UUID
   * @returns Array of attachments with uploader details
   */
  async findByCardId(cardId: string): Promise<CardAttachmentWithUser[]> {
    return this.prisma.cardAttachment.findMany({
      where: { cardId, archivedAt: null },
      include: {
        uploadedBy: { select: AUTHOR_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Updates an attachment's metadata or URL.
   *
   * @param id - Attachment UUID
   * @param data - Update payload
   * @returns The updated attachment with uploader details
   */
  async update(
    id: string,
    data: Prisma.CardAttachmentUpdateInput,
  ): Promise<CardAttachmentWithUser> {
    return this.prisma.cardAttachment.update({
      where: { id },
      data,
      include: {
        uploadedBy: { select: AUTHOR_SELECT },
      },
    });
  }

  /**
   * Soft-deletes an attachment by setting `archivedAt`.
   *
   * @param id - Attachment UUID
   * @returns The archived attachment with uploader details
   */
  async archive(id: string): Promise<CardAttachmentWithUser> {
    return this.prisma.cardAttachment.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: {
        uploadedBy: { select: AUTHOR_SELECT },
      },
    });
  }

  /**
   * Permanently deletes an attachment record.
   *
   * @param id - Attachment UUID
   * @returns The deleted attachment
   */
  async delete(id: string): Promise<CardAttachment> {
    return this.prisma.cardAttachment.delete({
      where: { id },
    });
  }
}
