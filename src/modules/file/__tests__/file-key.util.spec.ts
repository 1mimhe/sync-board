import { buildS3Key, sanitizeFileName } from '../utils/file-key.util';

describe('file-key.util', () => {
  describe('sanitizeFileName', () => {
    it('strips directory components', () => {
      expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
      expect(sanitizeFileName('a\\b\\evil.png')).toBe('evil.png');
    });

    it('replaces unsafe characters with underscores', () => {
      expect(sanitizeFileName('my file (1).png')).toBe('my_file__1_.png');
    });

    it('truncates to 100 chars and never returns empty', () => {
      expect(sanitizeFileName('a'.repeat(200))).toHaveLength(100);
      expect(sanitizeFileName('...')).toBe('...');
      expect(sanitizeFileName('???')).toBe('___');
      expect(sanitizeFileName('')).toBe('file');
    });
  });

  describe('buildS3Key', () => {
    it('builds a namespaced key with a sanitized name', () => {
      const key = buildS3Key('ws-1', 'card', 'card-1', '../x.png');
      expect(key).toMatch(
        /^workspaces\/ws-1\/cards\/card-1\/[0-9a-f-]+-x\.png$/,
      );
    });
  });
});
