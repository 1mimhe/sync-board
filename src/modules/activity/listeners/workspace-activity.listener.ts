import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ActivityRepository,
  RecordActivityInput,
} from '../repositories/activity.repository';
import type {
  WorkspaceCreatedEvent,
  WorkspaceMemberAddedEvent,
  WorkspaceMemberLeftEvent,
  WorkspaceMemberRemovedEvent,
  WorkspaceMemberRoleChangedEvent,
  WorkspaceOwnershipTransferredEvent,
} from '../../workspace/events/workspace.events';
import { WORKSPACE_EVENTS } from '../../workspace/events/workspace-events.constants';

@Injectable()
export class WorkspaceActivityListener {
  private readonly logger = new Logger(WorkspaceActivityListener.name);
  constructor(private readonly activityRepo: ActivityRepository) {}

  private async record(input: RecordActivityInput): Promise<void> {
    try {
      await this.activityRepo.record(input);
    } catch (error) {
      this.logger.error('Failed to log workspace activity', error);
    }
  }

  @OnEvent(WORKSPACE_EVENTS.created)
  async handleWorkspaceCreatedEvent(
    event: WorkspaceCreatedEvent,
  ): Promise<void> {
    await this.record({
      workspaceId: event.workspace.id,
      entityType: 'workspace',
      entityId: event.workspace.id,
      actorId: event.ownerId,
      action: 'created',
      payload: { entityTitle: event.workspace.name },
    });
  }

  @OnEvent(WORKSPACE_EVENTS.memberAdded)
  async handleMemberAddedEvent(
    event: WorkspaceMemberAddedEvent,
  ): Promise<void> {
    await this.record({
      workspaceId: event.workspaceId,
      entityType: 'workspace',
      entityId: event.workspaceId,
      actorId: event.userId,
      action: 'member_added',
      payload: { role: event.role },
    });
  }

  @OnEvent(WORKSPACE_EVENTS.memberRemoved)
  async handleMemberRemovedEvent(
    event: WorkspaceMemberRemovedEvent,
  ): Promise<void> {
    await this.record({
      workspaceId: event.workspaceId,
      entityType: 'workspace',
      entityId: event.workspaceId,
      actorId: event.userId,
      action: 'member_removed',
      payload: { userId: event.userId },
    });
  }

  @OnEvent(WORKSPACE_EVENTS.memberRoleChanged)
  async handleMemberRoleChangedEvent(
    event: WorkspaceMemberRoleChangedEvent,
  ): Promise<void> {
    await this.record({
      workspaceId: event.workspaceId,
      entityType: 'workspace',
      entityId: event.workspaceId,
      actorId: event.userId,
      action: 'member_role_changed',
      payload: { oldRole: event.oldRole, newRole: event.newRole },
    });
  }

  @OnEvent(WORKSPACE_EVENTS.memberLeft)
  async handleMemberLeftEvent(event: WorkspaceMemberLeftEvent): Promise<void> {
    await this.record({
      workspaceId: event.workspaceId,
      entityType: 'workspace',
      entityId: event.workspaceId,
      actorId: event.userId,
      action: 'member_left',
      payload: { userId: event.userId },
    });
  }

  @OnEvent(WORKSPACE_EVENTS.ownershipTransferred)
  async handleOwnershipTransferredEvent(
    event: WorkspaceOwnershipTransferredEvent,
  ): Promise<void> {
    await this.record({
      workspaceId: event.workspaceId,
      entityType: 'workspace',
      entityId: event.workspaceId,
      actorId: event.previousOwnerId,
      action: 'ownership_transferred',
      payload: {
        previousOwnerId: event.previousOwnerId,
        newOwnerId: event.newOwnerId,
      },
    });
  }
}
