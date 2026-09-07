import { CardTimeController } from '../../controllers/card-time.controller';
import { CardTimeService } from '../../services/card-time.service';

describe('CardTimeController', () => {
  let controller: CardTimeController;
  let timeService: jest.Mocked<CardTimeService>;
  const mockUser = { sub: 'user-1' } as any;

  beforeEach(() => {
    timeService = {
      setEstimate: jest.fn(),
      logTime: jest.fn(),
      getTracking: jest.fn(),
    } as unknown as jest.Mocked<CardTimeService>;
    controller = new CardTimeController(timeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should set estimate', async () => {
    timeService.setEstimate.mockResolvedValue({ id: 'c-1' } as any);
    await expect(
      controller.setEstimate(
        'ws-1',
        'b-1',
        'c-1',
        { estimateMinutes: 60 },
        mockUser,
      ),
    ).resolves.toBeDefined();
    expect(timeService.setEstimate).toHaveBeenCalledWith(
      'b-1',
      'ws-1',
      'c-1',
      { estimateMinutes: 60 },
      'user-1',
    );
  });

  it('should log time', async () => {
    timeService.logTime.mockResolvedValue({ id: 'c-1' } as any);
    await expect(
      controller.logTime('ws-1', 'b-1', 'c-1', { minutes: 15 }, mockUser),
    ).resolves.toBeDefined();
  });

  it('should get tracking', async () => {
    timeService.getTracking.mockResolvedValue({
      estimate: 60,
      logged: 10,
      remaining: 50,
      entries: { items: [], pagination: { cursor: null, hasMore: false } },
    });
    const result = await controller.getTracking('ws-1', 'b-1', 'c-1', {});
    expect(result.logged).toBe(10);
  });
});
