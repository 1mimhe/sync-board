import { BadRequestException } from '@nestjs/common';

/** Postgres BIGINT max — the Activity id column is BIGSERIAL (int8). */
const MAX_ACTIVITY_ID = 9223372036854775807n;

/** Composite cursor shape: `<ISO timestamp>|<positive bigint id>`. */
const CURSOR_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\|([1-9]\d{0,18})$/;

export function encodeActivityCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

export function decodeActivityCursor(cursor: string): {
  createdAt: Date;
  id: bigint;
} {
  const match = CURSOR_PATTERN.exec(cursor);
  if (!match) throw new BadRequestException('Invalid activity cursor');
  const createdAt = new Date(match[1]);
  const id = BigInt(match[2]);
  if (
    !Number.isFinite(createdAt.getTime()) ||
    createdAt.toISOString() !== match[1] ||
    id > MAX_ACTIVITY_ID
  ) {
    throw new BadRequestException('Invalid activity cursor');
  }
  return { createdAt, id };
}
