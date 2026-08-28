import { Test, TestingModule } from '@nestjs/testing';
import { LabelActivityListener } from '../../listeners/label-activity.listener';
import { ActivityRepository } from '../../repositories/activity.repository';
import {
  LabelCreatedEvent,
  LabelUpdatedEvent,
  LabelDeletedEvent,
} from '../../../board/label/events/label.events';
import { ActionType, EntityType } from '@prisma/client';

describe('LabelActivityListener', () => {
  let listener: LabelActivityListener;
  let activityRepo: jest.Mocked<ActivityRepository>;

  beforeEach(async () => {
    activityRepo = {
      create: jest.fn().mockResolvedValue({ id: 'act-1' } as any),
      findByBoardId: jest.fn(),
    } as unknown as jest.Mocked<ActivityRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabelActivityListener,
        { provide: ActivityRepository, useValue: activityRepo },
      ],
    }).compile();

    listener = module.get<LabelActivityListener>(LabelActivityListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log label created event for board-scoped labels', async () => {
    const event = new LabelCreatedEvent(
      { id: 'lbl-1', name: 'Bug' } as any,
      'ws-1',
      'b-1',
      'u-1',
    );
    await listener.handleLabelCreatedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-1',
      action: ActionType.created,
      entityType: EntityType.label,
      entityId: 'lbl-1',
      entityTitle: 'Bug',
    });
  });

  it('should skip workspace-level label creation (no board scope)', async () => {
    const event = new LabelCreatedEvent(
      { id: 'lbl-ws' } as any,
      'ws-1',
      null,
      'u-1',
    );
    await listener.handleLabelCreatedEvent(event);
    expect(activityRepo.create).not.toHaveBeenCalled();
  });

  it('should contain label created event failures', async () => {
    activityRepo.create.mockRejectedValue(new Error('fail'));
    const event = new LabelCreatedEvent(
      { id: 'lbl-1', name: 'Bug' } as any,
      'ws-1',
      'b-1',
      'u-1',
    );
    await expect(
      listener.handleLabelCreatedEvent(event),
    ).resolves.not.toThrow();
  });

  it('should log label updated event and contain failures', async () => {
    const event = new LabelUpdatedEvent(
      { id: 'lbl-1', name: 'Hot' } as any,
      'b-1',
      'u-3',
    );
    await listener.handleLabelUpdatedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-3',
      action: ActionType.updated,
      entityType: EntityType.label,
      entityId: 'lbl-1',
      entityTitle: 'Hot',
    });

    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleLabelUpdatedEvent(event),
    ).resolves.not.toThrow();
  });

  it('should log label deleted event and contain failures', async () => {
    const event = new LabelDeletedEvent('lbl-1', 'b-1', 'u-3');
    await listener.handleLabelDeletedEvent(event);
    expect(activityRepo.create).toHaveBeenCalledWith({
      boardId: 'b-1',
      userId: 'u-3',
      action: ActionType.deleted,
      entityType: EntityType.label,
      entityId: 'lbl-1',
    });

    activityRepo.create.mockRejectedValue(new Error('fail'));
    await expect(
      listener.handleLabelDeletedEvent(event),
    ).resolves.not.toThrow();
  });
});
