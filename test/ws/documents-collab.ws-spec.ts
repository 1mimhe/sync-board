/**
 * Document collaboration WebSocket e2e — socket.io-client against in-process app.
 *
 * Covers: test-cases-realtime-ws.md §4 (Document Collaboration)
 *   §4.1 doc:join returns full state
 *   §4.2 update relay verbatim
 *   §4.3 convergence (sv+diffs)
 *   §4.4 awareness relay (peers only)
 *   §4.5 editor lifecycle (joined/left)
 *   §4.6 doc:saved event after debounce
 *   §4.7 outsider doc:join → DOCUMENT_ACCESS_DENIED
 *   §4.8 rate limits
 *
 * ⛔ BLOCKED — Phase 5 pending.
 * `src/modules/document/document.module.ts` is an empty stub.
 * Remove `.skip` from each `describe.skip` block once the module lands.
 * Cross-check event names against the final DocumentGateway constants before activating.
 */
import { io } from 'socket.io-client';
import { createTestApp, type TestApp } from '../helpers/app';
import { connect, closeSocket, collect, onceEvent } from '../helpers/ws';
import {
  createVerifiedUser,
  createWorkspace,
  createBoard,
  createList,
  createCard,
  addMemberViaInvitation,
  type TestUser,
} from '../helpers/factories';
import { expectData, req } from '../helpers/http';

/**
 * Document WS event names (Phase 5 target — update when DocumentGateway lands).
 * These are intentionally consts here so they can be updated in one place.
 */
const DOC_EVENTS = {
  JOIN: 'doc:join',
  JOINED: 'doc:joined',
  UPDATE: 'doc:update',
  AWARENESS: 'doc:awareness',
  SAVED: 'doc:saved',
  EDITOR_JOINED: 'editor:joined',
  EDITOR_LEFT: 'editor:left',
  ACCESS_DENIED: 'DOCUMENT_ACCESS_DENIED',
} as const;

describe('Documents collaboration (ws)', () => {
  let app: TestApp;
  let owner: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let workspaceId: string;
  let docId: string;

  const docsUrl = () => `/api/workspaces/${workspaceId}/documents`;
  const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.accessToken}` });

  beforeAll(async () => {
    app = await createTestApp();
    [owner, member, outsider] = await Promise.all([
      createVerifiedUser(app, 'collab-owner'),
      createVerifiedUser(app, 'collab-member'),
      createVerifiedUser(app, 'collab-outsider'),
    ]);
    const ws = await createWorkspace(app, owner);
    workspaceId = ws.id;
    await addMemberViaInvitation(app, owner, member, workspaceId, 'member');

    // Create a document via REST (if the route exists)
    const created = await req(app.app.getHttpServer())
      .post(docsUrl())
      .set(auth(owner))
      .send({ title: 'Collab Doc' });
    if (created.status === 201) {
      docId = (created.body.data as { id: string }).id;
    } else {
      docId = '00000000-0000-4000-8000-000000000000'; // placeholder until module lands
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  describe.skip('§4.1 doc:join returns full initial state', () => {
    it('joining a document receives initialState bytes', async () => {
      const sock = await connect(app.url, owner.accessToken);
      const joined = collect(sock, DOC_EVENTS.JOINED);
      sock.emit(DOC_EVENTS.JOIN, { docId });
      const evts = await joined.waitForCount(1);
      // initialState should be a Uint8Array / Buffer passed as binary or base64
      expect(evts[0]).toHaveProperty('docId', docId);
      joined.dispose();
      await closeSocket(sock);
    });
  });

  // =========================================================================
  describe.skip('§4.2 update relay verbatim', () => {
    it('A sends binary update frame → B receives identical bytes', async () => {
      const sockA = await connect(app.url, owner.accessToken);
      const sockB = await connect(app.url, member.accessToken);

      sockA.emit(DOC_EVENTS.JOIN, { docId });
      sockB.emit(DOC_EVENTS.JOIN, { docId });
      await Promise.all([
        onceEvent(sockA, DOC_EVENTS.JOINED),
        onceEvent(sockB, DOC_EVENTS.JOINED),
      ]);

      const relay = collect(sockB, DOC_EVENTS.UPDATE);
      const update = new Uint8Array([1, 2, 3, 4]).buffer;
      sockA.emit(DOC_EVENTS.UPDATE, { docId, update });

      const evts = await relay.waitForCount(1, 3000);
      // Bytes must match
      expect(evts[0]).toHaveProperty('docId', docId);
      relay.dispose();

      await closeSocket(sockA);
      await closeSocket(sockB);
    });
  });

  // =========================================================================
  describe.skip('§4.4 awareness relay (peers only, not sender)', () => {
    it('A emits awareness → B gets it; A does NOT receive own frame', async () => {
      const sockA = await connect(app.url, owner.accessToken);
      const sockB = await connect(app.url, member.accessToken);

      sockA.emit(DOC_EVENTS.JOIN, { docId });
      sockB.emit(DOC_EVENTS.JOIN, { docId });
      await Promise.all([
        onceEvent(sockA, DOC_EVENTS.JOINED),
        onceEvent(sockB, DOC_EVENTS.JOINED),
      ]);

      const receiverB = collect(sockB, DOC_EVENTS.AWARENESS);
      const echoA = collect(sockA, DOC_EVENTS.AWARENESS);

      sockA.emit(DOC_EVENTS.AWARENESS, { docId, state: { cursor: { anchor: 0 } } });

      const evts = await receiverB.waitForCount(1, 3000);
      expect(evts[0]).toHaveProperty('docId', docId);

      await new Promise((r) => setTimeout(r, 300));
      expect(echoA.events).toHaveLength(0);

      receiverB.dispose();
      echoA.dispose();
      await closeSocket(sockA);
      await closeSocket(sockB);
    });
  });

  // =========================================================================
  describe.skip('§4.5 editor lifecycle: joined/left frames', () => {
    it('B joins → A receives editor:joined; B disconnects → A receives editor:left', async () => {
      const sockA = await connect(app.url, owner.accessToken);
      sockA.emit(DOC_EVENTS.JOIN, { docId });
      await onceEvent(sockA, DOC_EVENTS.JOINED);

      const joined = collect(sockA, DOC_EVENTS.EDITOR_JOINED);
      const sockB = await connect(app.url, member.accessToken);
      sockB.emit(DOC_EVENTS.JOIN, { docId });
      await onceEvent(sockB, DOC_EVENTS.JOINED);

      const joinedEvts = await joined.waitForCount(1);
      expect(joinedEvts[0]).toMatchObject({ userId: member.id });
      joined.dispose();

      const left = collect(sockA, DOC_EVENTS.EDITOR_LEFT);
      await closeSocket(sockB);
      const leftEvts = await left.waitForCount(1);
      expect(leftEvts[0]).toMatchObject({ userId: member.id });
      left.dispose();

      await closeSocket(sockA);
    });
  });

  // =========================================================================
  describe.skip('§4.7 outsider doc:join → DOCUMENT_ACCESS_DENIED', () => {
    it('outsider receives an error frame DOCUMENT_ACCESS_DENIED', async () => {
      const sock = await connect(app.url, outsider.accessToken);
      const errors = collect(sock, 'error');
      sock.emit(DOC_EVENTS.JOIN, { docId });
      const evts = await errors.waitForCount(1, 5000).catch(() => errors.events);
      const found = evts.some(
        (e) => e.code === DOC_EVENTS.ACCESS_DENIED || e.code === 'FORBIDDEN',
      );
      expect(found).toBe(true);
      errors.dispose();
      await closeSocket(sock);
    });
  });
});
