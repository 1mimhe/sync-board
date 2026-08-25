import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CardCommentRepository } from '../repositories/card-comment.repository';
import { CardRepository } from '../repositories/card.repository';
import { BoardRepository } from '../repositories/board.repository';
import {
  CreateCommentDto,
  UpdateCommentDto,
  CursorPaginationQueryDto,
} from '../dto';
import { EntityNotFoundException } from '../../../common/exceptions/app.exception';
import { buildCursorPagination } from '../../../common/utils/pagination.util';
import type { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import { CommentCreatedEvent } from '../events/board.events';
import { COMMENT_EVENTS } from '../events/board-events.constants';
import type { CardCommentWithAuthor } from '../interfaces/board.interfaces';

/**
 * Service handling business logic for card comments (creation, pagination, author-only editing, soft deletion).
 */
@Injectable()
export class CardCommentService {
  private readonly logger = new Logger(CardCommentService.name);

  constructor(
    private readonly commentRepo: CardCommentRepository,
    private readonly cardRepo: CardRepository,
    private readonly boardRepo: BoardRepository,
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
   * @throws {EntityNotFoundException} If board or card is not found
   * @emits comment.created - After successful creation
   */
  async create(
    boardId: string,
    workspaceId: string,
    cardId: string,
    dto: CreateCommentDto,
    userId: string,
  ): Promise<CardCommentWithAuthor> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);
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
   * Retrieves a cursor-paginated list of active comments for a card.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @param query - Cursor and limit parameters
   * @returns PaginatedResult with `items` and `pagination.cursor/hasMore`
   * @throws {EntityNotFoundException} If board or card is not found
   */
  async getCardComments(
    boardId: string,
    workspaceId: string,
    cardId: string,
    query: CursorPaginationQueryDto = {},
  ): Promise<PaginatedResult<CardCommentWithAuthor>> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);
    await this.verifyCardInBoard(boardId, cardId);

    const limit = query.limit ?? 20;
    const rows = await this.commentRepo.findCardCommentsPage(
      cardId,
      query.cursor,
      limit,
    );
    return buildCursorPagination(rows, limit);
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
   * @throws {EntityNotFoundException} If board, card, or comment is not found
   * @throws {ForbiddenException} If modifying user is not the comment author
   */
  async update(
    boardId: string,
    workspaceId: string,
    cardId: string,
    commentId: string,
    dto: UpdateCommentDto,
    userId: string,
  ): Promise<CardCommentWithAuthor> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);
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
   * @throws {EntityNotFoundException} If board, card, or comment is not found
   * @throws {ForbiddenException} If requesting user is not the comment author
   */
  async delete(
    boardId: string,
    workspaceId: string,
    cardId: string,
    commentId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);
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
