/**
 * Golden journey e2e — the critical cross-module user path.
 *
 * Covers: e2e-test-generation.md §4 golden journey template
 *   register A+B → login both → A workspace → invite B → B accept →
 *   B board/list/card → A lists board → move card → comments (+cursor) →
 *   star → archive/unarchive → logoutAll → 401 probe.
 * Plus the realtime mirror: A's socket receives `card:created` when B POSTs.
 */
import type { Socket } from 'socket.io-client';
import { createTestApp, type TestApp } from '../helpers/app';
import { expectData, expectError, req } from '../helpers/http';
import { connect, closeSocket, collect } from '../helpers/ws';
import {
  addMemberViaInvitation,
  createVerifiedUser,
  createBoard,
  createList,
  createCard,
  type TestUser,
} from '../helpers/factories';

describe('Golden journey (e2e)', () => {
  let app: TestApp;
  let alice: TestUser;
  let bob: TestUser;
  let sockA: Socket | undefined;
  let workspaceId: string;
  let boardId: string;
  let listId: string;
  let cardId: string;

  const server = () => app.app.getHttpServer();
  const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.accessToken}` });

  afterAll(async () => {
    if (sockA) await closeSocket(sockA).catch(() => undefined);
    await app.close();
  });

  it('step 1–2: register + login both users (verified via the real email flow)', async () => {
    app = await createTestApp();
    alice = await createVerifiedUser(app, 'alice', { displayName: 'Alice' });
    bob = await createVerifiedUser(app, 'bob', { displayName: 'Bob' });
    expect(alice.accessToken).toEqual(expect.any(String));
    expect(bob.accessToken).toEqual(expect.any(String));
  });

  it('step 3: A creates a workspace', async () => {
    const res = await req(server())
      .post('/api/workspaces')
      .set(auth(alice))
      .send({ name: 'Journey Workspace' });
    const data = expectData<{ id: string; slug: string }>(res, 201);
    workspaceId = data.id;
    expect(data.slug).toContain('journey-workspace');
  });

  it('step 4–5: A invites B via email; B accepts from the invitation email', async () => {
    await addMemberViaInvitation(app, alice, bob, workspaceId, 'member');
    const probe = await req(server())
      .get(`/api/workspaces/${workspaceId}`)
      .set(auth(bob));
    expect(expectData<{ role: string }>(probe, 200).role).toBe('member');
  });

  it('step 6: B creates board, list and card — realtime mirror reaches A', async () => {
    const board = await createBoard(app, bob, workspaceId, 'Journey Board');
    boardId = board.id;
    const list = await createList(app, bob, workspaceId, boardId, 'To Do');
    listId = list.id;

    // A opens the board in realtime BEFORE B's mutation
    sockA = await connect(app.url, alice.accessToken);
    await new Promise<void>((resolve, reject) => {
      sockA!.once('workspace:joined', () => resolve());
      sockA!.once('error', (e: unknown) =>
        reject(new Error(JSON.stringify(e))),
      );
      sockA!.emit('workspace:join', { workspaceId });
    });
    await new Promise<void>((resolve, reject) => {
      sockA!.once('board:joined', () => resolve());
      sockA!.once('error', (e: unknown) =>
        reject(new Error(JSON.stringify(e))),
      );
      sockA!.emit('board:join', { boardId });
    });

    const relay = collect(sockA, 'card:created');
    const card = await createCard(
      app,
      bob,
      workspaceId,
      boardId,
      listId,
      'Journey Card',
    );
    cardId = card.id;

    const events = await relay.waitForCount(1);
    expect(events[0]).toMatchObject({ card: { id: cardId } });
    relay.dispose();

    // B also verifies via REST that the card is on the board
    const content = await req(server())
      .get(`/api/workspaces/${workspaceId}/boards/${boardId}`)
      .set(auth(bob));
    const data = expectData<{
      lists: Array<{ id: string; cards: Array<{ id: string }> }>;
    }>(content, 200);
    const targetList = data.lists.find((l) => l.id === listId);
    expect(targetList?.cards.map((c) => c.id)).toContain(cardId);
  });

  it('step 7: A moves the card to a second list', async () => {
    const second = await createList(app, alice, workspaceId, boardId, 'Done');
    const move = await req(server())
      .patch(
        `/api/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/move`,
      )
      .set(auth(alice))
      .send({ targetListId: second.id });
    expect(expectData<{ listId: string }>(move, 200).listId).toBe(second.id);
  });

  it('step 8: comments page 1 + cursor page 2', async () => {
    const commentsUrl = `/api/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}/comments`;
    for (const content of ['first', 'second', 'third']) {
      const res = await req(server())
        .post(commentsUrl)
        .set(auth(alice))
        .send({ content });
      expectData(res, 201);
    }

    const p1 = expectData<{
      items: Array<{ content: string }>;
      pagination: { cursor: string | null; hasMore: boolean };
    }>(
      await req(server()).get(commentsUrl).query({ limit: 2 }).set(auth(bob)),
      200,
    );
    expect(p1.items).toHaveLength(2);
    expect(p1.pagination.hasMore).toBe(true);

    const p2 = expectData<{ items: Array<{ content: string }> }>(
      await req(server())
        .get(commentsUrl)
        .query({ limit: 2, cursor: p1.pagination.cursor })
        .set(auth(bob)),
      200,
    );
    expect(p2.items).toHaveLength(1);
  });

  it('step 9: A stars and unstars the board', async () => {
    const star = await req(server())
      .post(`/api/workspaces/${workspaceId}/boards/${boardId}/star`)
      .set(auth(alice));
    expect(star.status).toBe(204);
    const unstar = await req(server())
      .delete(`/api/workspaces/${workspaceId}/boards/${boardId}/star`)
      .set(auth(alice));
    expect(unstar.status).toBe(204);
  });

  it('step 10: A archives and unarchives the board', async () => {
    const archive = await req(server())
      .delete(`/api/workspaces/${workspaceId}/boards/${boardId}`)
      .set(auth(alice));
    expect(archive.status).toBe(204);

    const restore = await req(server())
      .patch(`/api/workspaces/${workspaceId}/boards/${boardId}/unarchive`)
      .set(auth(alice));
    expectData(restore, 200);
  });

  it('step 11: A logs out everywhere; the next protected call is 401 TOKEN_REVOKED', async () => {
    const logout = await req(server())
      .post('/api/auth/logout-all')
      .set(auth(alice));
    expect(logout.status).toBe(204);

    const probe = await req(server()).get('/api/auth/me').set(auth(alice));
    expectError(probe, 401, 'TOKEN_REVOKED');

    // Bob still works fine
    const bobProbe = await req(server())
      .get(`/api/workspaces/${workspaceId}`)
      .set(auth(bob));
    expectData(bobProbe, 200);
  });
});
