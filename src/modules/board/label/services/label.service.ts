import { Injectable } from '@nestjs/common';
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
    private readonly boardRepo: BoardRepository,
  ) {}

  /**
   * Creates a board-specific label.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param dto - Label creation data
   * @returns The created label
   * @throws {EntityNotFoundException} If board is not found
   */
  async createLabel(
    boardId: string,
    workspaceId: string,
    dto: CreateLabelDto,
  ): Promise<Label> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    return this.labelRepo.create({
      workspaceId,
      boardId,
      name: dto.name,
      color: dto.color,
    });
  }

  /**
   * Creates a workspace-level label shared across all boards in the workspace.
   *
   * @param workspaceId - Workspace UUID
   * @param dto - Label creation data
   * @returns The created label
   */
  async createWorkspaceLabel(
    workspaceId: string,
    dto: CreateLabelDto,
  ): Promise<Label> {
    return this.labelRepo.create({
      workspaceId,
      boardId: null,
      name: dto.name,
      color: dto.color,
    });
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

    return this.labelRepo.findAvailableLabels(workspaceId, boardId);
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
   * Updates a label belonging to a board or workspace.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param labelId - Label UUID
   * @param dto - Update data
   * @returns The updated label
   * @throws {EntityNotFoundException} If board or label is not found
   */
  async updateLabel(
    boardId: string,
    workspaceId: string,
    labelId: string,
    dto: UpdateLabelDto,
  ): Promise<Label> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    const label = await this.labelRepo.findById(labelId);
    if (
      !label ||
      label.workspaceId !== workspaceId ||
      (label.boardId !== null && label.boardId !== boardId)
    ) {
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
   * @throws {EntityNotFoundException} If board or label is not found
   */
  async deleteLabel(
    boardId: string,
    workspaceId: string,
    labelId: string,
  ): Promise<void> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    const label = await this.labelRepo.findById(labelId);
    if (
      !label ||
      label.workspaceId !== workspaceId ||
      (label.boardId !== null && label.boardId !== boardId)
    ) {
      throw new EntityNotFoundException('Label', labelId);
    }

    await this.labelRepo.delete(labelId);
  }
}
