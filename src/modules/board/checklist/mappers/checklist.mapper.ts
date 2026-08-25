import type { CardChecklist, ChecklistItem } from '@prisma/client';
import type {
  ChecklistResponseDto,
  ChecklistItemResponseDto,
} from '../dto/checklist-response.dto';

/**
 * Maps a ChecklistItem entity to ChecklistItemResponseDto.
 *
 * @param item - Checklist item database entity
 * @returns Mapped ChecklistItemResponseDto
 */
export function toChecklistItemResponseDto(
  item: ChecklistItem,
): ChecklistItemResponseDto {
  return {
    id: item.id,
    checklistId: item.checklistId,
    content: item.content,
    isDone: item.isDone,
    rank: item.rank,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/**
 * Maps a CardChecklist entity (with ordered items) to ChecklistResponseDto.
 *
 * @param checklist - Checklist database entity with items
 * @returns Mapped ChecklistResponseDto
 */
export function toChecklistResponseDto(
  checklist: CardChecklist & { items: ChecklistItem[] },
): ChecklistResponseDto {
  return {
    id: checklist.id,
    cardId: checklist.cardId,
    title: checklist.title,
    rank: checklist.rank,
    items: checklist.items.map(toChecklistItemResponseDto),
    createdAt: checklist.createdAt,
    updatedAt: checklist.updatedAt,
  };
}
