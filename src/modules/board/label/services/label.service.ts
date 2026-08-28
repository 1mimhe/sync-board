import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Label } from '@prisma/client';
import { LabelRepository } from '../repositories/label.repository';
import { BoardRepository } from '../../board/repositories/board.repository';
import { CreateLabelDto, UpdateLabelDto } from '../dto';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';
import {
  LabelCreatedEvent,
  LabelUpdatedEvent,
  LabelDeletedEvent,
} from '../events/label.events';
import { LABEL_EVENTS } from '../events/label-events.constants';

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
    private readonly eventEmitter: EventEmitter2,
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
   * @emits label.created
   */
  async createLabel(
    boardId: string,
    workspaceId: string,
    dto: CreateLabelDto,
    createdBy: string,
  ): Promise<Label> {
    const board = await this.boardRepo.findById(boardId, workspaceId);
    if (!board) {
      throw new EntityNotFoundException('Board', boardId);
    }

    const label = await this.labelRepo.create({
      workspaceId,
      boardId,
      name: dto.name,
      color: dto.color,
    });

    this.eventEmitter.emit(
      LABEL_EVENTS.created,
      new LabelCreatedEvent(label, workspaceId, boardId, createdBy),
    );

    return label;
  }

  /**
   * Creates a workspace-level label shared across all boards in the workspace.
   *
   * @param workspaceId - Workspace UUID
   * @param dto - Label creation data
   * @param createdBy - UUID of the acting user
   * @returns The created label
   * @emits label.created
   */
  async createWorkspaceLabel(
    workspaceId: string,
    dto: CreateLabelDto,
    createdBy: string,
  ): Promise<Label> {
    const label = await this.labelRepo.create({
      workspaceId,
      boardId: null,
      name: dto.name,
      color: dto.color,
    });

    this.eventEmitter.emit(
      LABEL_EVENTS.created,
      new LabelCreatedEvent(label, workspaceId, null, createdBy),
    );

    return label;
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
   * @param updatedBy - UUID of the acting user
   * @returns The updated label
   * @throws {EntityNotFoundException} If board or label is not found
   * @emits label.updated
   */
  async updateLabel(
    boardId: string,
    workspaceId: string,
    labelId: string,
    dto: UpdateLabelDto,
    updatedBy: string,
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

    const updated = await this.labelRepo.update(labelId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.color !== undefined && { color: dto.color }),
    });

    this.eventEmitter.emit(
      LABEL_EVENTS.updated,
      new LabelUpdatedEvent(updated, boardId, updatedBy),
    );

    return updated;
  }

  /**
   * Deletes a label from a board or workspace.
   *
   * @param boardId - Board UUID
   * @param workspaceId - Workspace UUID
   * @param labelId - Label UUID
   * @param deletedBy - UUID of the acting user
   * @throws {EntityNotFoundException} If board or label is not found
   * @emits label.deleted
   */
  async deleteLabel(
    boardId: string,
    workspaceId: string,
    labelId: string,
    deletedBy: string,
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

    this.eventEmitter.emit(
      LABEL_EVENTS.deleted,
      new LabelDeletedEvent(labelId, boardId, deletedBy),
    );
  }
}
