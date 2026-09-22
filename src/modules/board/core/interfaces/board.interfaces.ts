import type { Board, List, Card, Label, CardComment } from '@prisma/client';

/**
 * Card entity with its full relational graph (assignees and labels).
 * File attachments are served via the dedicated attachments route backed
 * by S3-backed files, not nested here.
 */
export interface CardWithDetails extends Card {
  assignees: {
    user: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }[];
  labels: {
    label: Label;
  }[];
  subcards?: Card[];
}

/**
 * List entity with nested cards and aggregated card count.
 */
export interface ListWithCards extends List {
  cards: CardWithDetails[];
  /** Total non-archived cards in the list (for pagination) */
  cardCount: number;
}

/**
 * Query parameters for fetching nested board content with pagination.
 */
export interface BoardContentQuery {
  listSkip?: number;
  listTake?: number;
  cardSkip?: number;
  cardTake?: number;
}

/**
 * Pagination metadata for board content (lists & cards).
 */
export interface BoardContentPaginationMeta {
  listPage: number;
  listPageSize: number;
  totalLists: number;
  totalPages: number;
  cardPageSize: number;
  totalCards: number;
}

/**
 * Full board payload including starred status, nested lists, labels, and pagination metadata.
 */
export interface BoardWithFullContent extends Board {
  isStarred: boolean;
  lists: ListWithCards[];
  labels: Label[];
  pagination: BoardContentPaginationMeta;
}

/**
 * Card comment entity with author profile details.
 */
export interface CardCommentWithAuthor extends CardComment {
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}
