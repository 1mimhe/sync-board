import { existsSync } from 'fs';
import { resolveTemplatesDir } from '../../utils/mail-template.util';

describe('mail-template.util', () => {
  it('should resolve an existing templates directory', () => {
    const dir = resolveTemplatesDir();
    expect(typeof dir).toBe('string');
    expect(existsSync(dir)).toBe(true);
  });
});
