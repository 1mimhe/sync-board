import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceActivityListener } from '../../listeners/workspace-activity.listener';
import { ActivityRepository } from '../../repositories/activity.repository';
import { WorkspaceRole } from '@prisma/client';
import {
  WorkspaceMemberLeftEvent,
  WorkspaceOwnershipTransferredEvent,
  WorkspaceCreatedEvent,
  WorkspaceMemberAddedEvent,
  WorkspaceMemberRemovedEvent,
  WorkspaceMemberRoleChangedEvent,
} from '../../../workspace/events/workspace.events';

describe('WorkspaceActivityListener', () => {
  let listener: WorkspaceActivityListener;
  let repo: { record: jest.Mock };

  beforeEach(async () => {
    repo = { record: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceActivityListener,
        { provide: ActivityRepository, useValue: repo },
      ],
    }).compile();
    listener = module.get(WorkspaceActivityListener);
  });

  it('records workspace created with owner as actor', async () => {
    await listener.handleWorkspaceCreatedEvent(
      new WorkspaceCreatedEvent(
        { id: 'ws-1', name: 'Team' } as never,
        'u-owner',
      ),
    );
    expect(repo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        entityType: 'workspace',
        actorId: 'u-owner',
        action: 'created',
      }),
    );
  });

  it('records member added, removed, and role changed', async () => {
    await listener.handleMemberAddedEvent(
      new WorkspaceMemberAddedEvent('ws-1', 'u-1', WorkspaceRole.member),
    );
    expect(repo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        entityType: 'workspace',
        actorId: 'u-1',
        action: 'member_added',
        payload: { role: WorkspaceRole.member },
      }),
    );

    await listener.handleMemberRemovedEvent(
      new WorkspaceMemberRemovedEvent('ws-1', 'u-1'),
    );
    expect(repo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        entityType: 'workspace',
        actorId: 'u-1',
        action: 'member_removed',
        payload: { userId: 'u-1' },
      }),
    );

    await listener.handleMemberRoleChangedEvent(
      new WorkspaceMemberRoleChangedEvent(
        'ws-1',
        'u-1',
        WorkspaceRole.member,
        WorkspaceRole.admin,
      ),
    );
    expect(repo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        entityType: 'workspace',
        actorId: 'u-1',
        action: 'member_role_changed',
        payload: {
          oldRole: WorkspaceRole.member,
          newRole: WorkspaceRole.admin,
        },
      }),
    );
  });

  it('records member left and ownership transfer', async () => {
    await listener.handleMemberLeftEvent(
      new WorkspaceMemberLeftEvent('ws-1', 'u-1'),
    );
    expect(repo.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'member_left' }),
    );
    await listener.handleOwnershipTransferredEvent(
      new WorkspaceOwnershipTransferredEvent('ws-1', 'u-old', 'u-new'),
    );
    expect(repo.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ownership_transferred' }),
    );
  });

  it('swallows record failures', async () => {
    repo.record.mockRejectedValue(new Error('db down'));
    await expect(
      listener.handleMemberLeftEvent(
        new WorkspaceMemberLeftEvent('ws-1', 'u-1'),
      ),
    ).resolves.not.toThrow();
  });
});
