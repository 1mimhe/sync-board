import { Injectable } from '@nestjs/common';
import { Label, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/database/prisma.service';

/**
 * Repository handling database operations for the unified Hybrid Label model
 * (both Workspace-scoped and Board-scoped labels).
 */
@Injectable()
export class LabelRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new label (workspace-level if boardId is null/omitted, or board-specific).
   *
   * @param data - Label creation payload
   * @returns The created label
   */
  async create(data: Prisma.LabelUncheckedCreateInput): Promise<Label> {
    return this.prisma.label.create({ data });
  }

  /**
   * Finds a label by ID.
   *
   * @param id - Label UUID
   * @returns The label or null if not found
   */
  async findById(id: string): Promise<Label | null> {
    return this.prisma.label.findUnique({
      where: { id },
    });
  }

  /**
   * Finds all labels available within a workspace.
   *
   * @param workspaceId - Workspace UUID
   * @returns Array of available labels
   */
  async findAvailableLabels(workspaceId: string): Promise<Label[]> {
    return this.prisma.label.findMany({
      where: {
        workspaceId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Finds only workspace-level labels.
   *
   * @param workspaceId - Workspace UUID
   * @returns Array of workspace-level labels
   */
  async findWorkspaceLabels(workspaceId: string): Promise<Label[]> {
    return this.prisma.label.findMany({
      where: {
        workspaceId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Updates an existing label.
   *
   * @param id - Label UUID
   * @param data - Update payload
   * @returns The updated label
   */
  async update(id: string, data: Prisma.LabelUpdateInput): Promise<Label> {
    return this.prisma.label.update({
      where: { id },
      data,
    });
  }

  /**
   * Creates a new label and optionally attaches it to a card within a transaction.
   *
   * @param data - Label creation payload
   * @param cardId - Optional card UUID to attach
   * @returns The created label
   */
  async createWithCard(
    data: Prisma.LabelUncheckedCreateInput,
    cardId?: string,
  ): Promise<Label> {
    if (!cardId) {
      return this.prisma.label.create({ data });
    }

    return this.prisma.$transaction(async (tx) => {
      const label = await tx.label.create({ data });
      await tx.cardLabel.create({
        data: {
          cardId,
          labelId: label.id,
        },
      });
      return label;
    });
  }

  /**
   * Finds all active cards tagged with a specific label in a workspace.
   *
   * @param labelId - Label UUID
   * @param workspaceId - Workspace UUID
   * @returns Array of active cards with list, board, and relation graphs
   */
  async findCardsForLabel(
    labelId: string,
    workspaceId: string,
  ): Promise<any[]> {
    return this.prisma.card.findMany({
      where: {
        labels: { some: { labelId } },
        list: {
          board: { workspaceId, deletedAt: null, archivedAt: null },
          deletedAt: null,
          archivedAt: null,
        },
        deletedAt: null,
        archivedAt: null,
      },
      include: {
        list: {
          select: {
            id: true,
            title: true,
            boardId: true,
            board: {
              select: {
                id: true,
                title: true,
                workspaceId: true,
              },
            },
          },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
        labels: {
          include: { label: true },
        },
        attachments: {
          where: { archivedAt: null },
          include: {
            uploadedBy: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Deletes a label (cascades removal from card_labels).
   *
   * @param id - Label UUID
   * @returns The deleted label
   */
  async delete(id: string): Promise<Label> {
    return this.prisma.label.delete({
      where: { id },
    });
  }
}

/**
 * Backward compatibility alias for LabelRepository.
 */
export { LabelRepository as BoardLabelRepository };
