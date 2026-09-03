import {
  COLLABORATOR_COLORS,
  assignCollaboratorColor,
  hashUserId,
} from '../collaborator-color.util';

describe('collaborator-color.util', () => {
  describe('hashUserId', () => {
    it('returns a positive integer for a valid UUID', () => {
      const hash = hashUserId('00000000-0000-4000-8000-000000000001');
      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(hash)).toBe(true);
    });

    it('is deterministic for the same userId', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      expect(hashUserId(id)).toBe(hashUserId(id));
    });
  });

  describe('assignCollaboratorColor', () => {
    it('assigns a palette color when no colors are taken', () => {
      const color = assignCollaboratorColor(
        '00000000-0000-4000-8000-000000000001',
        new Set(),
      );
      expect(COLLABORATOR_COLORS).toContain(color as any);
    });

    it('picks the next available color when initial hash color is taken', () => {
      const userId = '00000000-0000-4000-8000-000000000001';
      const initialColor = assignCollaboratorColor(userId, new Set());

      const nextColor = assignCollaboratorColor(
        userId,
        new Set([initialColor]),
      );
      expect(nextColor).not.toBe(initialColor);
      expect(COLLABORATOR_COLORS).toContain(nextColor as any);
    });

    it('falls back to golden ratio HSL when all 16 palette colors are taken', () => {
      const userId = '00000000-0000-4000-8000-000000000001';
      const taken = new Set(COLLABORATOR_COLORS);

      const color = assignCollaboratorColor(userId, taken);
      expect(color).toMatch(/^hsl\(\d+,\s*75%,\s*50%\)$/);
      expect(COLLABORATOR_COLORS).not.toContain(color as any);
    });

    it('accepts an array/iterable of taken colors', () => {
      const userId = '00000000-0000-4000-8000-000000000001';
      const color = assignCollaboratorColor(userId, [COLLABORATOR_COLORS[0]]);
      expect(typeof color).toBe('string');
    });
  });
});
