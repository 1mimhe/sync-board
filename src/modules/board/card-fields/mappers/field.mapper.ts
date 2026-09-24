import type { CardFieldDef, CardFieldValue } from '@prisma/client';
import {
  CardFieldDefResponseDto,
  CardFieldValueResponseDto,
  CardFieldValueWithDefResponseDto,
} from '../dto/field-response.dto';

/**
 * Maps a CardFieldDef entity to CardFieldDefResponseDto.
 *
 * @param def - Field definition entity
 * @returns Mapped CardFieldDefResponseDto
 */
export function toCardFieldDefResponseDto(
  def: CardFieldDef,
): CardFieldDefResponseDto {
  return {
    id: def.id,
    workspaceId: def.workspaceId,
    name: def.name,
    fieldType: def.fieldType,
    options: def.options ?? undefined,
    required: def.required,
    position: def.position,
    createdAt: def.createdAt,
  };
}

/**
 * Maps a CardFieldValue entity to CardFieldValueResponseDto.
 *
 * @param value - Field value entity
 * @returns Mapped CardFieldValueResponseDto
 */
export function toCardFieldValueResponseDto(
  value: CardFieldValue,
): CardFieldValueResponseDto {
  return {
    id: value.id,
    fieldId: value.fieldId,
    cardId: value.cardId,
    value: value.value,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

/**
 * Maps a card field value with its definition to the combined response DTO.
 *
 * @param value - Field value entity with definition included
 * @returns Mapped CardFieldValueWithDefResponseDto
 */
export function toCardFieldValueWithDefResponseDto(
  value: CardFieldValue & { field: CardFieldDef },
): CardFieldValueWithDefResponseDto {
  return {
    ...toCardFieldValueResponseDto(value),
    field: toCardFieldDefResponseDto(value.field),
  };
}
