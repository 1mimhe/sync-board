import { hashToken } from '../hash.util';
import { createHash } from 'crypto';

describe('hashToken', () => {
  it('should generate deterministic 64-character SHA-256 hex string', () => {
    const rawToken = 'my-secret-refresh-token-123';
    const expectedHash = createHash('sha256').update(rawToken).digest('hex');

    const result = hashToken(rawToken);

    expect(result).toBe(expectedHash);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce different hashes for different token inputs', () => {
    const hash1 = hashToken('token-alpha');
    const hash2 = hashToken('token-beta');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty string correctly', () => {
    const emptyHash = createHash('sha256').update('').digest('hex');
    expect(hashToken('')).toBe(emptyHash);
  });

  it('should handle unicode and special characters', () => {
    const unicodeToken = '🔑-token-special-!@#$%^&*()_+-=[]{}|;:,.<>?';
    const expectedHash = createHash('sha256').update(unicodeToken).digest('hex');

    expect(hashToken(unicodeToken)).toBe(expectedHash);
  });
});
