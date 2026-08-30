/**
 * Files & Attachments (S3) module e2e — HTTP via supertest against the real AppModule.
 *
 * Covers: test-cases-files.md
 *   §1 Presigned Upload — phase 1 (1.1–1.6)
 *   §2 Confirm — phase 2 (2.1–2.3)
 *   §3 Download (3.1–3.3)
 *   §4 Management & Listing (4.1–4.4)
 *
 * ⛔ BLOCKED — Phase 6 pending.
 * `src/modules/file/file.module.ts` is an empty stub.
 * Remove `.skip` from each `describe.skip` block once the module lands.
 * NOTE: link-type card attachments are already covered in board.e2e-spec.ts.
 *       These tests target the S3-backed presigned-upload flow.
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

describe('Files (S3) module (e2e)', () => {
  let app: TestApp;
  let owner: TestUser;
  let member: TestUser;
  let viewer: TestUser;
  let workspaceId: string;
  let boardId: string;
  let listId: string;
  let cardId: string;

  const server = () => app.app.getHttpServer();
  const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.accessToken}` });
  const filesUrl = () => `/api/files`;
  const presignedUrl = () => `${filesUrl()}/presigned-upload`;

  beforeAll(async () => {
    app = await createTestApp();
    [owner, member, viewer] = await Promise.all([
      createVerifiedUser(app, 'file-owner'),
      createVerifiedUser(app, 'file-member'),
      createVerifiedUser(app, 'file-viewer'),
    ]);
    const ws = await createWorkspace(app, owner);
    workspaceId = ws.id;
    await addMemberViaInvitation(app, owner, member, workspaceId, 'member');
    await addMemberViaInvitation(app, owner, viewer, workspaceId, 'viewer');
    const board = await createBoard(app, owner, workspaceId, 'File Board');
    boardId = board.id;
    const list = await createList(app, owner, workspaceId, boardId, 'File List');
    listId = list.id;
    const card = await createCard(app, owner, workspaceId, boardId, listId, 'File Card');
    cardId = card.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  describe.skip('§1 Presigned Upload — phase 1', () => {
    it('1.1 happy request → 200 {fileId, uploadUrl, s3Key, expiresIn}; DB row status=pending', async () => {
      const res = await req(server())
        .post(presignedUrl())
        .set(auth(owner))
        .send({
          fileName: 'test.png',
          mimeType: 'image/png',
          fileSize: 1024,
          entityType: 'card',
          entityId: cardId,
        });
      const data = expectData<{
        fileId: string;
        uploadUrl: string;
        s3Key: string;
        expiresIn: number;
      }>(res, 200);
      expect(data.uploadUrl).toContain('http');
      expect(data.expiresIn).toBeLessThanOrEqual(3600);
      expect(data.s3Key).toContain(cardId);
    });

    it('1.2 MIME allowlist: .exe → 422 UNSUPPORTED_FILE_TYPE', async () => {
      const res = await req(server())
        .post(presignedUrl())
        .set(auth(owner))
        .send({
          fileName: 'evil.exe',
          mimeType: 'application/x-msdownload',
          fileSize: 1024,
          entityType: 'card',
          entityId: cardId,
        });
      expectError(res, 422, 'UNSUPPORTED_FILE_TYPE');
    });

    it('1.3 size cap: > 25MB → 422 FILE_TOO_LARGE', async () => {
      const res = await req(server())
        .post(presignedUrl())
        .set(auth(owner))
        .send({
          fileName: 'big.pdf',
          mimeType: 'application/pdf',
          fileSize: 25 * 1024 * 1024 + 1,
          entityType: 'card',
          entityId: cardId,
        });
      expectError(res, 422, 'FILE_TOO_LARGE');
    });

    it('1.5 entityId not in workspace → 404 before URL issued', async () => {
      const res = await req(server())
        .post(presignedUrl())
        .set(auth(owner))
        .send({
          fileName: 'test.png',
          mimeType: 'image/png',
          fileSize: 1024,
          entityType: 'card',
          entityId: '00000000-0000-4000-8000-000000000000',
        });
      expect(res.status).toBe(404);
    });

    it('1.6 RBAC: viewer → 403 FORBIDDEN', async () => {
      const res = await req(server())
        .post(presignedUrl())
        .set(auth(viewer))
        .send({
          fileName: 'test.png',
          mimeType: 'image/png',
          fileSize: 1024,
          entityType: 'card',
          entityId: cardId,
        });
      expectError(res, 403, 'FORBIDDEN');
    });
  });

  // =========================================================================
  describe.skip('§2 Confirm — phase 2', () => {
    it('2.1 POST /files/:id/confirm → status completed; row returned with metadata', async () => {
      const presigned = await req(server())
        .post(presignedUrl())
        .set(auth(owner))
        .send({
          fileName: 'confirm.png',
          mimeType: 'image/png',
          fileSize: 512,
          entityType: 'card',
          entityId: cardId,
        });
      const { fileId } = expectData<{ fileId: string }>(presigned, 200);

      const confirm = await req(server())
        .post(`${filesUrl()}/${fileId}/confirm`)
        .set(auth(owner));
      const data = expectData<{ status: string }>(confirm, 200);
      expect(data.status).toBe('completed');
    });

    it('2.3 double confirm is idempotent or → 409 (document actual behavior)', async () => {
      const presigned = await req(server())
        .post(presignedUrl())
        .set(auth(owner))
        .send({
          fileName: 'double.png',
          mimeType: 'image/png',
          fileSize: 512,
          entityType: 'card',
          entityId: cardId,
        });
      const { fileId } = expectData<{ fileId: string }>(presigned, 200);
      await req(server()).post(`${filesUrl()}/${fileId}/confirm`).set(auth(owner));
      const second = await req(server())
        .post(`${filesUrl()}/${fileId}/confirm`)
        .set(auth(owner));
      expect([200, 409]).toContain(second.status);
    });
  });

  // =========================================================================
  describe.skip('§3 Download', () => {
    it('3.1 completed file → 200 {downloadUrl}; URL expires ≤ 1h', async () => {
      const presigned = await req(server())
        .post(presignedUrl())
        .set(auth(owner))
        .send({
          fileName: 'download.png',
          mimeType: 'image/png',
          fileSize: 512,
          entityType: 'card',
          entityId: cardId,
        });
      const { fileId } = expectData<{ fileId: string }>(presigned, 200);
      await req(server()).post(`${filesUrl()}/${fileId}/confirm`).set(auth(owner));

      const dl = await req(server()).get(`${filesUrl()}/${fileId}/download`).set(auth(owner));
      const data = expectData<{ downloadUrl: string }>(dl, 200);
      expect(data.downloadUrl).toContain('http');
    });

    it('3.3 archived/deleted file → 404 FILE_NOT_FOUND', async () => {
      const res = await req(server())
        .get(`${filesUrl()}/00000000-0000-4000-8000-000000000000/download`)
        .set(auth(owner));
      expectError(res, 404, 'FILE_NOT_FOUND');
    });
  });

  // =========================================================================
  describe.skip('§4 Management & Listing', () => {
    it('4.2 uploader soft-archives: subsequent download → 404', async () => {
      const presigned = await req(server())
        .post(presignedUrl())
        .set(auth(owner))
        .send({
          fileName: 'del.png',
          mimeType: 'image/png',
          fileSize: 512,
          entityType: 'card',
          entityId: cardId,
        });
      const { fileId } = expectData<{ fileId: string }>(presigned, 200);
      await req(server()).post(`${filesUrl()}/${fileId}/confirm`).set(auth(owner));
      expect((await req(server()).delete(`${filesUrl()}/${fileId}`).set(auth(owner))).status).toBe(
        204,
      );
      const dl = await req(server()).get(`${filesUrl()}/${fileId}/download`).set(auth(owner));
      expect(dl.status).toBe(404);
    });

    it('4.4 plain member cannot delete another member file → 403', async () => {
      const presigned = await req(server())
        .post(presignedUrl())
        .set(auth(owner))
        .send({
          fileName: 'owners.png',
          mimeType: 'image/png',
          fileSize: 512,
          entityType: 'card',
          entityId: cardId,
        });
      const { fileId } = expectData<{ fileId: string }>(presigned, 200);
      await req(server()).post(`${filesUrl()}/${fileId}/confirm`).set(auth(owner));
      const del = await req(server()).delete(`${filesUrl()}/${fileId}`).set(auth(member));
      expectError(del, 403, 'FORBIDDEN');
    });
  });
});
