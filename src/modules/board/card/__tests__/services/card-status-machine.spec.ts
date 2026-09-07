import {
  isStatusTransitionAllowed,
  isCompleteFromStatus,
} from '../../services/card-status-machine';

describe('card-status-machine', () => {
  describe('isStatusTransitionAllowed', () => {
    it('should allow distinct statuses', () => {
      expect(isStatusTransitionAllowed('active', 'done')).toBe(true);
      expect(isStatusTransitionAllowed('closed', 'active')).toBe(true);
    });

    it('should block same-status writes', () => {
      expect(isStatusTransitionAllowed('active', 'active')).toBe(false);
      expect(isStatusTransitionAllowed('done', 'done')).toBe(false);
    });
  });

  describe('isCompleteFromStatus', () => {
    it('should return true for done and closed', () => {
      expect(isCompleteFromStatus('done')).toBe(true);
      expect(isCompleteFromStatus('closed')).toBe(true);
    });

    it('should return false for open statuses', () => {
      expect(isCompleteFromStatus('active')).toBe(false);
      expect(isCompleteFromStatus('not_started')).toBe(false);
    });
  });
});
