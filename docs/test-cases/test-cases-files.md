# Files & S3 Object Storage — Test Cases

> Covers the 2-phase presigned upload lifecycle, confirmation flow, download URLs, and attachment management.
> Environment setup: MinIO or AWS S3 sandbox bucket. Users Alice (Owner) and Bob (Member) in Workspace W; Card C1.

## 1. Presigned Upload Initiation

| # | Case | Expected |
|---|------|----------|
| 1.1 | Happy request | POST /files/presigned-upload {fileName,mimeType,fileSize,entityType:card,entityId} → 200 {fileId, uploadUrl, s3Key `workspaces/W/cards/C1/<uuid>-name`, expiresIn≤3600}; DB row status=pending |
| 1.2 | MIME allowlist | png/pdf/csv/txt/docx/xlsx ok · exe, bat, sh, svg*(policy) → 422 UNSUPPORTED_FILE_TYPE |
| 1.3 | Size cap | >25MB → 422 FILE_TOO_LARGE; boundary exactly cap passes |
| 1.4 | Key sanitization | fileName `../../evil.png` / weird unicode → key contains uuid + sanitized name, no traversal |
| 1.5 | Entity validation | entityId not a card in workspace W → 404 before URL issued |
| 1.6 | RBAC | viewer request → 403 |
| 1.7 | Actual upload | PUT bytes to uploadUrl → 200 from S3; object exists under key |

## 2. Upload Confirmation

| # | Case | Expected |
|---|------|----------|
| 2.1 | Confirm after PUT | POST /files/:id/confirm → status completed; row returned w/ metadata |
| 2.2 | Confirm without upload | still completes (metadata-only contract — document actual behavior) OR HEAD-check enforced per spec |
| 2.3 | Double confirm | idempotent success or 409 (document actual) |
| 2.4 | Ownership | Bob confirms Alice's pending row in same workspace → allowed if member policy, else 403 (match doc 03 §8 wording) |

## 3. Download

| # | Case | Expected |
|---|------|----------|
| 3.1 | Presigned GET | completed file → 200 {downloadUrl}; fetch streams original bytes; URL expires ≤1h |
| 3.2 | Pending file download | 404/422 (not completed) |
| 3.3 | Archived/deleted | 404 FILE_NOT_FOUND |

## 4. Management & Listing

| # | Case | Expected |
|---|------|----------|
| 4.1 | Card attachments list | GET /cards/C1/attachments returns completed rows only (proxy over FileService post-migration) |
| 4.2 | Delete by uploader | uploader soft-archives; subsequent list/download 404 |
| 4.3 | Delete by admin other's file | allowed |
| 4.4 | Delete by plain member other's file | 403 |
| 4.5 | Stale pending cleanup | cron marks pending >24h failed; excluded from lists |

## 5. Migration & Ops Edge

| # | Case | Expected |
|---|------|----------|
| 5.1 | Legacy migration parity | every old card_attachments row appears as file_attachments(entityType=card,status=completed); old table dropped |
| 5.2 | Bucket privacy | direct public URL to object → denied (only presigned works) |
| 5.3 | Provider failure | S3 error during presign → 502 S3_ERROR envelope; no orphan confirmed rows |
