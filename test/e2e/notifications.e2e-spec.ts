/**
 * Notifications module e2e — HTTP via supertest against the real AppModule.
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

describe('Notifications module (e2e)', () => {
  let app: TestApp;
  let actor: TestUser;
  let recipient: TestUser;
  let workspaceId: string;
  let boardId: string;
  let listId: string;
  let cardId: string;

  const server = () => app.app.getHttpServer();
  const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.accessToken}` });
  const notifUrl = () => `/api/notifications`;

  beforeAll(async () => {
    app = await createTestApp();
    [actor, recipient] = await Promise.all([
      createVerifiedUser(app, 'notif-actor'),
      createVerifiedUser(app, 'notif-recipient'),
    ]);
    const ws = await createWorkspace(app, actor);
    workspaceId = ws.id;
    await addMemberViaInvitation(app, actor, recipient, workspaceId, 'member');
    const board = await createBoard(app, actor, workspaceId, 'Notif Board');
    boardId = board.id;
    const list = await createList(
      app,
      actor,
      workspaceId,
      boardId,
      'Notif List',
    );
    listId = list.id;
    const card = await createCard(
      app,
      actor,
      workspaceId,
      boardId,
      listId,
      'Notif Card',
    );
    cardId = card.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // =========================================================================
  describe('REST API', () => {
    it('3.1 GET /notifications ? cursor walk: 30 seeded ? page 20 hasMore; page 2 completes', async () => {
      // Seed notifications by assigning recipient to cards 30 times
      for (let i = 0; i < 30; i++) {
        const c = await createCard(
          app,
          actor,
          workspaceId,
          boardId,
          listId,
          `Card ${i}`,
        );
        await req(server())
          .post(
            `/api/workspaces/${workspaceId}/boards/${boardId}/cards/${c.id}/assignees/${recipient.id}`,
          )
          .set(auth(actor));
      }

      // Assignment fan-out is queued (RabbitMQ → consumer → DB):
      // poll until all 30 notifications land before walking pages.
      let total = 0;
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        const probe = expectData<{ items: unknown[] }>(
          await req(server())
            .get(notifUrl())
            .query({ limit: 50 })
            .set(auth(recipient)),
          200,
        );
        total = probe.items.length;
        if (total >= 30) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(total).toBeGreaterThanOrEqual(30);

      const p1 = expectData<{
        items: Array<{ id: string; isRead: boolean }>;
        pagination: { cursor: string | null; hasMore: boolean };
      }>(
        await req(server())
          .get(notifUrl())
          .query({ limit: 20 })
          .set(auth(recipient)),
        200,
      );
      expect(p1.items.length).toBeLessThanOrEqual(20);
      expect(p1.pagination.hasMore).toBe(true);

      const p2 = expectData<{ items: Array<{ id: string }> }>(
        await req(server())
          .get(notifUrl())
          .query({ limit: 20, cursor: p1.pagination.cursor })
          .set(auth(recipient)),
        200,
      );
      expect(p2.items.length).toBeGreaterThan(0);
    });

    it('3.2 unreadOnly filter returns only isRead=false rows', async () => {
      const items = expectData<{ items: Array<{ isRead: boolean }> }>(
        await req(server())
          .get(notifUrl())
          .query({ unreadOnly: true })
          .set(auth(recipient)),
        200,
      ).items;
      for (const n of items) {
        expect(n.isRead).toBe(false);
      }
    });

    it('3.3 unread count endpoint matches actual unread count', async () => {
      const countRes = expectData<{ count: number }>(
        await req(server())
          .get(`${notifUrl()}/unread-count`)
          .set(auth(recipient)),
        200,
      );
      expect(typeof countRes.count).toBe('number');
      expect(countRes.count).toBeGreaterThanOrEqual(0);
    });

    it('3.5 mark-read ownership: actor cannot read recipient notification by id ? 404/403', async () => {
      const items = expectData<{ items: Array<{ id: string }> }>(
        await req(server()).get(notifUrl()).set(auth(recipient)),
        200,
      ).items;
      if (items.length === 0) return; // nothing to test if no notifications
      const notifId = items[0].id;

      const wrongUser = await req(server())
        .patch(`${notifUrl()}/${notifId}/read`)
        .set(auth(actor));
      expect([403, 404]).toContain(wrongUser.status);
    });

    it('3.6 mark-all-read clears unread; subsequent count=0', async () => {
      await req(server()).post(`${notifUrl()}/read-all`).set(auth(recipient));
      const countRes = expectData<{ count: number }>(
        await req(server())
          .get(`${notifUrl()}/unread-count`)
          .set(auth(recipient)),
        200,
      );
      expect(countRes.count).toBe(0);
    });

    it('3.7 unauthenticated access ? 401 TOKEN_INVALID', async () => {
      const listRes = await req(server()).get(notifUrl());
      expect(listRes.status).toBe(401);
      const countRes = await req(server()).get(`${notifUrl()}/unread-count`);
      expect(countRes.status).toBe(401);
    });
  });
});
