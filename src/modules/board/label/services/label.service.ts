import { Inject, Injectable, forwardRef } from '@nestjs/common';
import type { Label } from '@prisma/client';
import { LabelRepository } from '../repositories/label.repository';
import { BoardRepository } from '../../board/repositories/board.repository';
import { CreateLabelDto, UpdateLabelDto } from '../dto';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';

/**
 * Service encapsulating business logic for labels
 * (hybrid workspace-level + board-specific CRUD).
 */
@Injectable()
export class LabelService {
  constructor(
    private readonly labelRepo: LabelRepository,
    @Inject(forwardRef(() => BoardRepository))
    private readonly boardRepo: BoardRepository,
  ) {}

  /**
   * Creates a board-specific label.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param dto - Label creation data
   * @param createdBy - UUID of the acting user
   * @returns The created label
   * @throws {EntityNotFoundException} If board is not found
   */
  async createLabel(
    boardId: string,
    workspaceId: string,
    dto: CreateLabelDto,
    _createdBy?: string,
  ): Promise<Label> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    return this.labelRepo.createWithCard(
      {
        workspaceId,
        name: dto.name,
        color: dto.color,
      },
      dto.cardId,
    );
  }

  /**
   * Creates a workspace-level label shared across all boards in the workspace.
   *
   * @param workspaceId - Workspace UUID
   * @param dto - Label creation data
   * @param createdBy - UUID of the acting user
   * @returns The created label
   */
  async createWorkspaceLabel(
    workspaceId: string,
    dto: CreateLabelDto,
    _createdBy?: string,
  ): Promise<Label> {
    return this.labelRepo.createWithCard(
      {
        workspaceId,
        name: dto.name,
        color: dto.color,
      },
      dto.cardId,
    );
  }

  /**
   * Retrieves all labels available to a board (workspace-level + board-specific).
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @returns Array of available labels
   * @throws {EntityNotFoundException} If board is not found
   */
  async getLabelsForBoard(
    boardId: string,
    workspaceId: string,
  ): Promise<Label[]> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    return this.labelRepo.findAvailableLabels(workspaceId);
  }

  /**
   * Retrieves all workspace-level labels.
   *
   * @param workspaceId - Workspace UUID
   * @returns Array of workspace-level labels
   */
  async getWorkspaceLabels(workspaceId: string): Promise<Label[]> {
    return this.labelRepo.findWorkspaceLabels(workspaceId);
  }

  /**
   * Retrieves all active cards tagged with a workspace label.
   *
   * @param workspaceId - Workspace UUID
   * @param labelId - Label UUID
   * @returns Array of active cards with full relational graph
   * @throws {EntityNotFoundException} If label is not found in workspace
   */
  async getCardsForLabel(workspaceId: string, labelId: string): Promise<any[]> {
    const label = await this.labelRepo.findById(labelId);
    if (!label || label.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('Label', labelId);
    }

    return this.labelRepo.findCardsForLabel(labelId, workspaceId);
  }

  /**
   * Updates a label belonging to a board or workspace.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param labelId - Label UUID
   * @param dto - Update data
   * @param updatedBy - UUID of the acting user
   * @returns The updated label
   * @throws {EntityNotFoundException} If board or label is not found
   */
  async updateLabel(
    boardId: string,
    workspaceId: string,
    labelId: string,
    dto: UpdateLabelDto,
    _updatedBy?: string,
  ): Promise<Label> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    const label = await this.labelRepo.findById(labelId);
    if (!label || label.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('Label', labelId);
    }

    return this.labelRepo.update(labelId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.color !== undefined && { color: dto.color }),
    });
  }

  /**
   * Updates a workspace-scoped label without requiring boardId.
   *
   * @param workspaceId - Workspace UUID
   * @param labelId - Label UUID
   * @param dto - Update data
   * @param updatedBy - UUID of the acting user
   * @returns The updated label
   * @throws {EntityNotFoundException} If label is not found in workspace
   */
  async updateWorkspaceLabel(
    workspaceId: string,
    labelId: string,
    dto: UpdateLabelDto,
    _updatedBy?: string,
  ): Promise<Label> {
    const label = await this.labelRepo.findById(labelId);
    if (!label || label.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('Label', labelId);
    }

    return this.labelRepo.update(labelId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.color !== undefined && { color: dto.color }),
    });
  }

  /**
   * Deletes a label from a board or workspace.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param labelId - Label UUID
   * @param deletedBy - UUID of the acting user
   * @throws {EntityNotFoundException} If board or label is not found
   */
  async deleteLabel(
    boardId: string,
    workspaceId: string,
    labelId: string,
    _deletedBy?: string,
  ): Promise<void> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    const label = await this.labelRepo.findById(labelId);
    if (!label || label.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('Label', labelId);
    }

    await this.labelRepo.delete(labelId);
  }

  /**
   * Deletes a workspace-scoped label without requiring boardId.
   *
   * @param workspaceId - Workspace UUID
   * @param labelId - Label UUID
   * @param deletedBy - UUID of the acting user
   * @throws {EntityNotFoundException} If label is not found in workspace
   */
  async deleteWorkspaceLabel(
    workspaceId: string,
    labelId: string,
    _deletedBy?: string,
  ): Promise<void> {
    const label = await this.labelRepo.findById(labelId);
    if (!label || label.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('Label', labelId);
    }

    await this.labelRepo.delete(labelId);
  }
}
