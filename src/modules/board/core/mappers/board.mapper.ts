import type { Board, Card, Label, List } from '@prisma/client';
import {
  BoardContentPaginationDto,
  BoardResponseDto,
  BoardWithContentResponseDto,
} from '../dto';
import {
  CardAssigneeUserDto,
  CardLabelItemDto,
  CardResponseDto,
  CardWithDetailsResponseDto,
  CardWithSubcardsResponseDto,
} from '../../card/dto/card-response.dto';
import {
  CommentAuthorDto,
  CardCommentResponseDto,
} from '../../comment/dto/card-comment-response.dto';
import {
  ListResponseDto,
  ListWithCardsResponseDto,
} from '../../list/dto/list-response.dto';
import { LabelResponseDto } from '../../label/dto/board-label-response.dto';
import type {
  BoardWithFullContent,
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
    deletedAt: (board as Board & { deletedAt: Date | null }).deletedAt ?? null,
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
    deletedAt: (list as List & { deletedAt: Date | null }).deletedAt ?? null,
  };
}

/**
 * Maps a Prisma Label model to LabelResponseDto.
 *
 * @param label - Label database entity
 * @returns Mapped LabelResponseDto
 */
export function toLabelResponseDto(label: Label): LabelResponseDto {
  return {
    id: label.id,
    workspaceId: label.workspaceId,
    name: label.name,
    color: label.color,
    createdAt: label.createdAt,
  };
}

/**
 * Backward compatibility alias for toLabelResponseDto.
 */
export const toBoardLabelResponseDto = toLabelResponseDto;

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
    priority: card.priority,
    status: card.status,
    parentCardId: card.parentCardId,
    estimateMinutes: card.estimateMinutes,
    loggedMinutes: card.loggedMinutes,
    createdBy: card.createdBy,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    archivedAt: card.archivedAt,
    deletedAt: card.deletedAt ?? null,
  };
}

/**
 * Maps a parent card with subcards and rollup to CardWithSubcardsResponseDto.
 *
 * @param card - Parent card details with subcards and rollup totals
 * @returns Mapped CardWithSubcardsResponseDto
 */
export function toCardWithSubcardsResponseDto(
  card: CardWithDetails & {
    subcards: Card[];
    subcardRollup: {
      total: number;
      done: number;
      estimateSum: number;
      loggedSum: number;
    };
  },
): CardWithSubcardsResponseDto {
  return {
    ...toCardWithDetailsResponseDto(card),
    subcards: card.subcards.map(toCardResponseDto),
    subcardRollup: { ...card.subcardRollup },
  };
}

/**
 * Maps a CardWithDetails relational entity to CardWithDetailsResponseDto.
 * Attachments are intentionally empty here — file attachments are served
 * via the dedicated card-attachments route backed by S3-backed files.
 *
 * @param card - Card entity with assignees and labels
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
    attachments: [],
    subcards: (card as any).subcards
      ? (card as any).subcards.map(toCardResponseDto)
      : [],
    parent: (card as any).parent ?? null,
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
    parentCommentId: comment.parentCommentId ?? null,
    author: toCommentAuthorDto(comment.author),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    deletedAt: comment.deletedAt,
  };
}
