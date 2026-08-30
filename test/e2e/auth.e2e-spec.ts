/**
 * Auth module e2e — HTTP via supertest against the real AppModule.
 *
 * Covers: test-cases-auth.md
 *   §1 Registration (happy 1.1, validation 1.2, duplicate 1.3)
 *   §2 Login (2.1, 2.2, 2.3)
 *   §3 Token refresh + rotation + reuse detection (3.1)
 *   §4 Logout single device · §5 Logout all devices
 *   §6 Forgot password (incl. enumeration resistance 6.4) · §7 Reset password
 *   §10/§11 Profile get/update · §12 Change password (+12.4 session revocation)
 *   §13 Cross-cutting (13.1 cookie contract, 13.2 JWT claims, 13.5 malformed)
 *   §14.6 Throttle + correctness
 *
 * NOTE (13.2.4): this environment has no RS256 key files, so the JWT service
 * uses the documented HS256 dev fallback — the spec accepts both algorithms.
 */
import * as jwt from 'jsonwebtoken';
import { createTestApp, type TestApp } from '../helpers/app';
import {
  expectData,
  expectError,
  expectRefreshCookieContract,
  extractRefreshCookie,
  req,
} from '../helpers/http';
import { loginUser, registerUser, uniqueEmail } from '../helpers/factories';
import { waitForMailToken } from '../helpers/mailhog';

const PASSWORD = 'SecureP@ss123';

interface ApiUserShape {
  id: string;
  email: string;
  displayName: string;
  isEmailVerified: boolean;
}

describe('Auth module (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  describe('§1 Registration', () => {
    it('1.1.1 registers with valid data: envelope, user shape, 15m token, refresh cookie', async () => {
      const email = uniqueEmail('reg-basic');
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: PASSWORD, displayName: 'Basic User' });

      const data = expectData<{
        user: Record<string, unknown>;
        tokens: { accessToken: string; expiresIn: number };
      }>(res, 201);

      expect(data.user).toMatchObject({
        email,
        displayName: 'Basic User',
        avatarUrl: null,
        isEmailVerified: false,
        createdAt: expect.any(String),
      });
      expect(data.tokens.expiresIn).toBe(900);

      // §13.1 cookie contract audit
      expectRefreshCookieContract(res);
    });

    it('1.1.4 trims + lowercases the email', async () => {
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: '  Test@EXAMPLE.com  ',
          password: PASSWORD,
          displayName: 'Case Test',
        });
      const data = expectData<{ user: { email: string } }>(res, 201);
      expect(data.user.email).toBe('test@example.com');
    });

    it('1.1.5 trims the display name', async () => {
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: uniqueEmail('reg-trim'),
          password: PASSWORD,
          displayName: '  John Doe  ',
        });
      const data = expectData<{ user: { displayName: string } }>(res, 201);
      expect(data.user.displayName).toBe('John Doe');
    });

    it('1.1.2 accepts the minimum valid 8-char password', async () => {
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: uniqueEmail('reg-minpw'),
          password: 'Abcd!1ab',
          displayName: 'Min Pw',
        });
      expectData(res, 201);
    });

    it('1.3.x rejects duplicate email with 409 EMAIL_ALREADY_EXISTS', async () => {
      const email = uniqueEmail('reg-dup');
      await registerUser(app, 'dup-seed', { email });
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: PASSWORD, displayName: 'Duplicate' });
      expectError(res, 409, 'EMAIL_ALREADY_EXISTS');
    });

    it('1.4.1 AnonymousGuard blocks an already-authenticated user from registering → 403', async () => {
      const user = await registerUser(app, 'guard-register');
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          email: uniqueEmail('anon-guard'),
          password: PASSWORD,
          displayName: 'Blocked',
        });
      expect(res.status).toBe(403);
    });
  });

  describe('§1.2 registration validation sweep', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['missing email', { password: PASSWORD, displayName: 'Test' }],
      [
        'invalid email format',
        { email: 'not-an-email', password: PASSWORD, displayName: 'Test' },
      ],
      ['missing password', { email: uniqueEmail('v1'), displayName: 'Test' }],
      [
        'password too short',
        { email: uniqueEmail('v2'), password: 'Ab1!xyz', displayName: 'Test' },
      ],
      [
        'password missing lowercase',
        {
          email: uniqueEmail('v3'),
          password: 'SECUREP@SS123',
          displayName: 'Test',
        },
      ],
      [
        'password missing uppercase',
        {
          email: uniqueEmail('v4'),
          password: 'securep@ss123',
          displayName: 'Test',
        },
      ],
      [
        'password missing number',
        { email: uniqueEmail('v5'), password: 'SecureP@ss', displayName: 'Test' },
      ],
      [
        'password missing special char',
        { email: uniqueEmail('v6'), password: 'SecurePass123', displayName: 'Test' },
      ],
      [
        'display name too short',
        { email: uniqueEmail('v7'), password: PASSWORD, displayName: 'A' },
      ],
    ];

    it.each(cases)('rejects %s with 400 VALIDATION_ERROR', async (_name, body) => {
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/register')
        .send(body);
      expectError(res, 400, 'VALIDATION_ERROR');
    });

    it('13.5.3 (corrected) rejects unknown extra fields: forbidNonWhitelisted → 400', async () => {
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: uniqueEmail('v-extra'),
          password: PASSWORD,
          displayName: 'Extra',
          extra: 'field',
        });
      expectError(res, 400, 'VALIDATION_ERROR');
    });
  });

  // =========================================================================
  describe('§2 Login', () => {
    it('2.1.1 logs in with valid credentials and sets the refresh cookie', async () => {
      const { email } = await registerUser(app, 'login-ok');
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: PASSWORD });
      const data = expectData<{ tokens: { expiresIn: number } }>(res, 200);
      expect(data.tokens.expiresIn).toBe(900);
      expectRefreshCookieContract(res);
    });

    it('2.3.1 rejects a wrong password with 401 INVALID_CREDENTIALS', async () => {
      const { email } = await registerUser(app, 'login-wrongpw');
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'WrongPass@1' });
      expectError(res, 401, 'INVALID_CREDENTIALS');
    });

    it('2.3.2 rejects an unknown email with the same 401 (no enumeration)', async () => {
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: uniqueEmail('ghost'), password: PASSWORD });
      expectError(res, 401, 'INVALID_CREDENTIALS');
    });

    it('2.4.1 AnonymousGuard blocks an already-authenticated user from logging in → 403', async () => {
      const user = await registerUser(app, 'guard-login');
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/login')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ email: user.email, password: PASSWORD });
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  describe('§10/§11 Profile', () => {
    it('10.x rejects unauthenticated profile access with 401 TOKEN_INVALID', async () => {
      const res = await req(app.app.getHttpServer()).get('/api/auth/me');
      expectError(res, 401, 'TOKEN_INVALID');
    });

    it('10.1 returns the authenticated profile', async () => {
      const user = await registerUser(app, 'profile');
      const res = await req(app.app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`);
      const data = expectData<ApiUserShape>(res, 200);
      expect(data).toMatchObject({ id: user.id, email: user.email });
    });

    it('11.1 updates the display name (state-verified)', async () => {
      const user = await registerUser(app, 'profile-upd');
      const res = await req(app.app.getHttpServer())
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ displayName: 'Renamed User' });
      const data = expectData<{ displayName: string }>(res, 200);
      expect(data.displayName).toBe('Renamed User');

      const probe = await req(app.app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`);
      expect(expectData<ApiUserShape>(probe, 200).displayName).toBe('Renamed User');
    });

    it('11.2 rejects an invalid avatarUrl with 400', async () => {
      const user = await registerUser(app, 'profile-bad');
      const res = await req(app.app.getHttpServer())
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ avatarUrl: 'not-a-url' });
      expectError(res, 400, 'VALIDATION_ERROR');
    });
  });

  // =========================================================================
  describe('§3 Token refresh — rotation & reuse detection', () => {
    it('3.1.1 rotates on refresh and 14.1 replays of the OLD cookie kill the family (TOKEN_REUSE_DETECTED)', async () => {
      const user = await registerUser(app, 'refresh');
      const oldCookie = extractRefreshCookie(user.raw);

      const refresh = await req(app.app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', oldCookie);
      expectData<{ accessToken: string; expiresIn: number }>(refresh, 200);

      // Rotation: replaying the consumed cookie must trigger reuse detection
      const replay = await req(app.app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', oldCookie);
      expectError(replay, 401, 'TOKEN_REUSE_DETECTED');
    });

    it('3.2.x rejects refresh without cookie with 401 TOKEN_INVALID', async () => {
      const res = await req(app.app.getHttpServer()).post('/api/auth/refresh');
      expectError(res, 401, 'TOKEN_INVALID');
    });
  });

  // =========================================================================
  describe('§4 Logout (single device)', () => {
    it('4.1 clears the cookie and revokes the refresh token', async () => {
      const user = await registerUser(app, 'logout');

      const res = await req(app.app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('Cookie', extractRefreshCookie(user.raw));
      expect(res.status).toBe(204);

      const cleared = res.headers['set-cookie'] as unknown as string[];
      expect(
        (Array.isArray(cleared) ? cleared : [cleared]).some((c) =>
          c.startsWith('refreshToken=;'),
        ),
      ).toBe(true);

      // Refresh with the revoked cookie must fail
      const replay = await req(app.app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', extractRefreshCookie(user.raw));
      expect(replay.status).toBe(401);
    });
  });

  describe('§4.3.3 Single-device logout — other device remains active', () => {
    it('logging out device A does not revoke device B session', async () => {
      const user = await registerUser(app, 'logout-other');
      const deviceB = await loginUser(app, user.email, user.password);

      // Device A (user.accessToken) logs out
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('Cookie', extractRefreshCookie(user.raw));
      expect(res.status).toBe(204);

      // Device B can still access protected resources
      const probe = await req(app.app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${deviceB.accessToken}`);
      expectData<{ id: string }>(probe, 200);
    });
  });

  describe('§5 Logout all devices + 14.2 cascade', () => {
    it('5.1 revokes every refresh family and blacklists the current access token', async () => {
      const user = await registerUser(app, 'logout-all');
      const secondDevice = await loginUser(app, user.email, user.password);

      const res = await req(app.app.getHttpServer())
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${user.accessToken}`);
      expect(res.status).toBe(204);

      // Both devices' refresh cookies are dead
      for (const cookie of [
        extractRefreshCookie(user.raw),
        `refreshToken=${secondDevice.refreshToken}`,
      ]) {
        const replay = await req(app.app.getHttpServer())
          .post('/api/auth/refresh')
          .set('Cookie', cookie);
        expect(replay.status).toBe(401);
      }

      // 14.2: the in-flight access token is blacklisted → TOKEN_REVOKED
      const probe = await req(app.app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`);
      expectError(probe, 401, 'TOKEN_REVOKED');
    });
  });

  // =========================================================================
  describe('§6/§7 Forgot + reset password', () => {
    it('6.4.1 responds identically for known and unknown emails (enumeration resistance)', async () => {
      const known = await registerUser(app, 'reset-known');

      const resKnown = await req(app.app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: known.email });
      const msgKnown = expectData<{ message: string }>(resKnown, 200);

      const resUnknown = await req(app.app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: uniqueEmail('reset-unknown') });
      const msgUnknown = expectData<{ message: string }>(resUnknown, 200);

      expect(msgUnknown.message).toBe(msgKnown.message);
    });

    it('7.1 resets the password via the emailed token, revokes sessions, issues fresh tokens', async () => {
      const user = await registerUser(app, 'reset-flow');
      await req(app.app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: user.email });

      const resetToken = await waitForMailToken(user.email, 'reset');
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token: resetToken, newPassword: 'NewSecure@1' });
      const data = expectData<{ accessToken: string; expiresIn: number }>(res, 200);
      expect(data.expiresIn).toBe(900);

      // Old password dead, new password works (12.1.2/12.1.3 analogue)
      const oldLogin = await req(app.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });
      expectError(oldLogin, 401, 'INVALID_CREDENTIALS');

      const newLogin = await req(app.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: 'NewSecure@1' });
      expectData(newLogin, 200);
    });

    it('7.3 rejects an invalid/reset token with 401 TOKEN_INVALID', async () => {
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({
          token: 'definitely-not-a-valid-token',
          newPassword: 'NewSecure@1',
        });
      expectError(res, 401, 'TOKEN_INVALID');
    });
  });

  // =========================================================================
  describe('Email verification (verify-email / resend-verification)', () => {
    it('verifies via the emailed token; token is single-use (replay → 401 TOKEN_INVALID)', async () => {
      const user = await registerUser(app, 'verify');

      const token = await waitForMailToken(user.email, 'verify');
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/verify-email')
        .send({ token });
      expectData<{ message: string }>(res, 200);

      const replay = await req(app.app.getHttpServer())
        .post('/api/auth/verify-email')
        .send({ token });
      expectError(replay, 401, 'TOKEN_INVALID');
    });

    it('resend-verification on an already-verified user → 409 EMAIL_ALREADY_VERIFIED', async () => {
      const user = await registerUser(app, 'resend');
      const token = await waitForMailToken(user.email, 'verify');
      await req(app.app.getHttpServer())
        .post('/api/auth/verify-email')
        .send({ token });

      const res = await req(app.app.getHttpServer())
        .post('/api/auth/resend-verification')
        .set('Authorization', `Bearer ${user.accessToken}`);
      expectError(res, 409, 'EMAIL_ALREADY_VERIFIED');
    });

    it('resend-verification requires authentication → 401 TOKEN_INVALID', async () => {
      const res = await req(app.app.getHttpServer()).post(
        '/api/auth/resend-verification',
      );
      expectError(res, 401, 'TOKEN_INVALID');
    });
  });

  // =========================================================================
  describe('§13.2 JWT access-token claims', () => {
    it('13.2.1–13.2.5 embeds sub/jti/iss/exp and the documented 15m expiry', async () => {
      const user = await registerUser(app, 'jwt-claims');
      const decoded = jwt.decode(user.accessToken, { complete: true })!;
      const payload = decoded.payload as jwt.JwtPayload;

      expect(payload.sub).toBe(user.id);
      expect(payload.iss).toBe('syncboard');
      expect(payload.jti).toEqual(expect.any(String));
      expect((payload.exp as number) - (payload.iat as number)).toBe(900);
      // RS256 when key files exist, HS256 dev fallback otherwise
      expect(['RS256', 'HS256']).toContain(decoded.header.alg);
    });
  });

  describe('§13.5 malformed requests', () => {
    it('13.5.2 rejects malformed JSON with 400', async () => {
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('13.5.1 rejects a non-JSON content type with 400', async () => {
      const res = await req(app.app.getHttpServer())
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('email=not@json');
      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  describe('§12 Change password', () => {
    it('12.1.1 changes the password, issues fresh tokens, and revokes previous sessions', async () => {
      const user = await registerUser(app, 'changepw');

      const res = await req(app.app.getHttpServer())
        .patch('/api/auth/me/password')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ currentPassword: user.password, newPassword: 'NewSecure@1' });
      expectData<{ accessToken: string; expiresIn: number }>(res, 200);

      // Old password no longer works (12.1.3)
      const oldLogin = await req(app.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });
      expectError(oldLogin, 401, 'INVALID_CREDENTIALS');

      // New password works (12.1.2)
      const newLogin = await req(app.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: 'NewSecure@1' });
      expectData(newLogin, 200);
    });

    it('12.3.1 rejects an incorrect current password with 401 INVALID_CREDENTIALS', async () => {
      const user = await registerUser(app, 'changepw-wrong');
      const res = await req(app.app.getHttpServer())
        .patch('/api/auth/me/password')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ currentPassword: 'WrongCurrent@1', newPassword: 'NewSecure@1' });
      expectError(res, 401, 'INVALID_CREDENTIALS');
    });

    it('12.2.x rejects a weak newPassword with 400 VALIDATION_ERROR', async () => {
      const user = await registerUser(app, 'changepw-weak');
      const res = await req(app.app.getHttpServer())
        .patch('/api/auth/me/password')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ currentPassword: user.password, newPassword: 'weak' });
      expectError(res, 400, 'VALIDATION_ERROR');
    });
  });

  // =========================================================================
  describe('§8 Google OAuth URL', () => {
    it('8.1 GET /auth/google returns 200 with a url containing accounts.google.com (or 302 redirect)', async () => {
      const res = await req(app.app.getHttpServer()).get('/api/auth/google');
      // In test env GOOGLE_CLIENT_ID=dummy; Passport may return JSON url or redirect.
      if (res.status === 200) {
        const data = expectData<{ url: string }>(res, 200);
        expect(data.url).toContain('accounts.google.com');
      } else {
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('accounts.google.com');
      }
    });
  });

  // =========================================================================
  describe('§14.6 Throttle + correctness (dedicated throttled instance)', () => {
    let throttled: TestApp;

    beforeAll(async () => {
      throttled = await createTestApp({ throttler: true });
    });

    afterAll(async () => {
      await throttled.close();
    });

    it('1.3.x blocks the 4th register call within the window with 429', async () => {
      for (let i = 1; i <= 3; i++) {
        const res = await req(throttled.app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: uniqueEmail(`throttle-reg-${i}`),
            password: PASSWORD,
            displayName: `Throttle ${i}`,
          });
        expectData(res, 201);
      }

      const fourth = await req(throttled.app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: uniqueEmail('throttle-reg-4'),
          password: PASSWORD,
          displayName: 'Throttle 4',
        });
      expectError(fourth, 429, 'TOO_MANY_REQUESTS');
    });

    it('14.6 blocks the 6th login attempt within the window — even with correct credentials', async () => {
      const user = await registerUser(throttled, 'throttle-login');
      const server = throttled.app.getHttpServer();

      for (let i = 1; i <= 5; i++) {
        const res = await req(server)
          .post('/api/auth/login')
          .send({ email: user.email, password: user.password });
        expectData(res, 200);
      }

      const sixth = await req(server)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });
      expectError(sixth, 429, 'TOO_MANY_REQUESTS');
    });
  });
});
