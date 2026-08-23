import { buildCursorPagination } from '../pagination.util';

describe('buildCursorPagination', () => {
  it('should return nextCursor: null and hasMore: false when items count <= limit', () => {
    const items = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ];

    const result = buildCursorPagination(items, 5);

    expect(result.data).toEqual(items);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.cursor).toBeNull();
    expect(result.pagination.total).toBeUndefined();
  });

  it('should slice items to limit and extract nextCursor when items count > limit', () => {
    const items = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
      { id: '3', name: 'Item 3' },
    ];

    const result = buildCursorPagination(items, 2);

    expect(result.data).toEqual([
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ]);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.cursor).toBe('2');
  });

  it('should support custom cursorExtractor', () => {
    const items = [
      { uuid: 'u1', rank: '0|a:' },
      { uuid: 'u2', rank: '0|b:' },
      { uuid: 'u3', rank: '0|c:' },
    ];

    const result = buildCursorPagination(items, 2, (item) => item.rank);

    expect(result.data).toHaveLength(2);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.cursor).toBe('0|b:');
  });

  it('should include total count in pagination metadata when provided', () => {
    const items = [{ id: '1', name: 'Item 1' }];

    const result = buildCursorPagination(items, 10, undefined, 42);

    expect(result.pagination.total).toBe(42);
  });

  it('should handle empty array', () => {
    const result = buildCursorPagination([], 10);

    expect(result.data).toEqual([]);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.cursor).toBeNull();
  });
});
