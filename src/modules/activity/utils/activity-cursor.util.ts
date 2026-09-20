import { BadRequestException } from '@nestjs/common';

export function encodeActivityCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

export function decodeActivityCursor(cursor: string): {
  createdAt: Date;
  id: bigint;
} {
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\|([1-9]\d{0,18})$/.exec(
      cursor,
    );
  if (!match) throw new BadRequestException('Invalid activity cursor');
  const createdAt = new Date(match[1]);
  const id = BigInt(match[2]);
  if (
    !Number.isFinite(createdAt.getTime()) ||
    createdAt.toISOString() !== match[1] ||
    id > 9223372036854775807n
  ) {
    throw new BadRequestException('Invalid activity cursor');
  }
  return { createdAt, id };
}
