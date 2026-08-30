/**
 * Workspace module e2e — HTTP via supertest against the real AppModule.
 *
 * Covers: test-cases-workspace.md
 *   §1 Create (1.1 happy, 1.2 validation, 1.3 unauthenticated)
 *   §2 List mine (2.1, data isolation 16.4.3)
 *   §3 Get by slug (3.1, non-member 3.2)
 *   §4 Get by ID (4.1, 404 4.2)
 *   §5 Update (5.1, slug regen 5.2.1, RBAC)
 *   §6 Archive (6.1, soft-delete 16.3)
 *   §7 Leave (7.1, sole owner 7.2.1)
 *   §8 Transfer ownership (8.1, TARGET_NOT_MEMBER, 17.2 chain)
 *   §9 Members · §10 Update role (10.x, CANNOT_REMOVE_OWNER)
 *   §11 Remove member · §12 Invite · §13 List invitations
 *   §14 Accept invitation (happy, EMAIL_MISMATCH, EXPIRED, double accept)
 *   §15 Revoke invitation
 */
import { createTestApp, type TestApp } from '../helpers/app';
import { expectData, expectError, req } from '../helpers/http';
import {
  acceptInvitation,
  addMemberViaInvitation,
  createActors,
  createWorkspace,
  getInvitationToken,
  inviteMember,
  registerUser,
  type ActorBundle,
  type TestUser,
  type Workspace,
} from '../helpers/factories';

describe('Workspace module (e2e)', () => {
  let app: TestApp;
  let actors: ActorBundle;
  let workspace: Workspace;

  beforeAll(async () => {
    app = await createTestApp();
    actors = await createActors(app);
    workspace = await createWorkspace(app, actors.owner);
    await addMemberViaInvitation(app, actors.owner, actors.admin, workspace.id, 'admin');
    await addMemberViaInvitation(app, actors.owner, actors.member, workspace.id, 'member');
    await addMemberViaInvitation(app, actors.owner, actors.viewer, workspace.id, 'viewer');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('§1 Create workspace', () => {
    it('1.1.1 creates with auto slug, ownerId and null archivedAt', async () => {
      const res = await req(app.app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${actors.owner.accessToken}`)
        .send({ name: `Engineering Team ${Date.now()}` });
      const data = expectData<{
        id: string;
        slug: string;
        ownerId: string;
        archivedAt: null;
      }>(res, 201);
      expect(data.slug).toEqual(expect.stringMatching(/engineering-team/));
      expect(data.ownerId).toBe(actors.owner.id);
      expect(data.archivedAt).toBeNull();
    });

    it('1.1.3/1.1.4 trims name and description', async () => {
      const res = await req(app.app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${actors.owner.accessToken}`)
        .send({ name: '  Padded Name  ', description: '  Hello  ' });
      const data = expectData<{ name: string; description: string }>(res, 201);
      expect(data.name).toBe('Padded Name');
      expect(data.description).toBe('Hello');
    });

    it('1.1.6 generates a clean slug from special characters', async () => {
      const res = await req(app.app.getHttpServer())
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${actors.owner.accessToken}`)
        .send({ name: 'Prøject @#$ Board' });
      const data = expectData<{ slug: string }>(res, 201);
      expect(data.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    });

    it('1.2.x validation sweep → 400 VALIDATION_ERROR', async () => {
      const server = app.app.getHttpServer();
      const auth = { Authorization: `Bearer ${actors.owner.accessToken}` };

      const rows: Array<[string, Record<string, unknown>]> = [
        ['missing name', { description: 'test' }],
        ['name too short', { name: 'A' }],
        ['name too long', { name: 'x'.repeat(101) }],
        ['description too long', { name: 'Valid Name', description: 'x'.repeat(501) }],
        ['invalid avatarUrl', { name: 'Valid Name', avatarUrl: 'not-a-url' }],
        ['unknown field', { name: 'Valid Name', bogus: 1 }],
      ];
      for (const [label, body] of rows) {
        const res = await req(server).post('/api/workspaces').set(auth).send(body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.details.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: expect.any(String) }),
          ]),
        );
        void label; // row identifier for debugging
      }
    });

    it('1.3.x requires authentication → 401 TOKEN_INVALID', async () => {
      const res = await req(app.app.getHttpServer())
        .post('/api/workspaces')
        .send({ name: 'No Auth' });
      expectError(res, 401, 'TOKEN_INVALID');
    });
  });

  describe('§2/§3/§4 Read + data isolation', () => {
    it('2.1/16.4.3 lists only workspaces the user is a member of', async () => {
      const res = await req(app.app.getHttpServer())
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${actors.outsider.accessToken}`);
      const data = expectData<{ items: Array<{ id: string }> }>(res, 200);
      expect(data.items.map((w) => w.id)).not.toContain(workspace.id);
    });

    it('3.1 resolves by slug for members (with their role)', async () => {
      const res = await req(app.app.getHttpServer())
        .get(`/api/workspaces/slug/${workspace.slug}`)
        .set('Authorization', `Bearer ${actors.member.accessToken}`);
      const data = expectData<{ id: string; role: string }>(res, 200);
      expect(data.id).toBe(workspace.id);
      expect(data.role).toBe('member');
    });

    it('3.2 blocks non-members with 403 FORBIDDEN', async () => {
      const res = await req(app.app.getHttpServer())
        .get(`/api/workspaces/slug/${workspace.slug}`)
        .set('Authorization', `Bearer ${actors.outsider.accessToken}`);
      expectError(res, 403, 'FORBIDDEN');
    });

    it('4.1 resolves by ID for members', async () => {
      const res = await req(app.app.getHttpServer())
        .get(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${actors.viewer.accessToken}`);
      const data = expectData<{ id: string; role: string }>(res, 200);
      expect(data.id).toBe(workspace.id);
      expect(data.role).toBe('viewer');
    });

    it('4.2 returns 404/403 for an unknown workspace id', async () => {
      const res = await req(app.app.getHttpServer())
        .get('/api/workspaces/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${actors.owner.accessToken}`);
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('§5 Update workspace', () => {
    it('5.2.1 renames and regenerates the slug (state-verified)', async () => {
      const target = await createWorkspace(app, actors.owner, 'Rename Target');
      const res = await req(app.app.getHttpServer())
        .patch(`/api/workspaces/${target.id}`)
        .set('Authorization', `Bearer ${actors.owner.accessToken}`)
        .send({ name: 'Team B Renamed' });
      const data = expectData<{ name: string; slug: string }>(res, 200);
      expect(data.name).toBe('Team B Renamed');
      expect(data.slug).toContain('team-b-renamed');

      // Old slug must no longer resolve
      const oldSlug = await req(app.app.getHttpServer())
        .get(`/api/workspaces/slug/${target.slug}`)
        .set('Authorization', `Bearer ${actors.owner.accessToken}`);
      expect(oldSlug.status).toBe(404);
    });

    it('RBAC: member and viewer cannot update → 403 FORBIDDEN', async () => {
      for (const role of ['member', 'viewer'] as const) {
        const res = await req(app.app.getHttpServer())
          .patch(`/api/workspaces/${workspace.id}`)
          .set('Authorization', `Bearer ${actors[role].accessToken}`)
          .send({ name: 'Hijack Attempt' });
        expectError(res, 403, 'FORBIDDEN');
      }
    });
  });

  describe('§6 Archive workspace (soft delete)', () => {
    it('6.1/16.3 archives for the owner and hides it afterwards', async () => {
      const target = await createWorkspace(app, actors.owner, 'Archive Me');
      const res = await req(app.app.getHttpServer())
        .delete(`/api/workspaces/${target.id}`)
        .set('Authorization', `Bearer ${actors.owner.accessToken}`);
      expect(res.status).toBe(204);

      // 16.3.3: direct GET behaves per soft-delete rules → 404
      const probe = await req(app.app.getHttpServer())
        .get(`/api/workspaces/${target.id}`)
        .set('Authorization', `Bearer ${actors.owner.accessToken}`);
      expectError(probe, 404, 'WORKSPACE_NOT_FOUND');
    });

    it('6.x RBAC: admin cannot archive → 403 FORBIDDEN', async () => {
      const res = await req(app.app.getHttpServer())
        .delete(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${actors.admin.accessToken}`);
      expectError(res, 403, 'FORBIDDEN');
    });
  });

  describe('§7 Leave workspace', () => {
    it('7.2.1 blocks the sole owner with 422 CANNOT_LEAVE_AS_SOLE_OWNER', async () => {
      const target = await createWorkspace(app, actors.outsider, 'Sole Owner WS');
      const res = await req(app.app.getHttpServer())
        .delete(`/api/workspaces/${target.id}/leave`)
        .set('Authorization', `Bearer ${actors.outsider.accessToken}`);
      expectError(res, 422, 'CANNOT_LEAVE_AS_SOLE_OWNER');
    });

    it('7.1 lets a member leave and revokes their access', async () => {
      const leaver = actors.member;
      const res = await req(app.app.getHttpServer())
        .delete(`/api/workspaces/${workspace.id}/leave`)
        .set('Authorization', `Bearer ${leaver.accessToken}`);
      expect(res.status).toBe(204);

      const probe = await req(app.app.getHttpServer())
        .get(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${leaver.accessToken}`);
      expectError(probe, 403, 'FORBIDDEN');
    });
  });

  describe('§8 Transfer ownership (17.2 chain)', () => {
    it('8.x rejects transfer to a non-member with 422 TARGET_NOT_MEMBER', async () => {
      const res = await req(app.app.getHttpServer())
        .post(`/api/workspaces/${workspace.id}/transfer-ownership`)
        .set('Authorization', `Bearer ${actors.owner.accessToken}`)
        .send({ newOwnerId: actors.outsider.id });
      expectError(res, 422, 'TARGET_NOT_MEMBER');
    });

    it('8.1 transfers to admin; the former owner can then leave', async () => {
      const res = await req(app.app.getHttpServer())
        .post(`/api/workspaces/${workspace.id}/transfer-ownership`)
        .set('Authorization', `Bearer ${actors.owner.accessToken}`)
        .send({ newOwnerId: actors.admin.id });
      const data = expectData<{ role: string; userId: string }>(res, 200);
      expect(data.role).toBe('owner');
      expect(data.userId).toBe(actors.admin.id);

      // Former owner is demoted to admin and may leave
      const leave = await req(app.app.getHttpServer())
        .delete(`/api/workspaces/${workspace.id}/leave`)
        .set('Authorization', `Bearer ${actors.owner.accessToken}`);
      expect(leave.status).toBe(204);

      // New owner keeps full control
      const probe = await req(app.app.getHttpServer())
        .get(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${actors.admin.accessToken}`);
      expect(expectData<{ role: string }>(probe, 200).role).toBe('owner');
    });
  });

  describe('§9 Members', () => {
    async function getMembers(token: string) {
      const res = await req(app.app.getHttpServer())
        .get(`/api/workspaces/${workspace.id}/members`)
        .set('Authorization', `Bearer ${token}`);
      return expectData<
        Array<{ id: string; userId: string; role: string; user: { email: string } }>
      >(res, 200);
    }

    it('9.1 lists members with their roles and user details', async () => {
      const members = await getMembers(actors.admin.accessToken);
      const byRole = members.map((m) => m.role).sort();
      expect(byRole).toEqual(['owner', 'viewer']);
      expect(members[0].user).toMatchObject({ email: expect.any(String) });
    });

    it('9.x blocks non-members → 403 FORBIDDEN', async () => {
      const res = await req(app.app.getHttpServer())
        .get(`/api/workspaces/${workspace.id}/members`)
        .set('Authorization', `Bearer ${actors.outsider.accessToken}`);
      expectError(res, 403, 'FORBIDDEN');
    });

    it('10.x promotes viewer→admin; blocks demoting the sole owner (CANNOT_REMOVE_OWNER)', async () => {
      const members = await getMembers(actors.admin.accessToken);
      const ownerMember = members.find((m) => m.role === 'owner')!;
      const viewerMember = members.find((m) => m.role === 'viewer')!;

      // Promote viewer
      const promote = await req(app.app.getHttpServer())
        .patch(`/api/workspaces/${workspace.id}/members/${viewerMember.id}`)
        .set('Authorization', `Bearer ${actors.admin.accessToken}`)
        .send({ role: 'admin' });
      const promoted = expectData<{ role: string }>(promote, 200);
      expect(promoted.role).toBe('admin');

      // Sole owner cannot be demoted
      const demoteOwner = await req(app.app.getHttpServer())
        .patch(`/api/workspaces/${workspace.id}/members/${ownerMember.id}`)
        .set('Authorization', `Bearer ${actors.admin.accessToken}`)
        .send({ role: 'member' });
      expectError(demoteOwner, 422, 'CANNOT_REMOVE_OWNER');
    });

    it('11.x admin cannot remove the owner; member removal works and revokes access', async () => {
      // Fresh member joins via the real invitation flow
      const fresh = await registerUser(app, 'rejoiner');
      await addMemberViaInvitation(app, actors.admin, fresh, workspace.id, 'member');

      const members = await getMembers(actors.admin.accessToken);
      const freshMember = members.find((m) => m.userId === fresh.id)!;
      const ownerMember = members.find((m) => m.role === 'owner')!;
      const adminMember = members.find((m) => m.userId === actors.viewer.id)!;

      // Admin attempts to remove the owner → 403
      const adminVsOwner = await req(app.app.getHttpServer())
        .delete(`/api/workspaces/${workspace.id}/members/${ownerMember.id}`)
        .set('Authorization', `Bearer ${actors.viewer.accessToken}`);
      expectError(adminVsOwner, 403, 'FORBIDDEN');
      expect(adminMember.role).toBe('admin');

      // Owner removes the fresh member
      const remove = await req(app.app.getHttpServer())
        .delete(`/api/workspaces/${workspace.id}/members/${freshMember.id}`)
        .set('Authorization', `Bearer ${actors.admin.accessToken}`);
      expect(remove.status).toBe(204);

      // Removed member loses access
      const probe = await req(app.app.getHttpServer())
        .get(`/api/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${fresh.accessToken}`);
      expectError(probe, 403, 'FORBIDDEN');
    });
  });

  describe('§12/§13 Invitations', () => {
    it('12.1 invites a member-role email → 201 (pending status; token is a SHA-256 HASH)', async () => {
      const inviteeEmail = uniqueLocalEmail('invite-happy');
      const res = await req(app.app.getHttpServer())
        .post(`/api/workspaces/${workspace.id}/invitations`)
        .set('Authorization', `Bearer ${actors.admin.accessToken}`)
        .send({ email: inviteeEmail, role: 'viewer' });
      const data = expectData<{
        id: string;
        email: string;
        role: string;
        status: string;
        token: string;
        inviter: { id: string };
      }>(res, 201);
      expect(data.email).toBe(inviteeEmail);
      expect(data.role).toBe('viewer');
      expect(data.status).toBe('pending');
      // NOTE (catalog fix): the REST payload exposes the SHA-256 HASH; the raw
      // token is delivered only via the invitation email (MailHog).
      expect(data.token).toHaveLength(64);
    });

    it('12.3 rejects a duplicate pending invitation → 422 INVITATION_ALREADY_SENT', async () => {
      const inviteeEmail = uniqueLocalEmail('invite-dup');
      await inviteMember(app, actors.admin, workspace.id, inviteeEmail, 'viewer');
      const res = await req(app.app.getHttpServer())
        .post(`/api/workspaces/${workspace.id}/invitations`)
        .set('Authorization', `Bearer ${actors.admin.accessToken}`)
        .send({ email: inviteeEmail, role: 'viewer' });
      expectError(res, 422, 'INVITATION_ALREADY_SENT');
    });

    it('12.2 rejects inviting an existing member email → 422 ALREADY_A_MEMBER', async () => {
      const res = await req(app.app.getHttpServer())
        .post(`/api/workspaces/${workspace.id}/invitations`)
        .set('Authorization', `Bearer ${actors.admin.accessToken}`)
        .send({ email: actors.viewer.email, role: 'viewer' });
      expectError(res, 422, 'ALREADY_A_MEMBER');
    });

    it('12.x RBAC: non-members cannot invite → 403 FORBIDDEN', async () => {
      const res = await req(app.app.getHttpServer())
        .post(`/api/workspaces/${workspace.id}/invitations`)
        .set('Authorization', `Bearer ${actors.outsider.accessToken}`)
        .send({ email: uniqueLocalEmail('nope'), role: 'viewer' });
      expectError(res, 403, 'FORBIDDEN');
    });

    it('13.1 lists pending invitations for admins', async () => {
      const res = await req(app.app.getHttpServer())
        .get(`/api/workspaces/${workspace.id}/invitations`)
        .set('Authorization', `Bearer ${actors.admin.accessToken}`);
      const data = expectData<Array<{ id: string; email: string }>>(res, 200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('§14 Accept invitation', () => {
    it('14.1 accepts via the RAW token from the invitation email (MailHog) and grants the role', async () => {
      const invitee = await registerUser(app, 'accepter');
      await inviteMember(app, actors.admin, workspace.id, invitee.email, 'member');
      const token = await getInvitationToken(invitee.email);

      const res = await acceptInvitation(app, invitee, token);
      const data = expectData<{ role: string; userId: string }>(res, 200);
      expect(data.role).toBe('member');
      expect(data.userId).toBe(invitee.id);
    });

    it('14.2 rejects a token addressed to a different email → 422 INVITATION_EMAIL_MISMATCH', async () => {
      const inviteeEmail = uniqueLocalEmail('mismatch-target');
      await inviteMember(app, actors.admin, workspace.id, inviteeEmail, 'viewer');
      const token = await getInvitationToken(inviteeEmail);

      const wrongUser = await registerUser(app, 'mismatch-actor');
      const res = await acceptInvitation(app, wrongUser, token);
      expectError(res, 422, 'INVITATION_EMAIL_MISMATCH');
    });

    it('14.3 rejects an unknown token → 422 INVITATION_EXPIRED', async () => {
      const wrongUser = await registerUser(app, 'invalid-token');
      const res = await acceptInvitation(app, wrongUser, 'deadbeef'.repeat(8));
      expectError(res, 422, 'INVITATION_EXPIRED');
    });

    it('14.4 replays a consumed token → 422 INVITATION_EXPIRED (single use)', async () => {
      const invitee = await registerUser(app, 'replay');
      await inviteMember(app, actors.admin, workspace.id, invitee.email, 'viewer');
      const token = await getInvitationToken(invitee.email);
      expectData(await acceptInvitation(app, invitee, token), 200);

      const replay = await acceptInvitation(app, invitee, token);
      expectError(replay, 422, 'INVITATION_EXPIRED');
    });
  });

  describe('§15 Revoke invitation', () => {
    it('15.1 revokes a pending invitation; the emailed raw token then fails → 422 INVITATION_EXPIRED', async () => {
      const invitee = await registerUser(app, 'revokee');
      const invitation = await inviteMember(
        app,
        actors.admin,
        workspace.id,
        invitee.email,
        'viewer',
      );

      const res = await req(app.app.getHttpServer())
        .delete(`/api/workspaces/${workspace.id}/invitations/${invitation.id}`)
        .set('Authorization', `Bearer ${actors.admin.accessToken}`);
      expect(res.status).toBe(204);

      const rawToken = await getInvitationToken(invitee.email);
      const accept = await acceptInvitation(app, invitee, rawToken);
      expectError(accept, 422, 'INVITATION_EXPIRED');
    });

    it('15.2 returns 404 for an unknown invitation id', async () => {
      const res = await req(app.app.getHttpServer())
        .delete(
          `/api/workspaces/${workspace.id}/invitations/00000000-0000-4000-8000-000000000000`,
        )
        .set('Authorization', `Bearer ${actors.admin.accessToken}`);
      expectError(res, 404, 'WORKSPACEINVITATION_NOT_FOUND');
    });
  });

  /** Local helper — unique e2e address that is NOT registered as a user. */
  function uniqueLocalEmail(label: string): string {
    return `e2e-${Date.now()}-${label}@t.local`;
  }
});
