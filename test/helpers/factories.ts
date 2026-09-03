import { randomBytes } from 'crypto';
import type { Response } from 'supertest';
import type { TestApp } from './app';
import { expectData, extractRefreshCookie, req, type ApiUser } from './http';
import { waitForMailToken } from './mailhog';

/**
 * Data factories with run-scoped isolation (e2e-test-generation.md §2):
 * every spec creates its own users/workspaces with unique `e2e-<runId>` emails;
 * no reliance on pre-seeded data. Cleanup is optional (throwaway DB).
 */

const RUN_ID = randomBytes(4).toString('hex');
const DEFAULT_PASSWORD = 'SecureP@ss123';

export function runId(): string {
  return RUN_ID;
}

export function uniqueEmail(label: string): string {
  return `e2e-${RUN_ID}-${label}-${Date.now()}@t.local`;
}

export interface TestUser {
  id: string;
  email: string;
  displayName: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
}

export interface Board {
  id: string;
  workspaceId: string;
  title: string;
}

export interface ListEntity {
  id: string;
  boardId: string;
  title: string;
  rank: string;
}

export interface Card {
  id: string;
  listId: string;
  title: string;
  rank: string;
}

/** Register a user through the real API. Asserts 201 + envelope. */
export async function registerUser(
  testApp: TestApp,
  label: string,
  overrides: Partial<{
    email: string;
    password: string;
    displayName: string;
  }> = {},
): Promise<TestUser & { raw: Response; apiUser: ApiUser }> {
  const email = overrides.email ?? uniqueEmail(label);
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const displayName = overrides.displayName ?? `User ${label}`;
  const res = await req(testApp.app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password, displayName });
  const data = expectData<{
    user: ApiUser;
    tokens: { accessToken: string; expiresIn: number };
  }>(res, 201);
  return {
    id: data.user.id,
    email: data.user.email,
    displayName: data.user.displayName,
    password,
    accessToken: data.tokens.accessToken,
    refreshToken: extractRefreshCookie(res).split(';')[0].split('=')[1],
    apiUser: data.user,
    raw: res,
  };
}

/** Login through the real API, returning a fresh access token. */
export async function loginUser(
  testApp: TestApp,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: ApiUser }> {
  const res = await req(testApp.app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password });
  const data = expectData<{ user: ApiUser; tokens: { accessToken: string } }>(
    res,
    200,
  );
  return {
    accessToken: data.tokens.accessToken,
    refreshToken: extractRefreshCookie(res).split(';')[0].split('=')[1],
    user: data.user,
  };
}

/**
 * Verify a user's email using the real verification email (MailHog).
 * Registration-issued tokens carry `isEmailVerified: false`, so callers must
 * re-login afterwards to obtain a verified access token.
 */
export async function verifyUserEmail(
  testApp: TestApp,
  email: string,
): Promise<void> {
  const token = await waitForMailToken(email, 'verify');
  const res = await req(testApp.app.getHttpServer())
    .post('/api/auth/verify-email')
    .send({ token });
  expectData(res, 200);
}

/** Register + email-verify + re-login: the standard e2e actor. */
export async function createVerifiedUser(
  testApp: TestApp,
  label: string,
  overrides: Partial<{ displayName: string }> = {},
): Promise<TestUser> {
  const registered = await registerUser(testApp, label, overrides);
  await verifyUserEmail(testApp, registered.email);
  const login = await loginUser(testApp, registered.email, registered.password);
  return {
    id: registered.id,
    email: registered.email,
    displayName: registered.displayName,
    password: registered.password,
    accessToken: login.accessToken,
    refreshToken: login.refreshToken,
  };
}

export async function createWorkspace(
  testApp: TestApp,
  user: TestUser,
  name?: string,
): Promise<Workspace> {
  const res = await req(testApp.app.getHttpServer())
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ name: name ?? `WS ${RUN_ID} ${randomBytes(2).toString('hex')}` });
  const data = expectData<{
    id: string;
    name: string;
    slug: string;
    ownerId: string;
  }>(res, 201);
  return data;
}

/** Invite an email to a workspace through the real API (response carries the HASHED token). */
export async function inviteMember(
  testApp: TestApp,
  inviter: TestUser,
  workspaceId: string,
  email: string,
  role: 'owner' | 'admin' | 'member' | 'viewer' = 'member',
): Promise<{ id: string; token: string; email: string; role: string }> {
  const res = await req(testApp.app.getHttpServer())
    .post(`/api/workspaces/${workspaceId}/invitations`)
    .set('Authorization', `Bearer ${inviter.accessToken}`)
    .send({ email, role });
  return expectData(res, 201);
}

/** Fetch the RAW invitation token for `email` from the invitation email (MailHog). */
export async function getInvitationToken(email: string): Promise<string> {
  return waitForMailToken(email, 'invite');
}

/** Accept an invitation through the real API. */
export async function acceptInvitation(
  testApp: TestApp,
  invitee: TestUser,
  token: string,
): Promise<Response> {
  return req(testApp.app.getHttpServer())
    .post('/api/workspaces/invitations/accept')
    .set('Authorization', `Bearer ${invitee.accessToken}`)
    .send({ token });
}

/** Invite + fetch raw token + accept as the invitee — full happy-path membership. */
export async function addMemberViaInvitation(
  testApp: TestApp,
  inviter: TestUser,
  invitee: TestUser,
  workspaceId: string,
  role: 'admin' | 'member' | 'viewer' = 'member',
): Promise<void> {
  await inviteMember(testApp, inviter, workspaceId, invitee.email, role);
  const token = await getInvitationToken(invitee.email);
  const res = await acceptInvitation(testApp, invitee, token);
  expectData(res, 200);
}

export async function createBoard(
  testApp: TestApp,
  user: TestUser,
  workspaceId: string,
  title?: string,
): Promise<Board> {
  const res = await req(testApp.app.getHttpServer())
    .post(`/api/workspaces/${workspaceId}/boards`)
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ title: title ?? `Board ${RUN_ID}` });
  return expectData(res, 201);
}

export async function createList(
  testApp: TestApp,
  user: TestUser,
  workspaceId: string,
  boardId: string,
  title?: string,
): Promise<ListEntity> {
  const res = await req(testApp.app.getHttpServer())
    .post(`/api/workspaces/${workspaceId}/boards/${boardId}/lists`)
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ title: title ?? `List ${randomBytes(2).toString('hex')}` });
  return expectData(res, 201);
}

export async function createCard(
  testApp: TestApp,
  user: TestUser,
  workspaceId: string,
  boardId: string,
  listId: string,
  title?: string,
): Promise<Card> {
  const res = await req(testApp.app.getHttpServer())
    .post(
      `/api/workspaces/${workspaceId}/boards/${boardId}/lists/${listId}/cards`,
    )
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ title: title ?? `Card ${randomBytes(2).toString('hex')}` });
  return expectData(res, 201);
}

export interface ActorBundle {
  owner: TestUser;
  admin: TestUser;
  member: TestUser;
  viewer: TestUser;
  outsider: TestUser;
}

/** Create the standard five verified actors (owner/admin/member/viewer/outsider). */
export async function createActors(testApp: TestApp): Promise<ActorBundle> {
  const [owner, admin, member, viewer, outsider] = await Promise.all([
    createVerifiedUser(testApp, 'owner'),
    createVerifiedUser(testApp, 'admin'),
    createVerifiedUser(testApp, 'member'),
    createVerifiedUser(testApp, 'viewer'),
    createVerifiedUser(testApp, 'outsider'),
  ]);
  return { owner, admin, member, viewer, outsider };
}

export interface WorkspaceBundle extends ActorBundle {
  workspaceId: string;
  boardId: string;
  listId: string;
  cardId: string;
}

/**
 * Full stack: five actors, workspace owned by `owner`, admin/member/viewer
 * invited through the real invitation flow, one board + list + card.
 */
export async function createWorkspaceBundle(
  testApp: TestApp,
): Promise<WorkspaceBundle> {
  const actors = await createActors(testApp);
  const workspace = await createWorkspace(testApp, actors.owner);

  await addMemberViaInvitation(
    testApp,
    actors.owner,
    actors.admin,
    workspace.id,
    'admin',
  );
  await addMemberViaInvitation(
    testApp,
    actors.owner,
    actors.member,
    workspace.id,
    'member',
  );
  await addMemberViaInvitation(
    testApp,
    actors.owner,
    actors.viewer,
    workspace.id,
    'viewer',
  );

  const board = await createBoard(testApp, actors.owner, workspace.id);
  const list = await createList(
    testApp,
    actors.owner,
    workspace.id,
    board.id,
    'To Do',
  );
  const card = await createCard(
    testApp,
    actors.owner,
    workspace.id,
    board.id,
    list.id,
    'Seed card',
  );

  return {
    ...actors,
    workspaceId: workspace.id,
    boardId: board.id,
    listId: list.id,
    cardId: card.id,
  };
}
