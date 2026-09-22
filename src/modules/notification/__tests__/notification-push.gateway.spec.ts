import { NotificationPushGateway } from '../notification-push.gateway';

describe('NotificationPushGateway', () => {
  it('emits to user room both events with -1 sentinel', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const gateway = new NotificationPushGateway();
    (gateway as unknown as { server: unknown }).server = { to };
    gateway.emitToUser('u-1', { id: 'n-1' } as never);
    expect(to).toHaveBeenCalledWith('user:u-1');
    expect(emit).toHaveBeenCalledWith('notification:new', { id: 'n-1' });
    expect(emit).toHaveBeenCalledWith('notification:count', {
      unreadCount: -1,
    });
  });

  it('does not throw when server is missing', () => {
    const gateway = new NotificationPushGateway();
    expect(() =>
      gateway.emitToUser('u-1', { id: 'n-1' } as never),
    ).not.toThrow();
  });
});
