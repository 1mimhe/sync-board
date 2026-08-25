import type {
  Activity,
  Board,
  List,
  Card,
  Label,
  CardComment,
  CardAttachment,
} from '@prisma/client';

/**
 * Card attachment entity including basic uploader user profile details.
 */
export interface CardAttachmentWithUser extends CardAttachment {
  uploadedBy: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

/**
 * Card entity with its full relational graph (assignees, labels, and attachments).
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
  attachments?: CardAttachmentWithUser[];
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

/**
 * Activity log entry with actor user profile details.
 */
export interface ActivityWithAuthor extends Activity {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}
