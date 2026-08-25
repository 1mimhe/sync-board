import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole, Prisma } from '@prisma/client';
import { WorkspaceService } from '../../services/workspace.service';
import { WorkspaceRepository } from '../../repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../../repositories/workspace-member.repository';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../../common/exceptions/app.exception';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let workspaceRepo: DeepMockProxy<WorkspaceRepository>;
  let memberRepo: DeepMockProxy<WorkspaceMemberRepository>;
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  beforeEach(async () => {
    workspaceRepo = mockDeep<WorkspaceRepository>();
    memberRepo = mockDeep<WorkspaceMemberRepository>();
    eventEmitter = mockDeep<EventEmitter2>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: WorkspaceRepository, useValue: workspaceRepo },
        { provide: WorkspaceMemberRepository, useValue: memberRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create workspace with generated slug and emit event', async () => {
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      const mockWorkspace = {
        id: 'ws-1',
        name: 'Engineering',
        slug: 'engineering',
        ownerId: 'user-1',
      };
      workspaceRepo.createWorkspaceWithOwner.mockResolvedValue(mockWorkspace as any);

      const result = await service.create({ name: 'Engineering' }, 'user-1');

      expect(result).toEqual(mockWorkspace);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workspace.created',
        expect.anything(),
      );
    });

    it('should retry on P2002 error during create and succeed on second attempt', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      const mockWorkspace = { id: 'ws-1', name: 'Eng', slug: 'eng' };
      workspaceRepo.createWorkspaceWithOwner
        .mockRejectedValueOnce(p2002Error)
        .mockResolvedValueOnce(mockWorkspace as any);

      const res = await service.create({ name: 'Eng' }, 'u-1');
      expect(res).toEqual(mockWorkspace);
    });

    it('should throw BusinessRuleException SLUG_COLLISION if create fails 3 times with P2002', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      workspaceRepo.createWorkspaceWithOwner.mockRejectedValue(p2002Error);

      await expect(service.create({ name: 'Eng' }, 'u-1')).rejects.toThrow(BusinessRuleException);
    });

    it('should rethrow non-P2002 errors during create', async () => {
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      workspaceRepo.createWorkspaceWithOwner.mockRejectedValue(new Error('DB failure'));

      await expect(service.create({ name: 'Eng' }, 'u-1')).rejects.toThrow('DB failure');
    });
  });

  describe('findAllForUser', () => {
    it('should return workspaces for user', async () => {
      const mockList = [{ id: 'ws-1', name: 'WS 1', role: WorkspaceRole.owner }];
      workspaceRepo.findUserWorkspaces.mockResolvedValue(mockList as any);

      const res = await service.findAllForUser('user-1');
      expect(res).toEqual(mockList);
    });
  });

  describe('findByIdWithRole', () => {
    it('should throw EntityNotFoundException when workspace not found', async () => {
      workspaceRepo.findById.mockResolvedValue(null);

      await expect(service.findByIdWithRole('ws-1', 'user-1')).rejects.toThrow(
        EntityNotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not member', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', name: 'WS 1' } as any);
      memberRepo.findMember.mockResolvedValue(null);

      await expect(service.findByIdWithRole('ws-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should return workspace with user role', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', name: 'WS 1' } as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.admin } as any);

      const res = await service.findByIdWithRole('ws-1', 'user-1');
      expect(res).toEqual({ id: 'ws-1', name: 'WS 1', role: WorkspaceRole.admin });
    });
  });

  describe('findBySlug', () => {
    it('should throw EntityNotFoundException when slug not found', async () => {
      workspaceRepo.findBySlug.mockResolvedValue(null);

      await expect(service.findBySlug('invalid-slug', 'user-1')).rejects.toThrow(
        EntityNotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not member of slug workspace', async () => {
      workspaceRepo.findBySlug.mockResolvedValue({ id: 'ws-1', slug: 'my-slug' } as any);
      memberRepo.findMember.mockResolvedValue(null);

      await expect(service.findBySlug('my-slug', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should return workspace and role when found', async () => {
      workspaceRepo.findBySlug.mockResolvedValue({ id: 'ws-1', slug: 'my-slug' } as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.owner } as any);

      const res = await service.findBySlug('my-slug', 'user-1');
      expect(res).toEqual({ id: 'ws-1', slug: 'my-slug', role: WorkspaceRole.owner });
    });
  });

  describe('update', () => {
    it('should update workspace without changing name', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', name: 'Old' } as any);
      const updatedWs = { id: 'ws-1', name: 'Old', description: 'Updated desc' };
      workspaceRepo.update.mockResolvedValue(updatedWs as any);

      const res = await service.update('ws-1', {
        description: 'Updated desc',
      });
      expect(res).toEqual(updatedWs);
    });

    it('should update workspace with new name and new slug', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', name: 'Old Name' } as any);
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      const updatedWs = { id: 'ws-1', name: 'New Name', slug: 'new-name' };
      workspaceRepo.update.mockResolvedValue(updatedWs as any);

      const res = await service.update('ws-1', { name: 'New Name' });
      expect(res).toEqual(updatedWs);
    });

    it('should retry on P2002 during update and throw BusinessRuleException on 3 failures', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', name: 'Old Name' } as any);
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      workspaceRepo.update.mockRejectedValue(p2002Error);

      await expect(service.update('ws-1', { name: 'New Name' })).rejects.toThrow(BusinessRuleException);
    });

    it('should rethrow non-P2002 errors during update with new name', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', name: 'Old Name' } as any);
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      workspaceRepo.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.update('ws-1', { name: 'New Name' })).rejects.toThrow('Update failed');
    });
  });

  describe('archive', () => {
    it('should archive workspace when found', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      workspaceRepo.archive.mockResolvedValue(undefined as any);

      await service.archive('ws-1');

      expect(workspaceRepo.archive).toHaveBeenCalledWith('ws-1');
    });

    it('should throw EntityNotFoundException when workspace does not exist', async () => {
      workspaceRepo.findById.mockResolvedValue(null);

      await expect(service.archive('ws-missing')).rejects.toThrow(EntityNotFoundException);
      expect(workspaceRepo.archive).not.toHaveBeenCalled();
    });
  });

  describe('isUserMember', () => {
    it('should return true if member exists', async () => {
      memberRepo.findMember.mockResolvedValue({ id: 'm-1' } as any);
      expect(await service.isUserMember('ws-1', 'u-1')).toBe(true);
    });

    it('should return false if member does not exist', async () => {
      memberRepo.findMember.mockResolvedValue(null);
      expect(await service.isUserMember('ws-1', 'u-1')).toBe(false);
    });
  });

  describe('generateUniqueSlug edge cases', () => {
    it('should handle slug collisions in existsBySlug loop and generate random suffix', async () => {
      workspaceRepo.existsBySlug
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      workspaceRepo.createWorkspaceWithOwner.mockResolvedValue({ id: 'ws-1' } as any);

      await service.create({ name: 'Duplicate Name' }, 'u-1');

      expect(workspaceRepo.existsBySlug).toHaveBeenCalledTimes(2);
    });

    it('should fallback to "workspace" if name has no alphanumeric characters', async () => {
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      workspaceRepo.createWorkspaceWithOwner.mockResolvedValue({ id: 'ws-1' } as any);

      await service.create({ name: '!@#$%' }, 'u-1');

      expect(workspaceRepo.createWorkspaceWithOwner).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'workspace' }),
        'u-1',
      );
    });
  });
});
