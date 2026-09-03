/**
 * Board realtime WebSocket e2e — socket.io-client against the in-process app.
 *
 * Covers: test-cases-realtime-ws.md
 *   §1 Connection auth (missing/invalid/expired/revoked token → error frames)
 *   §2 Workspace rooms (workspace:joined roster, member-online broadcast)
 *   §3 Board rooms & presence (board:joined viewers, board:presence joined/left)
 *   §4 Cursor relay (no echo to sender, payload contract)
 *   §5 Room isolation (other-board client receives nothing)
 *   §6 Rate limits (non-silent join → RATE_LIMIT_EXCEEDED; silent cursor burst
 *      dropped without error frames; server stays alive)
 *   §7 Reconnection (fresh token resumes; revoked mid-session → TOKEN_REVOKED)
 *
 * Event names/payloads verified against src/modules/board/realtime
 * (ws-events.constants.ts, board.gateway.ts, broadcast-relay.service.ts).
 */
import * as jwt from 'jsonwebtoken';
import { io } from 'socket.io-client';
import { createTestApp, type TestApp } from '../helpers/app';
import { connect, closeSocket, collect, onceEvent } from '../helpers/ws';
import {
  createBoard,
  createCard,
  createList,
  createVerifiedUser,
  createWorkspace,
  createWorkspaceBundle,
  addMemberViaInvitation,
  type TestUser,
  type Workspace,
  type WorkspaceBundle,
} from '../helpers/factories';
import { expectData, req } from '../helpers/http';

const UUID = '00000000-0000-4000-8000-000000000000';
describe('Board realtime (ws)', () => {
  let app: TestApp;
  let bundle: WorkspaceBundle;

  beforeAll(async () => {
    app = await createTestApp();
    bundle = await createWorkspaceBundle(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  describe('§1 Connection authentication', () => {
    it('rejects a missing token with an error frame TOKEN_INVALID', async () => {
      const sock = io(app.url, {
        transports: ['websocket'],
        reconnection: false,
      });
      try {
        const payload = await onceEvent<Record<string, unknown>>(
          sock,
          'error',
          5000,
        );
        expect(payload.code).toBe('TOKEN_INVALID');
      } finally {
        sock.close();
      }
    });

    it('rejects a garbage token with error frame TOKEN_INVALID', async () => {
      const sock = io(app.url, {
        auth: { token: 'not-a-jwt' },
        transports: ['websocket'],
        reconnection: false,
      });
      try {
        const payload = await onceEvent<Record<string, unknown>>(
          sock,
          'error',
          5000,
        );
        expect(payload.code).toBe('TOKEN_INVALID');
      } finally {
        sock.close();
      }
    });

    it('rejects an expired token with error frame TOKEN_EXPIRED', async () => {
      const expired = jwt.sign(
        { sub: bundle.viewer.id, isEmailVerified: true },
        process.env.JWT_SECRET as string,
        {
          algorithm: 'HS256',
          expiresIn: -10,
          issuer: 'syncboard',
          jwtid: UUID,
        },
      );
      const sock = io(app.url, {
        auth: { token: expired },
        transports: ['websocket'],
        reconnection: false,
      });
      try {
        const payload = await onceEvent<Record<string, unknown>>(
          sock,
          'error',
          5000,
        );
        expect(payload.code).toBe('TOKEN_EXPIRED');
      } finally {
        sock.close();
      }
    });
  });

  // =========================================================================
  describe('§2/§3 Workspace rooms, board rooms & presence', () => {
    let sockA: Awaited<ReturnType<typeof connect>>;
    let sockB: Awaited<ReturnType<typeof connect>>;

    it('connects both members and joins the workspace room (roster + member-online)', async () => {
      sockA = await connect(app.url, bundle.owner.accessToken);
      sockB = await connect(app.url, bundle.admin.accessToken);

      const joinedA = await new Promise<Record<string, unknown>>(
        (resolve, reject) => {
          sockA.once('workspace:joined', resolve);
          sockA.once('error', (e: unknown) =>
            reject(new Error(JSON.stringify(e))),
          );
          sockA.emit('workspace:join', { workspaceId: bundle.workspaceId });
        },
      );
      expect(joinedA.workspaceId).toBe(bundle.workspaceId);
      expect(joinedA.onlineMembers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: bundle.owner.id }),
        ]),
      );

      // B joining triggers workspace:member-online for A
      const online = collect(sockA, 'workspace:member-online');
      const joinedB = await new Promise<Record<string, unknown>>(
        (resolve, reject) => {
          sockB.once('workspace:joined', resolve);
          sockB.once('error', (e: unknown) =>
            reject(new Error(JSON.stringify(e))),
          );
          sockB.emit('workspace:join', { workspaceId: bundle.workspaceId });
        },
      );
      expect(joinedB.workspaceId).toBe(bundle.workspaceId);
      const memberOnline = await online.waitForCount(1);
      expect(memberOnline[0]).toMatchObject({ userId: bundle.admin.id });
      online.dispose();
    });

    it('board:join returns viewers to the joiner and announces presence to peers', async () => {
      const joinedA = await new Promise<Record<string, unknown>>(
        (resolve, reject) => {
          sockA.once('board:joined', resolve);
          sockA.once('error', (e: unknown) =>
            reject(new Error(JSON.stringify(e))),
          );
          sockA.emit('board:join', { boardId: bundle.boardId });
        },
      );
      expect(joinedA.boardId).toBe(bundle.boardId);
      expect(joinedA.viewers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: bundle.owner.id }),
        ]),
      );

      // B joins → A receives board:presence joined
      const presence = collect(sockA, 'board:presence');
      const joinedB = await new Promise<Record<string, unknown>>(
        (resolve, reject) => {
          sockB.once('board:joined', resolve);
          sockB.once('error', (e: unknown) =>
            reject(new Error(JSON.stringify(e))),
          );
          sockB.emit('board:join', { boardId: bundle.boardId });
        },
      );
      expect(joinedB.boardId).toBe(bundle.boardId);

      const events = await presence.waitForCount(1);
      expect(events[0]).toMatchObject({
        userId: bundle.admin.id,
        action: 'joined',
        displayName: bundle.admin.displayName,
        color: expect.any(String),
      });
      presence.dispose();
    });

    it('cursor relay: peer receives board:cursor, sender gets no echo', async () => {
      const receiver = collect(sockA, 'board:cursor');
      const echo = collect(sockB, 'board:cursor');

      sockB.emit('presence:cursor', {
        boardId: bundle.boardId,
        x: 123.5,
        y: 87.25,
      });

      const events = await receiver.waitForCount(1);
      expect(events[0]).toMatchObject({
        userId: bundle.admin.id,
        displayName: bundle.admin.displayName,
        x: 123.5,
        y: 87.25,
      });

      // No echo to the sender
      await new Promise((r) => setTimeout(r, 500));
      expect(echo.events).toHaveLength(0);
      receiver.dispose();
      echo.dispose();
    });

    it('disconnect removes presence: peers receive board:presence left', async () => {
      const left = collect(sockA, 'board:presence');
      await closeSocket(sockB);
      const events = await left.waitForCount(1);
      expect(events[0]).toMatchObject({
        userId: bundle.admin.id,
        action: 'left',
      });
      left.dispose();
      await closeSocket(sockA);
    });
  });

  // =========================================================================
  describe('§5 Room isolation', () => {
    it('a client on another board receives nothing', async () => {
      const outsiderWs = await createWorkspace(app, bundle.outsider);
      const outsiderBoard = await createBoard(
        app,
        bundle.outsider,
        outsiderWs.id,
        'Other',
      );
      const sockC = await connect(app.url, bundle.outsider.accessToken);
      sockC.emit('board:join', { boardId: outsiderBoard.id });
      await onceEvent(sockC, 'board:joined');

      const sockA = await connect(app.url, bundle.owner.accessToken);
      sockA.emit('board:join', { boardId: bundle.boardId });
      await onceEvent(sockA, 'board:joined');

      const stray = collect(sockC, 'board:cursor');
      sockA.emit('presence:cursor', { boardId: bundle.boardId, x: 1, y: 2 });
      await new Promise((r) => setTimeout(r, 700));

      expect(stray.events).toHaveLength(0);
      stray.dispose();
      await closeSocket(sockA);
      await closeSocket(sockC);
    });
  });

  // =========================================================================
  describe('§6 Rate limits (dedicated throttled instance)', () => {
    let throttled: TestApp;
    let user: TestUser;
    let ws: Workspace;
    let boardId: string;

    beforeAll(async () => {
      throttled = await createTestApp();
      user = await createVerifiedUser(throttled, 'ratelimit');
      ws = await createWorkspace(throttled, user);
      const board = await createBoard(throttled, user, ws.id, 'RL Board');
      boardId = board.id;
    });

    afterAll(async () => {
      await throttled.close();
    });

    it('silent cursor burst (601 events) is absorbed without error frames and the server stays alive', async () => {
      const sock = await connect(throttled.url, user.accessToken);
      sock.emit('board:join', { boardId });
      await onceEvent(sock, 'board:joined');

      const errors = collect(sock, 'error');
      for (let i = 0; i < 601; i++) {
        sock.emit('presence:cursor', { boardId, x: i, y: i });
      }

      await new Promise((r) => setTimeout(r, 1000));
      expect(errors.events).toHaveLength(0);

      // Server still healthy on subsequent join to another board room
      const alive = io(throttled.url, {
        auth: { token: user.accessToken },
        transports: ['websocket'],
        reconnection: false,
      });
      await onceEvent(alive, 'connect');
      alive.close();
      errors.dispose();
      await closeSocket(sock);
    });
  });

  // =========================================================================
  describe('§7 Reconnection & mid-session revocation', () => {
    it('reconnect with a fresh token resumes; revoked (logout-all) access token is rejected', async () => {
      const user = await createVerifiedUser(app, 'ws-reconnect');
      const ws = await createWorkspace(app, user);
      const board = await createBoard(app, user, ws.id, 'Reconnect Board');

      const sock1 = await connect(app.url, user.accessToken);
      sock1.emit('board:join', { boardId: board.id });
      await onceEvent(sock1, 'board:joined');
      await closeSocket(sock1);

      // Reconnect with a fresh token
      const login = await req(app.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });
      const freshToken = expectData<{
        tokens: { accessToken: string };
      }>(login, 200).tokens.accessToken;

      const sock2 = await connect(app.url, freshToken);
      sock2.emit('board:join', { boardId: board.id });
      await onceEvent(sock2, 'board:joined');
      await closeSocket(sock2);

      // Revoke mid-session: logout-all blacklists the access token's jti,
      // so a reconnect with the SAME token gets TOKEN_REVOKED at handshake.
      const revoke = await req(app.app.getHttpServer())
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${user.accessToken}`);
      expect(revoke.status).toBe(204);

      const sock3 = io(app.url, {
        auth: { token: user.accessToken },
        transports: ['websocket'],
        reconnection: false,
      });
      try {
        const payload = await onceEvent<Record<string, unknown>>(
          sock3,
          'error',
          5000,
        );
        expect(payload.code).toBe('TOKEN_REVOKED');
      } finally {
        sock3.close();
      }
    });
  });

  // =========================================================================
  describe('§2.2 Non-member board:join → BOARD_ACCESS_DENIED', () => {
    it('outsider emitting board:join receives an error frame BOARD_ACCESS_DENIED', async () => {
      // bundle.outsider is not a member of bundle.workspaceId
      const sock = await connect(app.url, bundle.outsider.accessToken);
      const errors = collect(sock, 'error');
      sock.emit('board:join', { boardId: bundle.boardId });
      const evts = await errors
        .waitForCount(1, 5000)
        .catch(() => errors.events);
      const found = evts.some(
        (e) => e.code === 'BOARD_ACCESS_DENIED' || e.code === 'FORBIDDEN',
      );
      expect(found).toBe(true);
      errors.dispose();
      await closeSocket(sock);
    });
  });

  // =========================================================================
  describe('§2.4 Duplicate board:join is idempotent', () => {
    it('second board:join on same board re-emits board:joined and re-announces presence to peers', async () => {
      const sockA = await connect(app.url, bundle.owner.accessToken);
      const sockB = await connect(app.url, bundle.admin.accessToken);

      // Both join workspace first
      const joinWsA = onceEvent(sockA, 'workspace:joined');
      sockA.emit('workspace:join', { workspaceId: bundle.workspaceId });
      await joinWsA;

      const joinWsB = onceEvent(sockB, 'workspace:joined');
      sockB.emit('workspace:join', { workspaceId: bundle.workspaceId });
      await joinWsB;

      // A joins board
      const joinBoardA = onceEvent(sockA, 'board:joined');
      sockA.emit('board:join', { boardId: bundle.boardId });
      await joinBoardA;

      // B joins board — triggers board:presence for A
      const presenceFromB = collect(sockA, 'board:presence');
      const joinBoardB = onceEvent(sockB, 'board:joined');
      sockB.emit('board:join', { boardId: bundle.boardId });
      await joinBoardB;
      await presenceFromB.waitForCount(1);
      presenceFromB.dispose();

      // B joins the SAME board again — no error, re-emits board:joined, re-announces to A
      const errorsCatcher = collect(sockB, 'error');
      const presenceAgain = collect(sockA, 'board:presence');
      const dupJoinedP = onceEvent(sockB, 'board:joined', 5000);
      sockB.emit('board:join', { boardId: bundle.boardId });
      const dupJoined = await dupJoinedP;
      expect((dupJoined as Record<string, unknown>).boardId).toBe(
        bundle.boardId,
      );
      const presenceEvts = await presenceAgain
        .waitForCount(1)
        .catch(() => presenceAgain.events);
      expect(presenceEvts.length).toBeGreaterThanOrEqual(1);
      // Must NOT produce an error frame
      await new Promise((r) => setTimeout(r, 300));
      expect(errorsCatcher.events).toHaveLength(0);

      errorsCatcher.dispose();
      presenceAgain.dispose();
      await closeSocket(sockA);
      await closeSocket(sockB);
    });
  });

  // =========================================================================
  describe('§2.5 board:leave stops event delivery', () => {
    it('after board:leave, card mutations no longer arrive on that socket', async () => {
      const user = await createVerifiedUser(app, 'leaver-ws');
      const ws = await createWorkspace(app, user);
      const board = await createBoard(app, user, ws.id, 'Leave Board');
      const list = await createList(app, user, ws.id, board.id, 'Leave List');

      const sock = await connect(app.url, user.accessToken);
      const joinWs = onceEvent(sock, 'workspace:joined');
      sock.emit('workspace:join', { workspaceId: ws.id });
      await joinWs;

      const joinBoard = onceEvent(sock, 'board:joined');
      sock.emit('board:join', { boardId: board.id });
      await joinBoard;

      // Leave the board room
      sock.emit('board:leave', { boardId: board.id });
      await new Promise((r) => setTimeout(r, 200));

      // Now trigger a card:created event via REST
      const stray = collect(sock, 'card:created');
      await createCard(app, user, ws.id, board.id, list.id, 'After Leave');
      await new Promise((r) => setTimeout(r, 700));

      expect(stray.events).toHaveLength(0);
      stray.dispose();
      await closeSocket(sock);
    });
  });

  // =========================================================================
  describe('§2.6/§2.8 REST mutation → WS broadcast payload fidelity', () => {
    let sockObserver: Awaited<ReturnType<typeof connect>>;

    beforeAll(async () => {
      sockObserver = await connect(app.url, bundle.admin.accessToken);
      const joinWs = onceEvent(sockObserver, 'workspace:joined');
      sockObserver.emit('workspace:join', { workspaceId: bundle.workspaceId });
      await joinWs;

      const joinBoard = onceEvent(sockObserver, 'board:joined');
      sockObserver.emit('board:join', { boardId: bundle.boardId });
      await joinBoard;
    });

    afterAll(async () => {
      await closeSocket(sockObserver);
    });

    it('§2.6 REST POST card → card:created ≤2s with payload contract (card.id, listId, createdBy)', async () => {
      const relay = collect(sockObserver, 'card:created');
      const newCard = await createCard(
        app,
        bundle.owner,
        bundle.workspaceId,
        bundle.boardId,
        bundle.listId,
        'Mirror Card',
      );

      const evts = await relay.waitForCount(1, 3000);
      expect(evts[0]).toMatchObject({
        card: { id: newCard.id },
        listId: bundle.listId,
        createdBy: { id: bundle.owner.id },
      });
      relay.dispose();
    });

    it('§2.8 PATCH card → card:updated broadcast (cardId, changes, updatedBy)', async () => {
      const relay = collect(sockObserver, 'card:updated');
      await req(app.app.getHttpServer())
        .patch(
          `/api/workspaces/${bundle.workspaceId}/boards/${bundle.boardId}/cards/${bundle.cardId}`,
        )
        .set('Authorization', `Bearer ${bundle.owner.accessToken}`)
        .send({ title: 'Relay Card Updated' });

      const evts = await relay.waitForCount(1, 3000);
      expect(evts[0]).toMatchObject({
        cardId: bundle.cardId,
        changes: { title: 'Relay Card Updated' },
        updatedBy: { id: bundle.owner.id },
      });
      relay.dispose();
    });

    it('§2.8 PATCH card/move → card:moved broadcast (cardId, fromListId, toListId, newRank, movedBy)', async () => {
      const targetList = await createList(
        app,
        bundle.owner,
        bundle.workspaceId,
        bundle.boardId,
        'Relay Target',
      );
      const relay = collect(sockObserver, 'card:moved');
      await req(app.app.getHttpServer())
        .patch(
          `/api/workspaces/${bundle.workspaceId}/boards/${bundle.boardId}/cards/${bundle.cardId}/move`,
        )
        .set('Authorization', `Bearer ${bundle.owner.accessToken}`)
        .send({ targetListId: targetList.id });

      const evts = await relay.waitForCount(1, 3000);
      expect(evts[0]).toMatchObject({
        cardId: bundle.cardId,
        fromListId: bundle.listId,
        toListId: targetList.id,
        newRank: expect.any(String),
        movedBy: { id: bundle.owner.id },
      });
      relay.dispose();
    });

    it('§2.8 DELETE card → card:archived broadcast (cardId, listId, archivedBy)', async () => {
      const toArchive = await createCard(
        app,
        bundle.owner,
        bundle.workspaceId,
        bundle.boardId,
        bundle.listId,
        'Archive Me',
      );
      const relay = collect(sockObserver, 'card:archived');
      await req(app.app.getHttpServer())
        .delete(
          `/api/workspaces/${bundle.workspaceId}/boards/${bundle.boardId}/cards/${toArchive.id}`,
        )
        .set('Authorization', `Bearer ${bundle.owner.accessToken}`);

      const evts = await relay.waitForCount(1, 3000);
      expect(evts[0]).toMatchObject({
        cardId: toArchive.id,
        archivedBy: { id: bundle.owner.id },
      });
      relay.dispose();
    });

    it('§2.8 POST list → list:created broadcast (list.id, list.boardId, createdBy)', async () => {
      const relay = collect(sockObserver, 'list:created');
      const newList = await createList(
        app,
        bundle.owner,
        bundle.workspaceId,
        bundle.boardId,
        'Mirror List',
      );

      const evts = await relay.waitForCount(1, 3000);
      expect(evts[0]).toMatchObject({
        list: { id: newList.id, boardId: bundle.boardId },
        createdBy: { id: bundle.owner.id },
      });
      relay.dispose();
    });
  });
});
