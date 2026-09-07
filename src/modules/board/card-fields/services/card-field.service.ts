import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CardFieldDef, CardFieldValue } from '@prisma/client';
import { CardFieldRepository } from '../repositories/card-field.repository';
import { CardRepository } from '../../card/repositories/card.repository';
import { BoardRepository } from '../../core/repositories/board.repository';
import { WorkspaceService } from '../../../workspace/services/workspace.service';
import {
  CreateFieldDefDto,
  UpdateFieldDefDto,
  SetFieldValueDto,
} from '../dto/field-def.dto';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';
import { assertBoardInWorkspace } from '../../shared/board-access.util';
import { validateFieldValue } from './custom-field-validator.util';

/**
 * Service handling workspace custom field definitions and per-card values.
 */
@Injectable()
export class CardFieldService {
  private readonly logger = new Logger(CardFieldService.name);

  constructor(
    private readonly fieldRepo: CardFieldRepository,
    private readonly cardRepo: CardRepository,
    private readonly boardRepo: BoardRepository,
    private readonly workspaceService: WorkspaceService,
  ) {}

  /**
   * Verifies that a board exists within the given workspace and is active.
   */
  private async verifyBoardInWorkspace(
    boardId: string,
    workspaceId?: string,
  ): Promise<void> {
    await assertBoardInWorkspace(this.boardRepo, boardId, workspaceId);
  }

  // Field Definitions

  /**
   * Creates a custom field definition in a workspace.
   *
   * @param workspaceId - Workspace UUID owning the definition
   * @param dto - Field definition payload
   * @param userId - Creating user UUID (audit context, not persisted)
   * @returns The created field definition
   * @throws {EntityNotFoundException} Never — workspace scope is enforced by route guards
   */
  async createDef(
    workspaceId: string,
    dto: CreateFieldDefDto,
    userId: string,
  ): Promise<CardFieldDef> {
    this.logger.debug('Creating field definition', { workspaceId, userId });
    const field = await this.fieldRepo.createDef({
      workspaceId,
      name: dto.name,
      fieldType: dto.fieldType,
      options: dto.options ?? undefined,
      required: dto.required ?? false,
      position: dto.position ?? 0,
    });
    this.logger.log('Field definition created', {
      fieldId: field.id,
      workspaceId,
    });
    return field;
  }

  /**
   * Lists all field definitions for a workspace.
   *
   * @param workspaceId - Workspace UUID
   * @returns Field definitions ordered by position
   */
  async listDefs(workspaceId: string): Promise<CardFieldDef[]> {
    return this.fieldRepo.listDefs(workspaceId);
  }

  /**
   * Updates a field definition.
   *
   * @param workspaceId - Workspace UUID scoping the definition
   * @param fieldId - Field definition UUID
   * @param dto - Partial update payload
   * @returns The updated field definition
   * @throws {EntityNotFoundException} If the definition is missing or in another workspace
   */
  async updateDef(
    workspaceId: string,
    fieldId: string,
    dto: UpdateFieldDefDto,
  ): Promise<CardFieldDef> {
    const existing = await this.fieldRepo.findDefById(fieldId);
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('CardFieldDef', fieldId);
    }
    return this.fieldRepo.updateDef(fieldId, dto);
  }

  /**
   * Deletes a field definition (cascades to values).
   *
   * @param workspaceId - Workspace UUID scoping the definition
   * @param fieldId - Field definition UUID
   * @throws {EntityNotFoundException} If the definition is missing or in another workspace
   */
  async deleteDef(workspaceId: string, fieldId: string): Promise<void> {
    const existing = await this.fieldRepo.findDefById(fieldId);
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('CardFieldDef', fieldId);
    }
    await this.fieldRepo.deleteDef(fieldId);
  }

  // Field Values

  /**
   * Sets a field value on a card (upsert on field + card).
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID scoping both card and field definition
   * @param cardId - Card UUID
   * @param fieldId - Field definition UUID
   * @param dto - Raw value validated against the definition
   * @returns The upserted field value
   * @throws {EntityNotFoundException} If board, card, or field definition is not found
   * @throws {BadRequestException} If the value fails type/option validation or references a non-member
   */
  async setValue(
    boardId: string,
    workspaceId: string,
    cardId: string,
    fieldId: string,
    dto: SetFieldValueDto,
  ): Promise<CardFieldValue> {
    this.logger.debug('Setting field value', { boardId, cardId, fieldId });
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const field = await this.fieldRepo.findDefById(fieldId);
    if (!field || field.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('CardFieldDef', fieldId);
    }

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    validateFieldValue(field.fieldType, field.options, dto.value);

    if (field.fieldType === 'user' && typeof dto.value === 'string') {
      const isMember = await this.workspaceService.isUserMember(
        workspaceId,
        dto.value,
      );
      if (!isMember) {
        throw new BadRequestException(
          'Referenced user is not a member of this workspace',
        );
      }
    }

    const value = await this.fieldRepo.setValue(fieldId, cardId, dto.value);
    this.logger.log('Field value set', { cardId, fieldId });
    return value;
  }

  /**
   * Lists all field values for a card with their definitions.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param cardId - Card UUID
   * @returns Field values joined with definitions
   * @throws {EntityNotFoundException} If board or card is not found
   */
  async listValues(
    boardId: string,
    workspaceId: string,
    cardId: string,
  ): Promise<(CardFieldValue & { field: CardFieldDef })[]> {
    await this.verifyBoardInWorkspace(boardId, workspaceId);

    const card = await this.cardRepo.findActiveById(cardId, boardId);
    if (!card) {
      throw new EntityNotFoundException('Card', cardId);
    }

    return this.fieldRepo.listValuesForCard(cardId);
  }
}
