import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceInvitationRepository } from '../../repositories/workspace-invitation.repository';
import { PrismaService } from '../../../../common/database/prisma.service';
import { InvitationStatus, WorkspaceRole } from '@prisma/client';

describe('WorkspaceInvitationRepository', () => {
  let repository: WorkspaceInvitationRepository;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      workspaceInvitation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceInvitationRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    repository = module.get<WorkspaceInvitationRepository>(
      WorkspaceInvitationRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createInvitation', () => {
    it('should create an invitation with pending status', async () => {
      const inviteData = {
        workspaceId: 'ws-1',
        email: 'user@test.com',
        role: WorkspaceRole.member,
        token: 'hashed-token',
        invitedBy: 'u-1',
        expiresAt: new Date(Date.now() + 86400000),
      };

      const mockResult = {
        id: 'inv-1',
        ...inviteData,
        status: InvitationStatus.pending,
      };
      prismaService.workspaceInvitation.create.mockResolvedValue(mockResult);

      const result = await repository.createInvitation(inviteData);

      expect(prismaService.workspaceInvitation.create).toHaveBeenCalledWith({
        data: {
          ...inviteData,
          status: InvitationStatus.pending,
        },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('findByToken', () => {
    it('should find invitation by token with inviter details', async () => {
      const mockResult = {
        id: 'inv-1',
        token: 'token-123',
        inviter: {
          id: 'u-1',
          displayName: 'Inviter',
          email: 'inviter@test.com',
          avatarUrl: null,
        },
      };
      prismaService.workspaceInvitation.findUnique.mockResolvedValue(
        mockResult,
      );

      const result = await repository.findByToken('token-123');

      expect(prismaService.workspaceInvitation.findUnique).toHaveBeenCalledWith(
        {
          where: { token: 'token-123' },
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
        },
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('findById', () => {
    it('should find invitation by id', async () => {
      const mockResult = { id: 'inv-1', email: 'test@example.com' };
      prismaService.workspaceInvitation.findUnique.mockResolvedValue(
        mockResult,
      );

      const result = await repository.findById('inv-1');

      expect(prismaService.workspaceInvitation.findUnique).toHaveBeenCalledWith(
        {
          where: { id: 'inv-1' },
        },
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('findPendingByEmailAndWorkspace', () => {
    it('should find active pending invitation', async () => {
      const mockResult = {
        id: 'inv-1',
        email: 'test@example.com',
        workspaceId: 'ws-1',
      };
      prismaService.workspaceInvitation.findFirst.mockResolvedValue(mockResult);

      const result = await repository.findPendingByEmailAndWorkspace(
        'test@example.com',
        'ws-1',
      );

      expect(prismaService.workspaceInvitation.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: 'ws-1',
          email: 'test@example.com',
          status: InvitationStatus.pending,
          expiresAt: { gt: expect.any(Date) },
        },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('findWorkspaceInvitations', () => {
    it('should list all pending invitations for a workspace', async () => {
      const mockInvites = [
        {
          id: 'inv-1',
          workspaceId: 'ws-1',
          inviter: {
            id: 'u-1',
            displayName: 'Inviter',
            email: 'inv@test.com',
            avatarUrl: null,
          },
        },
      ];
      prismaService.workspaceInvitation.findMany.mockResolvedValue(mockInvites);

      const result = await repository.findWorkspaceInvitations('ws-1');

      expect(prismaService.workspaceInvitation.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1', status: InvitationStatus.pending },
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
      expect(result).toEqual(mockInvites);
    });
  });

  describe('updateStatus', () => {
    it('should update status without acceptedAt', async () => {
      const mockResult = { id: 'inv-1', status: InvitationStatus.revoked };
      prismaService.workspaceInvitation.update.mockResolvedValue(mockResult);

      const result = await repository.updateStatus(
        'inv-1',
        InvitationStatus.revoked,
      );

      expect(prismaService.workspaceInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: InvitationStatus.revoked },
      });
      expect(result).toEqual(mockResult);
    });

    it('should update status with acceptedAt date', async () => {
      const now = new Date();
      const mockResult = {
        id: 'inv-1',
        status: InvitationStatus.accepted,
        acceptedAt: now,
      };
      prismaService.workspaceInvitation.update.mockResolvedValue(mockResult);

      const result = await repository.updateStatus(
        'inv-1',
        InvitationStatus.accepted,
        now,
      );

      expect(prismaService.workspaceInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: InvitationStatus.accepted, acceptedAt: now },
      });
      expect(result).toEqual(mockResult);
    });
  });
});
