-- Phase 6C: S3-backed file attachments replacing interim card_attachments.
-- Creates file_attachments (+ attachment_status enum), backfills completed rows
-- from card_attachments via the canonical workspace join chain, then drops
-- the interim table.

-- CreateEnum
CREATE TYPE "attachment_status" AS ENUM ('pending', 'completed', 'failed');

-- CreateTable
CREATE TABLE "file_attachments" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "s3_bucket" VARCHAR(100) NOT NULL,
    "s3_key" VARCHAR(500) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "entity_type" "entity_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "status" "attachment_status" NOT NULL DEFAULT 'pending',
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_attachments_s3_key_key" ON "file_attachments"("s3_key");
CREATE INDEX "idx_attachments_entity" ON "file_attachments"("entity_type", "entity_id");
CREATE INDEX "idx_attachments_workspace" ON "file_attachments"("workspace_id");
CREATE INDEX "idx_attachments_pending_cleanup" ON "file_attachments"("status", "created_at");

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constrain generic EntityType enum to the two supported hosts at DB level
ALTER TABLE file_attachments ADD CONSTRAINT chk_attachments_entity CHECK (entity_type IN ('card', 'document'));

-- Data migration from interim table (canonical join chain)
INSERT INTO file_attachments (id, workspace_id, uploaded_by, s3_bucket, s3_key, original_name, mime_type, file_size, entity_type, entity_id, status, archived_at, created_at, updated_at)
SELECT gen_random_uuid(), ws.id, a.uploaded_by_id, 'pending-migration', 'legacy/' || a.id::text, a.name, COALESCE(a.mime_type,'application/octet-stream'), COALESCE(a.file_size,0), 'card', a.card_id, 'completed', a.archived_at, a.created_at, a.updated_at
FROM card_attachments a
JOIN cards c ON c.id = a.card_id
JOIN lists l ON l.id = c.list_id
JOIN boards b ON b.id = l.board_id
JOIN workspaces ws ON ws.id = b.workspace_id;

-- DropTable
DROP TABLE card_attachments;
