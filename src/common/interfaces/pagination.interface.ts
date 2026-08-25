/**
 * Standard cursor-paginated result payload.
 * Returned by services; wrapped by ResponseInterceptor as:
 * { success: true, data: { items, pagination }, meta }
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    /** Last item id of the current page; null when no further pages */
    cursor: string | null;
    hasMore: boolean;
  };
}

export interface CursorPagination {
  cursor?: string;
  limit: number;
}
