import { resolveClientUrl } from '../client-url.util';

describe('resolveClientUrl', () => {
  it('should prefer an explicitly configured CLIENT_URL in any environment', () => {
    expect(
      resolveClientUrl({
        CLIENT_URL: 'https://syncboard.example.com',
        NODE_ENV: 'production',
      }),
    ).toBe('https://syncboard.example.com');
    expect(
      resolveClientUrl({
        CLIENT_URL: 'http://localhost:5173',
        NODE_ENV: 'development',
      }),
    ).toBe('http://localhost:5173');
  });

  it('should default to the edge proxy origin in production', () => {
    expect(resolveClientUrl({ NODE_ENV: 'production' })).toBe(
      'http://localhost',
    );
  });

  it('should default to the Vite dev server outside production', () => {
    expect(resolveClientUrl({ NODE_ENV: 'development' })).toBe(
      'http://localhost:5173',
    );
    expect(resolveClientUrl({})).toBe('http://localhost:5173');
    expect(resolveClientUrl({ CLIENT_URL: '' })).toBe('http://localhost:5173');
  });
});
