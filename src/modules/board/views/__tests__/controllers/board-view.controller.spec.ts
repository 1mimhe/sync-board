import { BoardViewController } from '../../controllers/board-view.controller';
import { CardViewService } from '../../services/card-view.service';

describe('BoardViewController', () => {
  let controller: BoardViewController;
  let viewService: jest.Mocked<CardViewService>;

  beforeEach(() => {
    viewService = {
      calendar: jest.fn(),
      timeline: jest.fn(),
      table: jest.fn(),
    } as unknown as jest.Mocked<CardViewService>;
    controller = new BoardViewController(viewService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return calendar view', async () => {
    viewService.calendar.mockResolvedValue({
      items: [{ id: 'c-1' }],
      pagination: { cursor: null, hasMore: false },
    } as any);
    const result = await controller.calendar('ws-1', 'b-1', {
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(result.items).toHaveLength(1);
  });

  it('should return timeline view', async () => {
    viewService.timeline.mockResolvedValue({
      items: [],
      pagination: { cursor: null, hasMore: false },
    });
    await expect(
      controller.timeline('ws-1', 'b-1', {} as any),
    ).resolves.toBeDefined();
  });

  it('should return table view', async () => {
    viewService.table.mockResolvedValue({
      items: [],
      pagination: { cursor: null, hasMore: false },
    });
    await expect(
      controller.table('ws-1', 'b-1', {} as any),
    ).resolves.toBeDefined();
  });
});
