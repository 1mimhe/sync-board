/**
 * Resolves the frontend client URL used for CORS origins and OAuth redirects.
 *
 * An explicitly configured `CLIENT_URL` always wins. Otherwise the default
 * follows `NODE_ENV` so one codebase serves both topologies without edits:
 * - production (Docker / VPS) .... http://localhost (edge proxy on :80)
 * - anything else (Vite HMR dev) . http://localhost:5173
 *
 * @param env - Environment values (usually from ConfigService)
 * @returns The resolved client URL
 */
export function resolveClientUrl(env: {
  CLIENT_URL?: string;
  NODE_ENV?: string;
}): string {
  if (env.CLIENT_URL) {
    return env.CLIENT_URL;
  }
  return env.NODE_ENV === 'production'
    ? 'http://localhost'
    : 'http://localhost:5173';
}
