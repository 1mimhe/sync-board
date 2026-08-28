import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CardRepository } from '../../card/repositories/card.repository';
import { BoardRepository } from '../../board/repositories/board.repository';
import { CardAttachmentRepository } from '../repositories/attachment.repository';
import { CreateCardAttachmentDto, UpdateCardAttachmentDto } from '../dto';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';
import {
  AttachmentCreatedEvent,
  AttachmentDeletedEvent,
} from '../events/attachment.events';
import { ATTACHMENT_EVENTS } from '../events/attachment-events.constants';
import type { CardAttachmentWithUser } from '../../board/interfaces/board.interfaces';

/**
 * Service managing card attachments (uploaded files, preview thumbnails, external links).
 */
@Injectable()
export class CardAttachmentService {
  private readonly logger = new Logger(CardAttachmentService.name);

  constructor(
    private readonly cardRepo: CardRepository,
    private readonly boardRepo: BoardRepository,
    private readonly attachmentRepo: CardAttachmentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Verifies that a board exists within the given workspace and is active.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @throws {EntityNotFoundException} If board is not found or archived
   */
  private async verifyBoardInWorkspace(
    boardId: string,
    workspaceId: string,
  ): Promise<void> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }
  }

  /**
   * Adds an attachment to a card and emits `attachment.created` event.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param dto - Attachment creation data
   * @param userId - Creating/uploading user UUID
   * @returns The created attachment with uploader details
   * @throws {EntityNotFoundException} If board or card is not found
   * @emits attachment.created - After successful creation
   */
  async addAttachment(
    boardId: string,
    workspaceId: string,
    cardId: string,
    dto: CreateCardAttachmentDto,
    userId: string,
  ): Promise<CardAttachmentWithUser> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const attachment = await this.attachmentRepo.create({
      cardId,
      uploadedById: userId,
      type: dto.type,
      url: dto.url,
      name: dto.name,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      coverUrl: dto.coverUrl,
    });

    this.eventEmitter.emit(
      ATTACHMENT_EVENTS.created,
      new AttachmentCreatedEvent(attachment, boardId, userId),
    );

    this.logger.log(
      `Attachment created: ${attachment.id} (${attachment.type}) on card ${cardId} by user ${userId}`,
    );
    return attachment;
  }

  /**
   * Retrieves all attachments associated with a card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @returns Array of attachments with uploader details
   * @throws {EntityNotFoundException} If board or card is not found
   */
  async getAttachments(
    boardId: string,
    workspaceId: string,
    cardId: string,
  ): Promise<CardAttachmentWithUser[]> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    return this.attachmentRepo.findByCardId(cardId);
  }

  /**
   * Updates an existing attachment's metadata or URL.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param attachmentId - Attachment UUID
   * @param dto - Update data
   * @returns The updated attachment
   * @throws {EntityNotFoundException} If board, card, or attachment is not found
   */
  async updateAttachment(
    boardId: string,
    workspaceId: string,
    cardId: string,
    attachmentId: string,
    dto: UpdateCardAttachmentDto,
  ): Promise<CardAttachmentWithUser> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment || attachment.cardId !== cardId) {
      throw new EntityNotFoundException('CardAttachment', attachmentId);
    }

    return this.attachmentRepo.update(attachmentId, {
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.url !== undefined && { url: dto.url }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.mimeType !== undefined && { mimeType: dto.mimeType }),
      ...(dto.fileSize !== undefined && { fileSize: dto.fileSize }),
      ...(dto.coverUrl !== undefined && { coverUrl: dto.coverUrl }),
    });
  }

  /**
   * Permanently deletes an attachment and emits `attachment.deleted` event.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param attachmentId - Attachment UUID to delete
   * @param userId - User UUID performing the deletion
   * @throws {EntityNotFoundException} If board, card, or attachment is not found
   * @emits attachment.deleted - After successful deletion
   */
  async deleteAttachment(
    boardId: string,
    workspaceId: string,
    cardId: string,
    attachmentId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    const attachment = await this.attachmentRepo.findById(attachmentId);
    if (!attachment || attachment.cardId !== cardId) {
      throw new EntityNotFoundException('CardAttachment', attachmentId);
    }

    await this.attachmentRepo.delete(attachmentId);

    this.eventEmitter.emit(
      ATTACHMENT_EVENTS.deleted,
      new AttachmentDeletedEvent(attachmentId, cardId, boardId, userId),
    );

    this.logger.log(
      `Attachment deleted: ${attachmentId} on card ${cardId} by user ${userId}`,
    );
  }
}
