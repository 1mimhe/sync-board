import request from 'supertest';
import { App } from 'supertest/types';
import type { Response } from 'supertest';

/**
 * Typed HTTP helpers for e2e specs.
 *
 * Conventions (e2e-test-generation.md §3.1):
 *  - Every success response is enveloped: { success: true, data, meta }
 *  - Every error response is enveloped: { success: false, error: { code, ... } }
 *  - Specs ALWAYS assert the envelope and the exact error `code`.
 */

type Server = App | unknown;

export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  createdAt: string;
}

/** Perform a request against the in-process HTTP server (global prefix is `/api`). */
export function req(server: Server) {
  return request(server as App);
}

/** Assert a success envelope and return `data`. */
export function expectData<T = Record<string, unknown>>(
  res: Response,
  expectedStatus: number,
): T {
  expect(res.status).toBe(expectedStatus);
  expect(res.body).toMatchObject({ success: true });
  expect(res.body.data).toBeDefined();
  expect(res.body.meta).toMatchObject({
    timestamp: expect.any(String),
    requestId: expect.any(String),
  });
  return res.body.data as T;
}

/** Assert an error envelope with the exact error code. */
export function expectError(
  res: Response,
  expectedStatus: number,
  expectedCode: string,
): Record<string, unknown> {
  expect(res.status).toBe(expectedStatus);
  expect(res.body.success).toBe(false);
  expect(res.body.error).toMatchObject({
    code: expectedCode,
    statusCode: expectedStatus,
    timestamp: expect.any(String),
  });
  return res.body.error;
}

/** Extract the raw `refreshToken` Set-Cookie value from an auth response. */
export function extractRefreshCookie(res: Response): string {
  const setCookie = res.headers['set-cookie'];
  expect(setCookie).toBeDefined();
  const cookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).find(
    (c: string) => c.startsWith('refreshToken='),
  );
  expect(cookie).toBeDefined();
  return cookie as string;
}

/** Parse a `name=value` pair out of a Set-Cookie header string. */
export function cookieValue(setCookie: string, name: string): string {
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  expect(match).not.toBeNull();
  return match![1];
}

/** Assert attributes of the refresh-token cookie contract (test-cases-auth §13.1). */
export function expectRefreshCookieContract(res: Response): void {
  const setCookie = extractRefreshCookie(res);
  expect(setCookie).toContain('HttpOnly');
  expect(setCookie.toLowerCase()).toContain('samesite=lax');
  expect(setCookie).toContain('Path=/api/auth');
  // maxAge: 7 days in ms
  expect(setCookie).toContain(`Max-Age=${7 * 24 * 60 * 60}`);
  // `Secure` must NOT be present outside production (NODE_ENV=test)
  expect(setCookie).not.toContain('Secure');
}
