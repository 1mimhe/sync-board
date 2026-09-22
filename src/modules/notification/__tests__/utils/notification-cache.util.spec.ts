import { unreadCountKey } from '../../utils/notification-cache.util';

describe('notification-cache.util', () => {
  describe('unreadCountKey', () => {
    it('formats a Redis unread notification key for a user UUID', () => {
      const userId = '11111111-2222-4333-8444-555555555555';
      expect(unreadCountKey(userId)).toBe(
        'notifications:unread:11111111-2222-4333-8444-555555555555',
      );
    });
  });
});
