import { Injectable } from '@nestjs/common';
import { CardChecklist, ChecklistItem } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import type {
  ChecklistWithItems,
  ItemWithChecklist,
} from '../interfaces/checklist.interfaces';

const ITEMS_ORDERED = { items: { orderBy: { rank: 'asc' as const } } };

/**
 * Repository handling database operations for card checklists and their items.
 */
@Injectable()
export class ChecklistRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a checklist on a card and returns it with its (empty) ordered items.
   */
  async createChecklist(data: {
    cardId: string;
    title: string;
    rank: string;
  }): Promise<ChecklistWithItems> {
    return this.prisma.cardChecklist.create({
      data,
      include: ITEMS_ORDERED,
    });
  }

  /**
   * Finds an active checklist by ID (its parent card must not be archived),
   * including its ordered items.
   */
  async findActiveChecklist(
    checklistId: string,
  ): Promise<ChecklistWithItems | null> {
    return this.prisma.cardChecklist.findFirst({
      where: { id: checklistId, card: { archivedAt: null } },
      include: ITEMS_ORDERED,
    });
  }

  /**
   * Finds all active checklists on a card ordered by rank,
   * each with its items ordered by rank.
   */
  async findChecklistsByCard(cardId: string): Promise<ChecklistWithItems[]> {
    return this.prisma.cardChecklist.findMany({
      where: { cardId, card: { archivedAt: null } },
      orderBy: { rank: 'asc' },
      include: ITEMS_ORDERED,
    });
  }

  /**
   * Updates a checklist (e.g. rename) and returns it with its ordered items.
   */
  async updateChecklist(
    id: string,
    data: { title?: string },
  ): Promise<ChecklistWithItems> {
    return this.prisma.cardChecklist.update({
      where: { id },
      data,
      include: ITEMS_ORDERED,
    });
  }

  /**
   * Hard-deletes a checklist; its items are removed by cascade.
   */
  async deleteChecklist(id: string): Promise<void> {
    await this.prisma.cardChecklist.delete({ where: { id } });
  }

  /**
   * Creates an item inside a checklist.
   */
  async createItem(data: {
    checklistId: string;
    content: string;
    rank: string;
  }): Promise<ChecklistItem> {
    return this.prisma.checklistItem.create({ data });
  }

  /**
   * Finds a checklist item including its parent checklist.
   */
  async findItem(itemId: string): Promise<ItemWithChecklist | null> {
    return this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      include: { checklist: true },
    });
  }

  /**
   * Updates an item's content and/or completion state.
   */
  async updateItem(
    id: string,
    data: { content?: string; isDone?: boolean },
  ): Promise<ChecklistItem> {
    return this.prisma.checklistItem.update({ where: { id }, data });
  }

  /**
   * Hard-deletes a single checklist item.
   */
  async deleteItem(id: string): Promise<void> {
    await this.prisma.checklistItem.delete({ where: { id } });
  }
}
