import type { Activity, Board, Card, Label, List } from '@prisma/client';
import {
  ActivityResponseDto,
  BoardContentPaginationDto,
  BoardResponseDto,
  BoardWithContentResponseDto,
} from '../dto';
import {
  CardAssigneeUserDto,
  CardLabelItemDto,
  CardResponseDto,
  CardWithDetailsResponseDto,
} from '../../card/dto/card-response.dto';
import {
  CommentAuthorDto,
  CardCommentResponseDto,
} from '../../comment/dto/card-comment-response.dto';
import {
  ListResponseDto,
  ListWithCardsResponseDto,
} from '../../list/dto/list-response.dto';
import { BoardLabelResponseDto } from '../../label/dto/board-label-response.dto';
import { CardAttachmentResponseDto } from '../../attachment/dto/card-attachment-response.dto';
import type {
  BoardWithFullContent,
  CardAttachmentWithUser,
  CardCommentWithAuthor,
  CardWithDetails,
  ListWithCards,
} from '../interfaces/board.interfaces';

type AuthorShape = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

/**
 * Maps an author user shape to CommentAuthorDto.
 *
 * @param user - Author user object
 * @returns Mapped CommentAuthorDto
 */
export function toCommentAuthorDto(user: AuthorShape): CommentAuthorDto {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

/**
 * Maps a Prisma Board model to BoardResponseDto.
 *
 * @param board - Board database entity
 * @returns Mapped BoardResponseDto
 */
export function toBoardResponseDto(board: Board): BoardResponseDto {
  return {
    id: board.id,
    workspaceId: board.workspaceId,
    title: board.title,
    description: board.description,
    backgroundColor: board.backgroundColor,
    createdBy: board.createdBy,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    archivedAt: board.archivedAt,
  };
}

/**
 * Maps a Prisma List model to ListResponseDto.
 *
 * @param list - List database entity
 * @returns Mapped ListResponseDto
 */
export function toListResponseDto(list: List): ListResponseDto {
  return {
    id: list.id,
    boardId: list.boardId,
    title: list.title,
    rank: list.rank,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    archivedAt: list.archivedAt,
  };
}

/**
 * Maps a Prisma Label model to BoardLabelResponseDto.
 *
 * @param label - Label database entity
 * @returns Mapped BoardLabelResponseDto
 */
export function toBoardLabelResponseDto(label: Label): BoardLabelResponseDto {
  return {
    id: label.id,
    workspaceId: label.workspaceId,
    boardId: label.boardId,
    name: label.name,
    color: label.color,
    createdAt: label.createdAt,
  };
}

/**
 * Maps a Prisma Card model to CardResponseDto.
 *
 * @param card - Card database entity
 * @returns Mapped CardResponseDto
 */
export function toCardResponseDto(card: Card): CardResponseDto {
  return {
    id: card.id,
    listId: card.listId,
    title: card.title,
    description: card.description,
    rank: card.rank,
    dueDate: card.dueDate,
    isComplete: card.isComplete,
    coverImageUrl: card.coverImageUrl,
    createdBy: card.createdBy,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    archivedAt: card.archivedAt,
  };
}

/**
 * Maps a CardAttachmentWithUser entity to CardAttachmentResponseDto.
 *
 * @param attachment - Attachment entity with uploader details
 * @returns Mapped CardAttachmentResponseDto
 */
export function toCardAttachmentResponseDto(
  attachment: CardAttachmentWithUser,
): CardAttachmentResponseDto {
  return {
    id: attachment.id,
    cardId: attachment.cardId,
    uploadedBy: toCommentAuthorDto(attachment.uploadedBy),
    type: attachment.type,
    url: attachment.url,
    name: attachment.name,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize,
    coverUrl: attachment.coverUrl,
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
  };
}

/**
 * Maps a CardWithDetails relational entity to CardWithDetailsResponseDto.
 *
 * @param card - Card entity with assignees, labels, attachments
 * @returns Mapped CardWithDetailsResponseDto
 */
export function toCardWithDetailsResponseDto(
  card: CardWithDetails,
): CardWithDetailsResponseDto {
  return {
    ...toCardResponseDto(card),
    assignees: card.assignees.map((assignee): CardAssigneeUserDto => ({
      user: toCommentAuthorDto(assignee.user),
    })),
    labels: card.labels.map((item): CardLabelItemDto => ({
      label: toBoardLabelResponseDto(item.label),
    })),
    attachments: card.attachments
      ? card.attachments.map(toCardAttachmentResponseDto)
      : [],
  };
}

/**
 * Maps a ListWithCards relational entity to ListWithCardsResponseDto.
 *
 * @param list - List entity with nested cards
 * @returns Mapped ListWithCardsResponseDto
 */
export function toListWithCardsResponseDto(
  list: ListWithCards,
): ListWithCardsResponseDto {
  return {
    ...toListResponseDto(list),
    cards: list.cards.map(toCardWithDetailsResponseDto),
    cardCount: list.cardCount,
  };
}

/**
 * Maps a full board content entity to BoardWithContentResponseDto.
 *
 * @param board - Board entity with full nested relations
 * @returns Mapped BoardWithContentResponseDto
 */
export function toBoardWithContentResponseDto(
  board: BoardWithFullContent,
): BoardWithContentResponseDto {
  return {
    ...toBoardResponseDto(board),
    isStarred: board.isStarred,
    lists: board.lists.map(toListWithCardsResponseDto),
    labels: board.labels.map(toBoardLabelResponseDto),
    pagination: toBoardContentPaginationDto(board.pagination),
  };
}

/**
 * Maps board content pagination metadata to BoardContentPaginationDto.
 *
 * @param pagination - Pagination metadata
 * @returns Mapped BoardContentPaginationDto
 */
export function toBoardContentPaginationDto(
  pagination: BoardWithFullContent['pagination'],
): BoardContentPaginationDto {
  return {
    listPage: pagination.listPage,
    listPageSize: pagination.listPageSize,
    totalLists: pagination.totalLists,
    totalPages: pagination.totalPages,
    cardPageSize: pagination.cardPageSize,
    totalCards: pagination.totalCards,
  };
}

/**
 * Maps a CardCommentWithAuthor entity to CardCommentResponseDto.
 *
 * @param comment - Comment entity with author details
 * @returns Mapped CardCommentResponseDto
 */
export function toCardCommentResponseDto(
  comment: CardCommentWithAuthor,
): CardCommentResponseDto {
  return {
    id: comment.id,
    cardId: comment.cardId,
    authorId: comment.authorId,
    content: comment.content,
    author: toCommentAuthorDto(comment.author),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    deletedAt: comment.deletedAt,
  };
}

/**
 * Maps an Activity entity with author to ActivityResponseDto.
 *
 * @param activity - Activity database entity with actor user details
 * @returns Mapped ActivityResponseDto
 */
export function toActivityResponseDto(
  activity: Activity & { user: AuthorShape },
): ActivityResponseDto {
  return {
    id: activity.id,
    boardId: activity.boardId,
    user: toCommentAuthorDto(activity.user),
    action: activity.action,
    entityType: activity.entityType,
    entityId: activity.entityId,
    entityTitle: activity.entityTitle,
    fromListId: activity.fromListId,
    toListId: activity.toListId,
    details: activity.details,
    createdAt: activity.createdAt,
  };
}
