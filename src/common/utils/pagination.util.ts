import { PaginatedResult } from '../interfaces/pagination.interface';

/**
 * Utility to construct a cursor-paginated result envelope from a dataset fetched with limit + 1.
 *
 * @param items Array of items fetched from DB (typically limit + 1 items)
 * @param limit Requested page limit
 * @param cursorExtractor Function to extract cursor string from an item (default is item.id)
 */
export function buildCursorPagination<T extends Record<string, any>>(
  items: T[],
  limit: number,
  cursorExtractor: (item: T) => string = (item) => item.id,
): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && pageItems.length > 0
      ? cursorExtractor(pageItems[pageItems.length - 1])
      : null;

  return {
    items: pageItems,
    pagination: { cursor: nextCursor, hasMore },
  };
}
