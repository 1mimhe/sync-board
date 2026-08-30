/**
 * E2E environment bootstrap — runs BEFORE any spec/module imports (jest setupFiles).
 * Loads test/.env.test without clobbering variables already exported by CI.
 */
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '.env.test'), override: false });

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
