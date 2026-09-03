import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Resolves the directory containing Handlebars email templates.
 * Inspects multiple candidate paths to ensure seamless resolution in both
 * development (ts-node / tsx / source directory) and compiled production builds
 * (dist/modules/mail/templates vs dist/src/modules/mail/templates).
 */
export function resolveTemplatesDir(): string {
  const candidates = [
    join(__dirname, '..', 'templates'),
    join(__dirname, '../../modules/mail/templates'),
    join(process.cwd(), 'dist/modules/mail/templates'),
    join(process.cwd(), 'dist/src/modules/mail/templates'),
    join(process.cwd(), 'src/modules/mail/templates'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return join(__dirname, '..', 'templates');
}
