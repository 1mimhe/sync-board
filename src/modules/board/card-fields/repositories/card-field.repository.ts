import { Injectable } from '@nestjs/common';
import { CardFieldDef, CardFieldValue, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../../common/exceptions/app.exception';

/** Repository handling database operations for custom field definitions and values. */
@Injectable()
export class CardFieldRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Field Definitions

  /**
   * Creates a new custom field definition.
   *
   * @param data - Field definition creation payload
   * @returns The created field definition
   * @throws {BusinessRuleException} If name already exists in workspace (P2002)
   */
  async createDef(
    data: Prisma.CardFieldDefUncheckedCreateInput,
  ): Promise<CardFieldDef> {
    try {
      return await this.prisma.cardFieldDef.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BusinessRuleException(
          'FIELD_NAME_EXISTS',
          'A field with this name already exists in the workspace',
        );
      }
      throw error;
    }
  }

  /**
   * Finds a field definition by id.
   *
   * @param id - Field definition UUID
   * @returns The field definition or null when missing
   */
  async findDefById(id: string): Promise<CardFieldDef | null> {
    return this.prisma.cardFieldDef.findUnique({ where: { id } });
  }

  /**
   * Lists all field definitions for a workspace.
   */
  async listDefs(workspaceId: string): Promise<CardFieldDef[]> {
    return this.prisma.cardFieldDef.findMany({
      where: { workspaceId },
      orderBy: { position: 'asc' },
    });
  }

  /**
   * Updates a field definition.
   */
  async updateDef(
    id: string,
    data: Prisma.CardFieldDefUpdateInput,
  ): Promise<CardFieldDef> {
    try {
      return await this.prisma.cardFieldDef.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new EntityNotFoundException('CardFieldDef', id);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BusinessRuleException(
          'FIELD_NAME_EXISTS',
          'A field with this name already exists in the workspace',
        );
      }
      throw error;
    }
  }

  /**
   * Deletes a field definition (cascades to values).
   */
  async deleteDef(id: string): Promise<void> {
    try {
      await this.prisma.cardFieldDef.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new EntityNotFoundException('CardFieldDef', id);
      }
      throw error;
    }
  }

  // Field Values

  /**
   * Sets a field value for a card (upsert on unique fieldId+cardId).
   */
  async setValue(
    fieldId: string,
    cardId: string,
    value: unknown,
  ): Promise<CardFieldValue> {
    return this.prisma.cardFieldValue.upsert({
      where: { fieldId_cardId: { fieldId, cardId } },
      create: { fieldId, cardId, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
  }

  /**
   * Lists all field values for a card with their definitions.
   */
  async listValuesForCard(
    cardId: string,
  ): Promise<(CardFieldValue & { field: CardFieldDef })[]> {
    return this.prisma.cardFieldValue.findMany({
      where: { cardId },
      include: { field: true },
    });
  }
}
