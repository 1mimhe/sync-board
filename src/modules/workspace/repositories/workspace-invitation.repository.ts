import { Injectable } from '@nestjs/common';
import {
  WorkspaceInvitation,
  InvitationStatus,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { WorkspaceInvitationWithInviter } from '../interfaces/workspace.interfaces';

@Injectable()
export class WorkspaceInvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createInvitation(data: {
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    token: string;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<WorkspaceInvitation> {
    return this.prisma.workspaceInvitation.create({
      data: {
        workspaceId: data.workspaceId,
        email: data.email,
        role: data.role,
        token: data.token,
        invitedBy: data.invitedBy,
        expiresAt: data.expiresAt,
        status: InvitationStatus.pending,
      },
    });
  }

  async findByToken(
    token: string,
  ): Promise<WorkspaceInvitationWithInviter | null> {
    return this.prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        inviter: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async findById(invitationId: string): Promise<WorkspaceInvitation | null> {
    return this.prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });
  }

  async findPendingByEmailAndWorkspace(
    email: string,
    workspaceId: string,
  ): Promise<WorkspaceInvitation | null> {
    return this.prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email,
        status: InvitationStatus.pending,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async findWorkspaceInvitations(
    workspaceId: string,
  ): Promise<WorkspaceInvitationWithInviter[]> {
    return this.prisma.workspaceInvitation.findMany({
      where: {
        workspaceId,
        status: InvitationStatus.pending,
      },
      include: {
        inviter: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    invitationId: string,
    status: InvitationStatus,
    acceptedAt?: Date,
  ): Promise<WorkspaceInvitation> {
    return this.prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        status,
        ...(acceptedAt ? { acceptedAt } : {}),
      },
    });
  }
}
