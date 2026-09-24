import { BadRequestException } from '@nestjs/common';
import type { CardFieldType } from '@prisma/client';
import { isUuidV4 } from '../../../../common/utils/validation.util';

/**
 * Validates a raw field value against its definition.
 *
 * Null/undefined clears the value and always passes; `required` is surfaced
 * at read time, never by blocking writes. Select options accept the canonical
 * `{ options: string[] }` wrapper (flat arrays also tolerated).
 *
 * @param fieldType - Definition type discriminator
 * @param options - Raw definition options JSON
 * @param value - Raw candidate value
 * @throws {BadRequestException} When the value violates its type contract
 */
export function validateFieldValue(
  fieldType: CardFieldType,
  options: unknown,
  value: unknown,
): void {
  if (value === null || value === undefined) return;
  switch (fieldType) {
    case 'text':
      if (typeof value !== 'string')
        throw new BadRequestException('Text field expects a string');
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new BadRequestException('Number field expects a finite number');
      break;
    case 'date':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
        throw new BadRequestException('Date field expects ISO 8601 string');
      break;
    case 'select': {
      const wrapped = (options as { options?: unknown } | null)?.options;
      const raw = Array.isArray(wrapped)
        ? wrapped
        : Array.isArray(options)
          ? options
          : [];
      const allowed = raw.filter((o): o is string => typeof o === 'string');
      if (typeof value !== 'string' || !allowed.includes(value))
        throw new BadRequestException('Select value not in field options');
      break;
    }
    case 'user':
      if (!isUuidV4(value))
        throw new BadRequestException('User field expects a user UUID');
      break;
  }
}
