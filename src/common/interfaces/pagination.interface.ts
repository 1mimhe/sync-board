/**
 * Options for cursor-based pagination.
 */
export interface CursorPagination {
  /** Optional cursor string representing the last item from previous page */
  cursor?: string;
  /** Number of items per page (default 20, max 50) */
  limit: number;
}

/**
 * Standard paginated result envelope.
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    total?: number;
  };
}
