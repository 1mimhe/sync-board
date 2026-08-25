import { buildCursorPagination } from '../pagination.util';

describe('buildCursorPagination', () => {
  it('should return nextCursor: null and hasMore: false when items count <= limit', () => {
    const items = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ];

    const result = buildCursorPagination(items, 5);

    expect(result.items).toEqual(items);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.cursor).toBeNull();
  });

  it('should slice items to limit and extract nextCursor when items count > limit', () => {
    const items = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
      { id: '3', name: 'Item 3' },
    ];

    const result = buildCursorPagination(items, 2);

    expect(result.items).toEqual([
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

    expect(result.items).toHaveLength(2);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.cursor).toBe('0|b:');
  });

  it('should handle empty array', () => {
    const result = buildCursorPagination([], 10);

    expect(result.items).toEqual([]);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.cursor).toBeNull();
  });
});
