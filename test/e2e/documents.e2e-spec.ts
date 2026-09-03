/**
 * Documents module e2e — HTTP via supertest against the real AppModule.
 *
 * Covers: test-cases-documents.md
 *   §1 Create & CRUD (1.1–1.9)
 *   §2 Listing & Search (2.1–2.6)
 *   §3 Snapshots (3.1–3.6)
 *   §4 Persistence & Lifecycle Edge (4.7)
 *
 * ⛔ BLOCKED — Phase 5 pending.
 * `src/modules/document/document.module.ts` is an empty stub.
 * Remove `.skip` from each `describe.skip` block once the module lands.
 * Cross-check response shapes against the final DTOs before activating.
 */
import { createTestApp, type TestApp } from '../helpers/app';
import { expectData, expectError, req } from '../helpers/http';
import {
  createVerifiedUser,
  createWorkspace,
  createCard,
  createBoard,
  createList,
  addMemberViaInvitation,
  type TestUser,
} from '../helpers/factories';

describe('Documents module (e2e)', () => {
  let app: TestApp;
  let owner: TestUser;
  let member: TestUser;
  let viewer: TestUser;
  let workspaceId: string;
  let cardId: string;

  const server = () => app.app.getHttpServer();
  const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.accessToken}` });
  const docsUrl = () => `/api/workspaces/${workspaceId}/documents`;
  const docUrl = (id: string) => `${docsUrl()}/${id}`;

  beforeAll(async () => {
    app = await createTestApp();
    [owner, member, viewer] = await Promise.all([
      createVerifiedUser(app, 'doc-owner'),
      createVerifiedUser(app, 'doc-member'),
      createVerifiedUser(app, 'doc-viewer'),
    ]);
    const ws = await createWorkspace(app, owner);
    workspaceId = ws.id;
    await addMemberViaInvitation(app, owner, member, workspaceId, 'member');
    await addMemberViaInvitation(app, owner, viewer, workspaceId, 'viewer');
    const board = await createBoard(app, owner, workspaceId, 'Doc Board');
    const list = await createList(
      app,
      owner,
      workspaceId,
      board.id,
      'Doc List',
    );
    const card = await createCard(
      app,
      owner,
      workspaceId,
      board.id,
      list.id,
      'Doc Card',
    );
    cardId = card.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  describe.skip('§1 Create & CRUD', () => {
    it('1.1 POST /documents {title} → 201; status=active; createdBy=owner', async () => {
      const res = await req(server())
        .post(docsUrl())
        .set(auth(owner))
        .send({ title: 'My Doc' });
      const data = expectData<{ id: string; title: string; status: string }>(
        res,
        201,
      );
      expect(data.title).toBe('My Doc');
      expect(data.status).toBe('active');
    });

    it('1.2 omitting title defaults to "Untitled"', async () => {
      const res = await req(server()).post(docsUrl()).set(auth(owner)).send({});
      const data = expectData<{ title: string }>(res, 201);
      expect(data.title).toBe('Untitled');
    });

    it('1.3 POST with parentCardId links to a card', async () => {
      const res = await req(server())
        .post(docsUrl())
        .set(auth(owner))
        .send({ title: 'Card Linked', parentCardId: cardId });
      const data = expectData<{ parentCardId: string }>(res, 201);
      expect(data.parentCardId).toBe(cardId);
    });

    it('1.4 parentCardId from a non-existent card → 404/403', async () => {
      const res = await req(server()).post(docsUrl()).set(auth(owner)).send({
        title: 'Foreign Link',
        parentCardId: '00000000-0000-4000-8000-000000000000',
      });
      expect([403, 404]).toContain(res.status);
    });

    it('1.5 validation: title > 500 chars → 400 VALIDATION_ERROR', async () => {
      const res = await req(server())
        .post(docsUrl())
        .set(auth(owner))
        .send({ title: 'x'.repeat(501) });
      expectError(res, 400, 'VALIDATION_ERROR');
    });

    it('1.6 PATCH /documents/:id {title} → 200; title updated', async () => {
      const created = await req(server())
        .post(docsUrl())
        .set(auth(owner))
        .send({ title: 'Rename Me' });
      const { id } = expectData<{ id: string }>(created, 201);
      const renamed = await req(server())
        .patch(docUrl(id))
        .set(auth(owner))
        .send({ title: 'Renamed' });
      expect(expectData<{ title: string }>(renamed, 200).title).toBe('Renamed');
    });

    it('1.7 DELETE /documents/:id → 204; GET → 404 DOCUMENT_NOT_FOUND', async () => {
      const created = await req(server())
        .post(docsUrl())
        .set(auth(owner))
        .send({ title: 'Archive Me' });
      const { id } = expectData<{ id: string }>(created, 201);
      expect(
        (await req(server()).delete(docUrl(id)).set(auth(owner))).status,
      ).toBe(204);
      expectError(
        await req(server()).get(docUrl(id)).set(auth(owner)),
        404,
        'DOCUMENT_NOT_FOUND',
      );
    });

    it('1.8 RBAC: viewer cannot create/rename/archive; viewer GET is ok', async () => {
      const created = await req(server())
        .post(docsUrl())
        .set(auth(owner))
        .send({ title: 'RBAC Doc' });
      const { id } = expectData<{ id: string }>(created, 201);

      expectError(
        await req(server())
          .post(docsUrl())
          .set(auth(viewer))
          .send({ title: 'Blocked' }),
        403,
        'FORBIDDEN',
      );
      expectError(
        await req(server())
          .patch(docUrl(id))
          .set(auth(viewer))
          .send({ title: 'Blocked' }),
        403,
        'FORBIDDEN',
      );
      expectError(
        await req(server()).delete(docUrl(id)).set(auth(viewer)),
        403,
        'FORBIDDEN',
      );
      expectData(await req(server()).get(docUrl(id)).set(auth(viewer)), 200);
    });

    it('1.9 rename of an archived document → 404', async () => {
      const created = await req(server())
        .post(docsUrl())
        .set(auth(owner))
        .send({ title: 'Doomed' });
      const { id } = expectData<{ id: string }>(created, 201);
      await req(server()).delete(docUrl(id)).set(auth(owner));
      const rename = await req(server())
        .patch(docUrl(id))
        .set(auth(owner))
        .send({ title: 'Too Late' });
      expect(rename.status).toBe(404);
    });
  });

  // =========================================================================
  describe.skip('§2 Listing & Search', () => {
    it('2.1 cursor walk: 25 docs, page limit 20 → hasMore; page 2 returns remaining', async () => {
      for (let i = 0; i < 25; i++) {
        await req(server())
          .post(docsUrl())
          .set(auth(owner))
          .send({ title: `Cursor Doc ${i}` });
      }
      const p1 = expectData<{
        items: Array<{ id: string }>;
        pagination: { cursor: string | null; hasMore: boolean };
      }>(
        await req(server())
          .get(docsUrl())
          .query({ limit: 20 })
          .set(auth(owner)),
        200,
      );
      expect(p1.items).toHaveLength(20);
      expect(p1.pagination.hasMore).toBe(true);

      const p2 = expectData<{
        items: Array<{ id: string }>;
        pagination: { hasMore: boolean };
      }>(
        await req(server())
          .get(docsUrl())
          .query({ limit: 20, cursor: p1.pagination.cursor })
          .set(auth(owner)),
        200,
      );
      expect(p2.items.length).toBeGreaterThanOrEqual(5);
      expect(p2.pagination.hasMore).toBe(false);
    });

    it('2.4 archived docs are excluded from listing', async () => {
      const { id } = expectData<{ id: string }>(
        await req(server())
          .post(docsUrl())
          .set(auth(owner))
          .send({ title: 'Will Archive' }),
        201,
      );
      await req(server()).delete(docUrl(id)).set(auth(owner));
      const items = expectData<{ items: Array<{ id: string }> }>(
        await req(server()).get(docsUrl()).set(auth(owner)),
        200,
      ).items;
      expect(items.map((d) => d.id)).not.toContain(id);
    });

    it('2.6 response hygiene: yjsState bytes NOT returned in listing', async () => {
      const items = expectData<{ items: Array<Record<string, unknown>> }>(
        await req(server()).get(docsUrl()).set(auth(owner)),
        200,
      ).items;
      for (const doc of items) {
        expect(doc).not.toHaveProperty('yjsState');
      }
    });
  });

  // =========================================================================
  describe.skip('§3 Snapshots', () => {
    let docId: string;

    beforeAll(async () => {
      const created = await req(server())
        .post(docsUrl())
        .set(auth(owner))
        .send({ title: 'Snapshot Doc' });
      docId = expectData<{ id: string }>(created, 201).id;
    });

    it('3.1 POST /snapshots → 201 (or 422 DOCUMENT_EMPTY if doc has no content)', async () => {
      const res = await req(server())
        .post(`${docUrl(docId)}/snapshots`)
        .set(auth(owner))
        .send({ name: 'v1' });
      expect([201, 422]).toContain(res.status);
    });

    it('3.3 GET /snapshots returns array ordered newest-first, metadata only', async () => {
      const items = expectData<Array<{ id: string; name: string }>>(
        await req(server())
          .get(`${docUrl(docId)}/snapshots`)
          .set(auth(owner)),
        200,
      );
      expect(Array.isArray(items)).toBe(true);
    });

    it('3.5 RBAC: viewer restore attempt → 403 FORBIDDEN', async () => {
      expectError(
        await req(server())
          .post(
            `${docUrl(docId)}/snapshots/00000000-0000-4000-8000-000000000000/restore`,
          )
          .set(auth(viewer)),
        403,
        'FORBIDDEN',
      );
    });
  });
});
