import { PaginatedResult } from '../interfaces/pagination.interface';

/**
 * Utility to construct a cursor-paginated result envelope from a dataset fetched with limit + 1.
 *
 * @param items Array of items fetched from DB (typically limit + 1 items)
 * @param limit Requested page limit
 * @param cursorExtractor Function to extract cursor string from an item (default is item.id)
 * @param total Optional total count of items
 */
export function buildCursorPagination<T extends Record<string, any>>(
  items: T[],
  limit: number,
  cursorExtractor: (item: T) => string = (item) => item.id,
  total?: number,
): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && data.length > 0 ? cursorExtractor(data[data.length - 1]) : null;

  return {
    data,
    pagination: {
      cursor: nextCursor,
      hasMore,
      ...(total !== undefined ? { total } : {}),
    },
  };
}
