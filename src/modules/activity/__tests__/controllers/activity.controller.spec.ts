import {
  ActivityController,
  BoardActivityController,
} from '../../controllers/activity.controller';
import type { ActivityService } from '../../services/activity.service';

describe('Activity controllers', () => {
  const page = {
    items: [{ id: 1n }],
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
  });

  it('delegates legacy board feed preserving UUID cursors', async () => {
    const service = {
      getLegacyBoardFeed: jest
        .fn()
        .mockResolvedValue({ items: [], pagination: {} }),
      getBoardFeed: jest.fn().mockResolvedValue(page),
    };
    const controller = new BoardActivityController(
      service as unknown as ActivityService,
    );
    await controller.getBoardFeed('ws-1', 'b-1', {});
    expect(service.getLegacyBoardFeed).toHaveBeenCalledWith('ws-1', 'b-1', {});
    const result = await controller.getBoardActivity('ws-1', 'b-1', {});
    expect(service.getBoardFeed).toHaveBeenCalledWith('ws-1', 'b-1', {});
    expect(result.items[0].id).toBe('1');
  });
});
