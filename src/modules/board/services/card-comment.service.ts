import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CardCommentRepository } from '../repositories/card-comment.repository';
import { CardRepository } from '../repositories/card.repository';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { UpdateCommentDto } from '../dto/update-comment.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { EntityNotFoundException } from '../../../common/exceptions/app.exception';
import { CommentCreatedEvent } from '../events/board.events';
import { COMMENT_EVENTS } from '../events/board-events.constants';
import type {
  CardCommentWithAuthor,
  PaginatedComments,
} from '../interfaces/board.interfaces';

/**
 * Service handling business logic for card comments (creation, pagination, author-only editing, soft deletion).
 */
@Injectable()
export class CardCommentService {
  private readonly logger = new Logger(CardCommentService.name);

  constructor(
    private readonly commentRepo: CardCommentRepository,
    private readonly cardRepo: CardRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Verifies that a card exists within a board and is active.
   *
   * @param boardId - Board UUID
   * @param cardId - Card UUID
   * @returns The card entity if found
   * @throws {EntityNotFoundException} If card is not found or archived
   */
  private async verifyCardInBoard(boardId: string, cardId: string) {
    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }
    return card;
  }

  /**
   * Adds a new comment to a card and emits `comment.created` event.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param dto - Comment content data
   * @param userId - Creating user UUID
   * @returns The created comment with author details
   * @throws {EntityNotFoundException} If card is not found
   * @emits comment.created - After successful creation
   */
  async create(
    boardId: string,
    cardId: string,
    dto: CreateCommentDto,
    userId: string,
  ): Promise<CardCommentWithAuthor> {
    await this.verifyCardInBoard(boardId, cardId);

    const comment = await this.commentRepo.create({
      cardId,
      authorId: userId,
      content: dto.content,
    });

    this.eventEmitter.emit(
      COMMENT_EVENTS.created,
      new CommentCreatedEvent(comment, boardId, userId),
    );

    return comment;
  }

  /**
   * Retrieves paginated comments for a card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param query - Page and page size parameters
   * @returns Paginated list of comments with metadata
   * @throws {EntityNotFoundException} If card is not found
   */
  async getCardComments(
    boardId: string,
    cardId: string,
    query: PaginationQueryDto = {},
  ): Promise<PaginatedComments> {
    await this.verifyCardInBoard(boardId, cardId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const [items, total] = await Promise.all([
      this.commentRepo.findCardComments(
        cardId,
        (page - 1) * pageSize,
        pageSize,
      ),
      this.commentRepo.countByCardId(cardId),
    ]);

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  /**
   * Updates an existing comment's text. Only the comment author is permitted.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param commentId - Comment UUID
   * @param dto - Updated comment content
   * @param userId - Modifying user UUID
   * @returns The updated comment
   * @throws {EntityNotFoundException} If card or comment is not found
   * @throws {ForbiddenException} If modifying user is not the comment author
   */
  async update(
    boardId: string,
    cardId: string,
    commentId: string,
    dto: UpdateCommentDto,
    userId: string,
  ): Promise<CardCommentWithAuthor> {
    await this.verifyCardInBoard(boardId, cardId);

    const comment = await this.commentRepo.findActiveById(commentId, cardId);
    if (!comment) {
      throw new EntityNotFoundException('CardComment', commentId);
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    return this.commentRepo.update(commentId, dto.content ?? comment.content);
  }

  /**
   * Soft-deletes a comment. Only the comment author is permitted.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param commentId - Comment UUID
   * @param userId - Requesting user UUID
   * @throws {EntityNotFoundException} If card or comment is not found
   * @throws {ForbiddenException} If requesting user is not the comment author
   */
  async delete(
    boardId: string,
    cardId: string,
    commentId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyCardInBoard(boardId, cardId);

    const comment = await this.commentRepo.findActiveById(commentId, cardId);
    if (!comment) {
      throw new EntityNotFoundException('CardComment', commentId);
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.commentRepo.softDelete(commentId);
  }
}
