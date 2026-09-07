import { existsSync } from 'fs';
import { join } from 'path';
import { resolveTemplatesDir } from '../../utils/mail-template.util';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));

describe('mail-template.util', () => {
  const mockExists = existsSync as jest.Mock;

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should resolve an existing templates directory', () => {
    mockExists.mockReturnValue(true);
    const dir = resolveTemplatesDir();
    expect(typeof dir).toBe('string');
  });

  it('should fall back to default when no candidate exists', () => {
    mockExists.mockReturnValue(false);
    const dir = resolveTemplatesDir();
    expect(dir).toBe(join(__dirname, '..', '..', 'templates'));
  });
});
