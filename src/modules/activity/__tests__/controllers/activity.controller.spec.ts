import {
  ActivityController,
  BoardActivityController,
} from '../../controllers/activity.controller';
import type { ActivityService } from '../../services/activity.service';

describe('Activity controllers', () => {
  const page = {
    items: [
      {
        id: 1n,
        workspaceId: 'ws-1',
        boardId: 'b-1',
        entityType: 'card',
        entityId: 'c-1',
        action: 'created',
        actorId: 'u-1',
        actor: { id: 'u-1', displayName: 'Jane', avatarUrl: null },
        payload: {},
        metadata: null,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    ],
    pagination: { cursor: null, hasMore: false },
  };

  it('maps workspace feed BigInt ids to strings', async () => {
    const service = { getWorkspaceFeed: jest.fn().mockResolvedValue(page) };
    const controller = new ActivityController(
      service as unknown as ActivityService,
    );
    const result = await controller.getWorkspaceFeed('ws-1', {});
    expect(service.getWorkspaceFeed).toHaveBeenCalledWith('ws-1', {});
    expect(result.items[0].id).toBe('1');
    expect(result.items[0].actor.displayName).toBe('Jane');
  });

  it('delegates board feed with composite cursor', async () => {
    const service = {
      getBoardFeed: jest.fn().mockResolvedValue(page),
    };
    const controller = new BoardActivityController(
      service as unknown as ActivityService,
    );
    const result = await controller.getBoardFeed('ws-1', 'b-1', {});
    expect(service.getBoardFeed).toHaveBeenCalledWith('ws-1', 'b-1', {});
    expect(result.items[0].id).toBe('1');
  });
});
