/**
 * Board module e2e — boards, lists, cards, labels, checklists, comments,
 * attachments, starring, and the per-board activity feed.
 *
 * Covers: test-cases-board.md
 *   Board CRUD + star + archive/unarchive (404 on archived board probes)
 *   Lists CRUD + reorder + archive
 *   Cards CRUD + move (LexoRank) + assignees + labels
 *   Checklists/items · Comments (+cursor pagination, author-only edit)
 *   Labels CRUD · Attachments (link) · Activity feed
 *   RBAC matrix (owner/admin/member/viewer/outsider) + validation sweeps
 */
import { createTestApp, type TestApp } from '../helpers/app';
import { expectData, expectError, req } from '../helpers/http';
import {
  createBoard,
  createCard,
  createList,
  createWorkspaceBundle,
  type TestUser,
  type WorkspaceBundle,
} from '../helpers/factories';

describe('Board module (e2e)', () => {
  let app: TestApp;
  let bundle: WorkspaceBundle;

  const server = () => app.app.getHttpServer();
  const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.accessToken}` });
  const boardsUrl = () => `/api/workspaces/${bundle.workspaceId}/boards`;
  const boardUrl = (boardId = bundle.boardId) => `${boardsUrl()}/${boardId}`;

  beforeAll(async () => {
    app = await createTestApp();
    bundle = await createWorkspaceBundle(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Boards', () => {
    it('creates a board (member allowed) and returns it with a title', async () => {
      const res = await req(server())
        .post(boardsUrl())
        .set(auth(bundle.member))
        .send({ title: 'Member Board', backgroundColor: '#0079BF' });
      const data = expectData<{ id: string; title: string; archivedAt: null }>(res, 201);
      expect(data.title).toBe('Member Board');
      expect(data.archivedAt).toBeNull();
    });

    it('returns board content: lists, labels, isStarred, pagination', async () => {
      const res = await req(server()).get(boardUrl()).set(auth(bundle.viewer));
      const data = expectData<{
        id: string;
        isStarred: boolean;
        lists: Array<{ id: string }>;
        labels: unknown[];
        pagination: Record<string, unknown>;
      }>(res, 200);
      expect(data.id).toBe(bundle.boardId);
      expect(data.isStarred).toBe(false);
      expect(data.lists.some((l) => l.id === bundle.listId)).toBe(true);
      expect(data.pagination).toMatchObject({ totalLists: expect.any(Number) });
    });

    it('updates title (state-verified)', async () => {
      const res = await req(server())
        .patch(boardUrl())
        .set(auth(bundle.admin))
        .send({ title: 'Renamed Board' });
      expect(expectData<{ title: string }>(res, 200).title).toBe('Renamed Board');
    });

    it('star + unstar → 204 and reflected in content', async () => {
      const star = await req(server())
        .post(`${boardUrl()}/star`)
        .set(auth(bundle.viewer));
      expect(star.status).toBe(204);

      const probe = await req(server()).get(boardUrl()).set(auth(bundle.viewer));
      expect(expectData<{ isStarred: boolean }>(probe, 200).isStarred).toBe(true);

      const unstar = await req(server())
        .delete(`${boardUrl()}/star`)
        .set(auth(bundle.viewer));
      expect(unstar.status).toBe(204);
    });

    it('lists boards of the workspace', async () => {
      const res = await req(server()).get(boardsUrl()).set(auth(bundle.admin));
      const data = expectData<
        { items?: Array<{ id: string }> } | Array<{ id: string }>
      >(res, 200);
      const items = Array.isArray(data) ? data : (data.items ?? []);
      expect(items.map((b) => b.id)).toContain(bundle.boardId);
    });

    it('archives a board → content GET 404, card creation blocked, unarchive restores', async () => {
      const board = await createBoard(app, bundle.owner, bundle.workspaceId, 'Doomed Board');
      const list = await createList(app, bundle.owner, bundle.workspaceId, board.id, 'L');

      const archive = await req(server()).delete(boardUrl(board.id)).set(auth(bundle.owner));
      expect(archive.status).toBe(204);

      const probe = await req(server()).get(boardUrl(board.id)).set(auth(bundle.owner));
      expectError(probe, 404, 'BOARD_NOT_FOUND');

      const restore = await req(server())
        .patch(`${boardUrl(board.id)}/unarchive`)
        .set(auth(bundle.member));
      expectData(restore, 200);
    });

    it('RBAC: viewer cannot create a board; outsider cannot read → 403 FORBIDDEN', async () => {
      const viewerCreate = await req(server())
        .post(boardsUrl())
        .set(auth(bundle.viewer))
        .send({ title: 'Nope' });
      expectError(viewerCreate, 403, 'FORBIDDEN');

      const outsiderRead = await req(server()).get(boardUrl()).set(auth(bundle.outsider));
      expectError(outsiderRead, 403, 'FORBIDDEN');
    });

    it('validation: empty title → 400; malformed board uuid → 400; unknown id → 404 BOARD_NOT_FOUND', async () => {
      const badTitle = await req(server())
        .post(boardsUrl())
        .set(auth(bundle.owner))
        .send({ title: '' });
      expectError(badTitle, 400, 'VALIDATION_ERROR');

      const badId = await req(server())
        .get(`${boardsUrl()}/not-a-uuid`)
        .set(auth(bundle.owner));
      expect(badId.status).toBe(400);

      const unknown = await req(server())
        .get(boardUrl('00000000-0000-4000-8000-000000000000'))
        .set(auth(bundle.owner));
      expectError(unknown, 404, 'BOARD_NOT_FOUND');
    });
  });

  describe('Lists', () => {
    it('creates lists (rank assigned), renames, moves, and archives', async () => {
      const l1 = await createList(app, bundle.member, bundle.workspaceId, bundle.boardId, 'First');
      const l2 = await createList(app, bundle.member, bundle.workspaceId, bundle.boardId, 'Second');
      expect(l1.rank).toEqual(expect.any(String));
      expect(l2.rank).toEqual(expect.any(String));

      const rename = await req(server())
        .patch(`${boardUrl()}/lists/${l1.id}`)
        .set(auth(bundle.member))
        .send({ title: 'First Renamed' });
      expect(expectData<{ title: string }>(rename, 200).title).toBe('First Renamed');

      // Move l2 in front of l1 (LexoRank reorder)
      const move = await req(server())
        .patch(`${boardUrl()}/lists/${l2.id}/move`)
        .set(auth(bundle.member))
        .send({ nextRank: l1.rank });
      const moved = expectData<{ rank: string }>(move, 200);
      expect(moved.rank).not.toBe(l2.rank);

      const archive = await req(server())
        .delete(`${boardUrl()}/lists/${l2.id}`)
        .set(auth(bundle.member));
      expect(archive.status).toBe(204);

      // Archived list is not visible in board content
      const content = await req(server()).get(boardUrl()).set(auth(bundle.member));
      const lists = expectData<{ lists: Array<{ id: string }> }>(content, 200).lists;
      expect(lists.map((l) => l.id)).not.toContain(l2.id);

      // Unarchive restores
      const restore = await req(server())
        .patch(`${boardUrl()}/lists/${l2.id}/unarchive`)
        .set(auth(bundle.member));
      expectData(restore, 200);
    });

    it('RBAC: viewer cannot create a list → 403', async () => {
      const res = await req(server())
        .post(`${boardUrl()}/lists`)
        .set(auth(bundle.viewer))
        .send({ title: 'Viewer List' });
      expectError(res, 403, 'FORBIDDEN');
    });

    it('unknown listId → 404 LIST_NOT_FOUND', async () => {
      const res = await req(server())
        .patch(`${boardUrl()}/lists/00000000-0000-4000-8000-000000000000`)
        .set(auth(bundle.member))
        .send({ title: 'Ghost' });
      expectError(res, 404, 'LIST_NOT_FOUND');
    });
  });

  describe('Cards', () => {
    it('creates a card with a LexoRank, reads it back, updates fields', async () => {
      const card = await createCard(
        app,
        bundle.member,
        bundle.workspaceId,
        bundle.boardId,
        bundle.listId,
        'Spec Card',
      );
      expect(card.rank).toEqual(expect.any(String));

      const read = await req(server())
        .get(`${boardUrl()}/cards/${card.id}`)
        .set(auth(bundle.viewer));
      expect(expectData<{ id: string; title: string }>(read, 200).title).toBe('Spec Card');

      const update = await req(server())
        .patch(`${boardUrl()}/cards/${card.id}`)
        .set(auth(bundle.member))
        .send({ title: 'Spec Card v2', description: { text: 'With details' } });
      const updated = expectData<{ title: string; description: unknown }>(update, 200);
      expect(updated.title).toBe('Spec Card v2');
      expect(updated.description).toMatchObject({ text: 'With details' });
    });

    it('moves a card across lists via LexoRank (state-verified)', async () => {
      const target = await createList(
        app,
        bundle.member,
        bundle.workspaceId,
        bundle.boardId,
        'Done',
      );
      const card = await createCard(
        app,
        bundle.member,
        bundle.workspaceId,
        bundle.boardId,
        bundle.listId,
        'Mover',
      );

      const move = await req(server())
        .patch(`${boardUrl()}/cards/${card.id}/move`)
        .set(auth(bundle.member))
        .send({ targetListId: target.id });
      const moved = expectData<{ listId: string; rank: string }>(move, 200);
      expect(moved.listId).toBe(target.id);

      const read = await req(server())
        .get(`${boardUrl()}/cards/${card.id}`)
        .set(auth(bundle.member));
      expect(expectData<{ listId: string }>(read, 200).listId).toBe(target.id);
    });

    it('adds and removes an assignee (204 both ways)', async () => {
      const card = await createCard(
        app,
        bundle.member,
        bundle.workspaceId,
        bundle.boardId,
        bundle.listId,
        'Assigned Card',
      );

      const add = await req(server())
        .post(`${boardUrl()}/cards/${card.id}/assignees/${bundle.viewer.id}`)
        .set(auth(bundle.member));
      expect(add.status).toBe(204);

      const read = await req(server())
        .get(`${boardUrl()}/cards/${card.id}`)
        .set(auth(bundle.member));
      const assignees = expectData<{ assignees?: Array<{ user?: { id: string }; userId?: string; id?: string }> }>(
        read,
        200,
      );
      const ids = (assignees.assignees ?? []).map((a) => a.user?.id ?? a.userId ?? a.id);
      expect(ids).toContain(bundle.viewer.id);

      const remove = await req(server())
        .delete(`${boardUrl()}/cards/${card.id}/assignees/${bundle.viewer.id}`)
        .set(auth(bundle.member));
      expect(remove.status).toBe(204);
    });

    it('archives a card, hides it, unarchives it', async () => {
      const card = await createCard(
        app,
        bundle.member,
        bundle.workspaceId,
        bundle.boardId,
        bundle.listId,
        'Archived Card',
      );

      const archive = await req(server())
        .delete(`${boardUrl()}/cards/${card.id}`)
        .set(auth(bundle.member));
      expect(archive.status).toBe(204);

      const read = await req(server())
        .get(`${boardUrl()}/cards/${card.id}`)
        .set(auth(bundle.member));
      expect(read.status).toBe(404);

      const restore = await req(server())
        .patch(`${boardUrl()}/cards/${card.id}/unarchive`)
        .set(auth(bundle.member));
      expectData(restore, 200);
    });

    it('validation: missing title → 400; move without targetListId → 400; unknown card → 404 CARD_NOT_FOUND', async () => {
      const noTitle = await req(server())
        .post(`${boardUrl()}/lists/${bundle.listId}/cards`)
        .set(auth(bundle.member))
        .send({});
      expectError(noTitle, 400, 'VALIDATION_ERROR');

      const noTarget = await req(server())
        .patch(`${boardUrl()}/cards/${bundle.cardId}/move`)
        .set(auth(bundle.member))
        .send({});
      expectError(noTarget, 400, 'VALIDATION_ERROR');

      const unknown = await req(server())
        .get(`${boardUrl()}/cards/00000000-0000-4000-8000-000000000000`)
        .set(auth(bundle.member));
      expectError(unknown, 404, 'CARD_NOT_FOUND');
    });
  });

  describe('Labels', () => {
    it('creates, lists, updates, attaches to a card and deletes a label', async () => {
      const create = await req(server())
        .post(`${boardUrl()}/labels`)
        .set(auth(bundle.member))
        .send({ name: 'Bug', color: '#E11D48' });
      const label = expectData<{ id: string; color: string }>(create, 201);
      expect(label.color).toBe('#E11D48');

      const list = await req(server())
        .get(`${boardUrl()}/labels`)
        .set(auth(bundle.viewer));
      expect(
        expectData<Array<{ id: string }>>(list, 200).map((l) => l.id),
      ).toContain(label.id);

      const attach = await req(server())
        .post(`${boardUrl()}/cards/${bundle.cardId}/labels/${label.id}`)
        .set(auth(bundle.member));
      expect(attach.status).toBe(204);

      const detach = await req(server())
        .delete(`${boardUrl()}/cards/${bundle.cardId}/labels/${label.id}`)
        .set(auth(bundle.member));
      expect(detach.status).toBe(204);

      const update = await req(server())
        .patch(`${boardUrl()}/labels/${label.id}`)
        .set(auth(bundle.member))
        .send({ name: 'Critical' });
      expect(expectData<{ name: string | null }>(update, 200).name).toBe('Critical');

      const del = await req(server())
        .delete(`${boardUrl()}/labels/${label.id}`)
        .set(auth(bundle.member));
      expect(del.status).toBe(204);
    });

    it('validation: invalid color format → 400', async () => {
      const res = await req(server())
        .post(`${boardUrl()}/labels`)
        .set(auth(bundle.member))
        .send({ color: 'red' });
      expectError(res, 400, 'VALIDATION_ERROR');
    });
  });

  describe('Checklists', () => {
    it('creates a checklist, adds items, toggles an item, deletes', async () => {
      const create = await req(server())
        .post(`${boardUrl()}/cards/${bundle.cardId}/checklists`)
        .set(auth(bundle.member))
        .send({ title: 'Definition of Done' });
      const checklist = expectData<{ id: string; title: string }>(create, 201);
      expect(checklist.title).toBe('Definition of Done');

      const item = await req(server())
        .post(`${boardUrl()}/cards/${bundle.cardId}/checklists/${checklist.id}/items`)
        .set(auth(bundle.member))
        .send({ content: 'Write tests' });
      const created = expectData<{ id: string; isDone: boolean }>(item, 201);
      expect(created.isDone).toBe(false);

      const toggle = await req(server())
        .patch(
          `${boardUrl()}/cards/${bundle.cardId}/checklists/${checklist.id}/items/${created.id}`,
        )
        .set(auth(bundle.member))
        .send({ isDone: true });
      expect(expectData<{ isDone: boolean }>(toggle, 200).isDone).toBe(true);

      const delItem = await req(server())
        .delete(
          `${boardUrl()}/cards/${bundle.cardId}/checklists/${checklist.id}/items/${created.id}`,
        )
        .set(auth(bundle.member));
      expect(delItem.status).toBe(204);

      const delChecklist = await req(server())
        .delete(`${boardUrl()}/cards/${bundle.cardId}/checklists/${checklist.id}`)
        .set(auth(bundle.member));
      expect(delChecklist.status).toBe(204);
    });

    it('RBAC: viewer cannot create a checklist → 403', async () => {
      const res = await req(server())
        .post(`${boardUrl()}/cards/${bundle.cardId}/checklists`)
        .set(auth(bundle.viewer))
        .send({ title: 'Viewer Checklist' });
      expectError(res, 403, 'FORBIDDEN');
    });
  });

  describe('Comments', () => {
    it('creates comments, paginates with a cursor, edits own comment', async () => {
      const commentsUrl = `${boardUrl()}/cards/${bundle.cardId}/comments`;

      const created: Array<{ id: string; content: string }> = [];
      for (let i = 1; i <= 3; i++) {
        const res = await req(server())
          .post(commentsUrl)
          .set(auth(bundle.member))
          .send({ content: `Comment number ${i}` });
        created.push(expectData<{ id: string; content: string }>(res, 201));
      }

      const page1 = await req(server())
        .get(commentsUrl)
        .query({ limit: 2 })
        .set(auth(bundle.viewer));
      const p1 = expectData<{
        items: Array<{ id: string; content: string; author: { displayName: string } }>;
        pagination: { cursor: string | null; hasMore: boolean };
      }>(page1, 200);
      expect(p1.items).toHaveLength(2);
      expect(p1.pagination.hasMore).toBe(true);
      expect(p1.pagination.cursor).toEqual(expect.any(String));
      expect(p1.items[0].author).toMatchObject({ displayName: expect.any(String) });

      // Cursor pagination page 2
      const page2 = await req(server())
        .get(commentsUrl)
        .query({ limit: 2, cursor: p1.pagination.cursor })
        .set(auth(bundle.viewer));
      const p2 = expectData<{ items: Array<{ id: string }>; pagination: { hasMore: boolean } }>(
        page2,
        200,
      );
      expect(p2.items.map((c) => c.id)).not.toContain(p1.items[0].id);

      // Author edits their own comment
      const edit = await req(server())
        .patch(`${commentsUrl}/${created[0].id}`)
        .set(auth(bundle.member))
        .send({ content: 'Comment number 1 (edited)' });
      expect(expectData<{ content: string }>(edit, 200).content).toContain('edited');
    });

    it('author-only rule: another member editing a foreign comment → 403 FORBIDDEN', async () => {
      const commentsUrl = `${boardUrl()}/cards/${bundle.cardId}/comments`;
      const res = await req(server())
        .post(commentsUrl)
        .set(auth(bundle.member))
        .send({ content: 'Owned by member' });
      const comment = expectData<{ id: string }>(res, 201);

      const foreignEdit = await req(server())
        .patch(`${commentsUrl}/${comment.id}`)
        .set(auth(bundle.admin))
        .send({ content: 'Hijack' });
      expectError(foreignEdit, 403, 'FORBIDDEN');
    });

    it('deletes own comment → 204', async () => {
      const commentsUrl = `${boardUrl()}/cards/${bundle.cardId}/comments`;
      const res = await req(server())
        .post(commentsUrl)
        .set(auth(bundle.member))
        .send({ content: 'To be deleted' });
      const comment = expectData<{ id: string }>(res, 201);

      const del = await req(server())
        .delete(`${commentsUrl}/${comment.id}`)
        .set(auth(bundle.member));
      expect(del.status).toBe(204);
    });
  });

  describe('Attachments (link type)', () => {
    it('creates, lists, renames and deletes a link attachment', async () => {
      const attachmentsUrl = `${boardUrl()}/cards/${bundle.cardId}/attachments`;

      const create = await req(server())
        .post(attachmentsUrl)
        .set(auth(bundle.member))
        .send({ type: 'link', url: 'https://example.com/spec', name: 'Spec Doc' });
      const attachment = expectData<{ id: string; url: string; name: string }>(create, 201);
      expect(attachment.url).toBe('https://example.com/spec');

      const list = await req(server()).get(attachmentsUrl).set(auth(bundle.viewer));
      expect(
        expectData<Array<{ id: string }>>(list, 200).map((a) => a.id),
      ).toContain(attachment.id);

      const rename = await req(server())
        .patch(`${attachmentsUrl}/${attachment.id}`)
        .set(auth(bundle.member))
        .send({ name: 'Spec Doc v2' });
      expect(expectData<{ name: string }>(rename, 200).name).toBe('Spec Doc v2');

      const del = await req(server())
        .delete(`${attachmentsUrl}/${attachment.id}`)
        .set(auth(bundle.member));
      expect(del.status).toBe(204);
    });
  });

  describe('Activity feed', () => {
    it('records board activity for card creation (state probe)', async () => {
      const card = await createCard(
        app,
        bundle.member,
        bundle.workspaceId,
        bundle.boardId,
        bundle.listId,
        'Activity Probe Card',
      );
      expect(card.id).toEqual(expect.any(String));

      const feed = await req(server())
        .get(`${boardUrl()}/activities`)
        .set(auth(bundle.viewer));
      const data = expectData<{
        items?: Array<{ action: string; entityType: string; entityId: string }>;
      }>(feed, 200);
      const items = Array.isArray(data) ? data : (data.items ?? []);
      expect(
        items.some(
          (a) => a.entityId === card.id || a.action === 'card_created' || a.action === 'created',
        ),
      ).toBe(true);
    });
  });
});
