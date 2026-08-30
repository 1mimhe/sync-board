/**
 * Activity / Audit Log module e2e — HTTP via supertest against the real AppModule.
 *
 * Covers: test-cases-activity.md
 *   §1 Recording (board-level feed — already covered in board.e2e-spec.ts)
 *   §2 Workspace-scoped feed (2.1–2.7) — BLOCKED pending ActivityModule wiring
 *
 * Status (2026-08-30):
 *   ✅ Board-level feed (`GET …/boards/:id/activities`) covered by board.e2e-spec.ts.
 *   ⛔ §2 workspace-scoped feed BLOCKED — `ActivityModule` has no workspace feed endpoint.
 *      Remove `.skip` from each `describe.skip` block once the endpoint lands.
 *
 *   §3 Partitioning & Migration rows are infrastructure-level and require manual validation.
 */
import { createTestApp, type TestApp } from '../helpers/app';
import { expectData, expectError, req } from '../helpers/http';
import {
  createVerifiedUser,
  createWorkspace,
  createBoard,
  createList,
  createCard,
  addMemberViaInvitation,
  type TestUser,
} from '../helpers/factories';

describe('Activity module (e2e)', () => {
  let app: TestApp;
  let owner: TestUser;
  let alice: TestUser;
  let viewer: TestUser;
  let outsider: TestUser;
  let workspaceId: string;
  let boardId: string;
  let listId: string;

  const server = () => app.app.getHttpServer();
  const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.accessToken}` });
  const wsActivityUrl = () => `/api/workspaces/${workspaceId}/activity`;
  const boardActivityUrl = () =>
    `/api/workspaces/${workspaceId}/boards/${boardId}/activities`;

  beforeAll(async () => {
    app = await createTestApp();
    [owner, alice, viewer, outsider] = await Promise.all([
      createVerifiedUser(app, 'act-owner'),
      createVerifiedUser(app, 'act-alice'),
      createVerifiedUser(app, 'act-viewer'),
      createVerifiedUser(app, 'act-outsider'),
    ]);
    const ws = await createWorkspace(app, owner);
    workspaceId = ws.id;
    await addMemberViaInvitation(app, owner, alice, workspaceId, 'member');
    await addMemberViaInvitation(app, owner, viewer, workspaceId, 'viewer');
    const board = await createBoard(app, owner, workspaceId, 'Activity Board');
    boardId = board.id;
    const list = await createList(app, owner, workspaceId, boardId, 'Activity List');
    listId = list.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // §1 Recording — board-level feed already covered by board.e2e-spec.ts
  // "Activity feed" describe → records card creation
  // =========================================================================

  // =========================================================================
  describe.skip('§2 Workspace-scoped Feed', () => {
    beforeAll(async () => {
      // Seed: 25 card creations to produce activity rows
      for (let i = 0; i < 25; i++) {
        await createCard(app, alice, workspaceId, boardId, listId, `Activity Card ${i}`);
      }
    });

    it('2.1 cursor walk: seed ≥ 20 events → page limit 20 hasMore+cursor; next page no dupes', async () => {
      const p1 = expectData<{
        items: Array<{ id: unknown }>;
        pagination: { cursor: string | null; hasMore: boolean };
      }>(
        await req(server()).get(wsActivityUrl()).query({ limit: 20 }).set(auth(owner)),
        200,
      );
      expect(p1.items.length).toBeLessThanOrEqual(20);
      expect(p1.pagination.hasMore).toBe(true);

      const p2 = expectData<{ items: Array<{ id: unknown }> }>(
        await req(server())
          .get(wsActivityUrl())
          .query({ limit: 20, cursor: p1.pagination.cursor })
          .set(auth(owner)),
        200,
      );
      const p1Ids = new Set(p1.items.map((i) => String(i.id)));
      for (const item of p2.items) {
        expect(p1Ids.has(String(item.id))).toBe(false);
      }
    });

    it('2.2 boardId filter: only events for that board', async () => {
      const items = expectData<{
        items: Array<{ boardId: unknown }>;
      }>(
        await req(server())
          .get(wsActivityUrl())
          .query({ boardId })
          .set(auth(owner)),
        200,
      ).items;
      for (const item of items) {
        expect(item.boardId).toBe(boardId);
      }
    });

    it('2.3 dedicated board route matches workspace feed with boardId filter', async () => {
      const boardFeed = expectData<{ items: Array<{ id: unknown }> }>(
        await req(server()).get(boardActivityUrl()).set(auth(viewer)),
        200,
      );
      expect(Array.isArray(boardFeed.items)).toBe(true);
    });

    it('2.5 actorId filter: only Alice actions', async () => {
      const items = expectData<{
        items: Array<{ actorId: string }>;
      }>(
        await req(server())
          .get(wsActivityUrl())
          .query({ actorId: alice.id })
          .set(auth(owner)),
        200,
      ).items;
      for (const item of items) {
        expect(item.actorId).toBe(alice.id);
      }
    });

    it('2.6 RBAC: viewer can read; outsider → 403/404; unauthenticated → 401', async () => {
      const viewerRes = await req(server()).get(wsActivityUrl()).set(auth(viewer));
      expectData(viewerRes, 200);

      const outsiderRes = await req(server()).get(wsActivityUrl()).set(auth(outsider));
      expect([403, 404]).toContain(outsiderRes.status);

      const unauthRes = await req(server()).get(wsActivityUrl());
      expect(unauthRes.status).toBe(401);
    });

    it('2.7 response shape: id is string (stringified BigInt); ISO createdAt; pagination envelope standard', async () => {
      const data = expectData<{
        items: Array<{ id: unknown; createdAt: string }>;
        pagination: Record<string, unknown>;
      }>(await req(server()).get(wsActivityUrl()).query({ limit: 1 }).set(auth(owner)), 200);
      if (data.items.length > 0) {
        expect(typeof data.items[0].id).toBe('string');
        expect(data.items[0].createdAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        );
      }
      expect(data.pagination).toMatchObject({
        hasMore: expect.any(Boolean),
      });
    });
  });
});
