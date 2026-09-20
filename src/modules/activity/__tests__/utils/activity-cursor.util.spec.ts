import { BadRequestException } from '@nestjs/common';
import {
  decodeActivityCursor,
  encodeActivityCursor,
} from '../../utils/activity-cursor.util';

describe('activity-cursor.util', () => {
  it('round-trips iso|id cursors', () => {
    const cursor = encodeActivityCursor(
      new Date('2026-09-01T00:00:00.000Z'),
      '42',
    );
    expect(decodeActivityCursor(cursor)).toEqual({
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      id: 42n,
    });
  });

  it('rejects malformed cursors', () => {
    for (const bad of [
      'nope',
      '2026-09-01T00:00:00.000Z|0',
      '2026-13-01T00:00:00.000Z|1',
    ]) {
      expect(() => decodeActivityCursor(bad)).toThrow(BadRequestException);
    }
  });
});
