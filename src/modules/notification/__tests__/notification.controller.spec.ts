import { NotificationController } from '../controllers/notification.controller';
import type { NotificationService } from '../services/notification.service';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: {
    listForUser: jest.Mock;
    getUnreadCount: jest.Mock;
    markRead: jest.Mock;
    markAllRead: jest.Mock;
  };

  beforeEach(() => {
    service = {
      listForUser: jest.fn(),
      getUnreadCount: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };
    controller = new NotificationController(
      service as unknown as NotificationService,
    );
  });

  it('delegates list to service with caller id', async () => {
    const user = { sub: 'u-1' };
    await controller.list(user as never, { unreadOnly: true });
    expect(service.listForUser).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({ unreadOnly: true }),
    );
  });

  it('returns unread count', async () => {
    service.getUnreadCount.mockResolvedValue(3);
    await expect(
      controller.unreadCount({ sub: 'u-1' } as never),
    ).resolves.toEqual({ count: 3 });
  });

  it('delegates read-all and mark-read', async () => {
    await controller.markAllRead({ sub: 'u-1' } as never);
    expect(service.markAllRead).toHaveBeenCalledWith('u-1');
    await controller.markRead({ sub: 'u-1' } as never, 'n-1');
    expect(service.markRead).toHaveBeenCalledWith('u-1', 'n-1');
  });
});
