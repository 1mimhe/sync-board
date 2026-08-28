import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceMemberRepository } from '../../repositories/workspace-member.repository';
import { PrismaService } from '../../../../common/database/prisma.service';
import { WorkspaceRole } from '@prisma/client';

describe('WorkspaceMemberRepository', () => {
  let repository: WorkspaceMemberRepository;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      workspaceMember: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceMemberRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    repository = module.get<WorkspaceMemberRepository>(
      WorkspaceMemberRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findMember', () => {
    it('should find member by compound unique key workspaceId_userId', async () => {
      const mockMember = {
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'u-1',
        role: WorkspaceRole.owner,
      };
      prismaService.workspaceMember.findUnique.mockResolvedValue(mockMember);

      const result = await repository.findMember('ws-1', 'u-1');

      expect(prismaService.workspaceMember.findUnique).toHaveBeenCalledWith({
        where: { workspaceId_userId: { workspaceId: 'ws-1', userId: 'u-1' } },
      });
      expect(result).toEqual(mockMember);
    });
  });

  describe('findMemberById', () => {
    it('should find member by member id', async () => {
      const mockMember = {
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'u-1',
        role: WorkspaceRole.member,
      };
      prismaService.workspaceMember.findUnique.mockResolvedValue(mockMember);

      const result = await repository.findMemberById('m-1');

      expect(prismaService.workspaceMember.findUnique).toHaveBeenCalledWith({
        where: { id: 'm-1' },
      });
      expect(result).toEqual(mockMember);
    });
  });

  describe('findMembersWithUser', () => {
    it('should find all members of a workspace with user profile details', async () => {
      const mockMembers = [
        {
          id: 'm-1',
          workspaceId: 'ws-1',
          userId: 'u-1',
          role: WorkspaceRole.owner,
          user: {
            id: 'u-1',
            displayName: 'Owner',
            email: 'owner@test.com',
            avatarUrl: null,
          },
        },
      ];
      prismaService.workspaceMember.findMany.mockResolvedValue(mockMembers);

      const result = await repository.findMembersWithUser('ws-1');

      expect(prismaService.workspaceMember.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      });
      expect(result).toEqual(mockMembers);
    });
  });

  describe('countOwners', () => {
    it('should count owners in workspace', async () => {
      prismaService.workspaceMember.count.mockResolvedValue(2);

      const count = await repository.countOwners('ws-1');

      expect(prismaService.workspaceMember.count).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1', role: WorkspaceRole.owner },
      });
      expect(count).toBe(2);
    });
  });

  describe('findOtherOwner', () => {
    it('should find other owner excluding specified user id', async () => {
      const otherOwner = {
        id: 'm-2',
        workspaceId: 'ws-1',
        userId: 'u-2',
        role: WorkspaceRole.owner,
      };
      prismaService.workspaceMember.findFirst.mockResolvedValue(otherOwner);

      const result = await repository.findOtherOwner('ws-1', 'u-1');

      expect(prismaService.workspaceMember.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: 'ws-1',
          role: WorkspaceRole.owner,
          userId: { not: 'u-1' },
        },
      });
      expect(result).toEqual(otherOwner);
    });
  });

  describe('createMember', () => {
    it('should create new member with role', async () => {
      const createdMember = {
        id: 'm-new',
        workspaceId: 'ws-1',
        userId: 'u-3',
        role: WorkspaceRole.admin,
      };
      prismaService.workspaceMember.create.mockResolvedValue(createdMember);

      const result = await repository.createMember(
        'ws-1',
        'u-3',
        WorkspaceRole.admin,
      );

      expect(prismaService.workspaceMember.create).toHaveBeenCalledWith({
        data: { workspaceId: 'ws-1', userId: 'u-3', role: WorkspaceRole.admin },
      });
      expect(result).toEqual(createdMember);
    });
  });

  describe('updateRole', () => {
    it('should update role of member', async () => {
      const updatedMember = { id: 'm-1', role: WorkspaceRole.admin };
      prismaService.workspaceMember.update.mockResolvedValue(updatedMember);

      const result = await repository.updateRole('m-1', WorkspaceRole.admin);

      expect(prismaService.workspaceMember.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { role: WorkspaceRole.admin },
      });
      expect(result).toEqual(updatedMember);
    });
  });

  describe('removeMember', () => {
    it('should delete member by id', async () => {
      prismaService.workspaceMember.delete.mockResolvedValue({ id: 'm-1' });

      await repository.removeMember('m-1');

      expect(prismaService.workspaceMember.delete).toHaveBeenCalledWith({
        where: { id: 'm-1' },
      });
    });
  });
});
