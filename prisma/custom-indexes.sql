-- ============================================================
-- CUSTOM INDEXES (partial + GIN) — Prisma cannot express these.
--
-- Applied manually via:
--   docker exec -i syncboard-postgres psql -U syncuser -d syncboard < prisma/custom-indexes.sql
--
-- NOTE: re-run this file after any `npx prisma db push` — Prisma does not
-- know about these indexes and may drop them when syncing schema state.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- Users: Google OAuth provider lookup
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- Workspaces: owner lookup for ACTIVE workspaces only
DROP INDEX IF EXISTS idx_workspaces_owner;
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id) WHERE archived_at IS NULL;

-- Boards: workspace listing for ACTIVE boards only (excludes archived & deleted)
DROP INDEX IF EXISTS idx_boards_workspace;
CREATE INDEX IF NOT EXISTS idx_boards_workspace ON boards(workspace_id) WHERE archived_at IS NULL AND deleted_at IS NULL;

-- Lists: ordered active lists per board (excludes archived & deleted)
DROP INDEX IF EXISTS idx_lists_board_rank;
CREATE INDEX IF NOT EXISTS idx_lists_board_rank ON lists(board_id, rank) WHERE archived_at IS NULL AND deleted_at IS NULL;

-- Cards: ordered active cards per list (excludes archived & deleted)
DROP INDEX IF EXISTS idx_cards_list_rank;
CREATE INDEX IF NOT EXISTS idx_cards_list_rank ON cards(list_id, rank) WHERE archived_at IS NULL AND deleted_at IS NULL;

-- Cards: GIN index for JSONB description search
CREATE INDEX IF NOT EXISTS idx_cards_description_gin ON cards USING GIN(description jsonb_path_ops);

-- Cards: overdue finder (excludes archived & deleted, incomplete only)
DROP INDEX IF EXISTS idx_cards_due_date;
CREATE INDEX IF NOT EXISTS idx_cards_due_date ON cards(due_date)
    WHERE due_date IS NOT NULL AND is_complete = false AND archived_at IS NULL AND deleted_at IS NULL;

-- Boards: archived listing (paginated Archive tab)
DROP INDEX IF EXISTS idx_boards_archived;
CREATE INDEX IF NOT EXISTS idx_boards_archived ON boards(workspace_id, archived_at DESC, id DESC)
    WHERE archived_at IS NOT NULL AND deleted_at IS NULL;

-- Lists: archived listing per board
DROP INDEX IF EXISTS idx_lists_archived;
CREATE INDEX IF NOT EXISTS idx_lists_archived ON lists(board_id, archived_at DESC, id DESC)
    WHERE archived_at IS NOT NULL AND deleted_at IS NULL;

-- Cards: archived listing per board (via list)
DROP INDEX IF EXISTS idx_cards_archived;
CREATE INDEX IF NOT EXISTS idx_cards_archived ON cards(archived_at DESC, id DESC)
    WHERE archived_at IS NOT NULL AND deleted_at IS NULL;

-- Boards: deleted (not listed, for completeness)
DROP INDEX IF EXISTS idx_boards_deleted;
CREATE INDEX IF NOT EXISTS idx_boards_deleted ON boards(workspace_id, deleted_at DESC)
    WHERE deleted_at IS NOT NULL;

-- Cards: deleted (not listed)
DROP INDEX IF EXISTS idx_cards_deleted;
CREATE INDEX IF NOT EXISTS idx_cards_deleted ON cards(deleted_at DESC, id DESC)
    WHERE deleted_at IS NOT NULL;

-- Comments: active comments per card
DROP INDEX IF EXISTS idx_comments_card;
CREATE INDEX IF NOT EXISTS idx_comments_card ON card_comments(card_id) WHERE deleted_at IS NULL;

-- Invitations: pending invites by email (signup auto-join path)
DROP INDEX IF EXISTS idx_invitations_email_pending;
CREATE INDEX IF NOT EXISTS idx_invitations_email_pending ON workspace_invitations(email, status) WHERE status = 'pending';

-- Refresh tokens: reuse-detection family revocation (active sessions)
DROP INDEX IF EXISTS idx_refresh_tokens_family_active;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_active ON refresh_tokens(family_id) WHERE revoked_at IS NULL;

-- Documents: GIN index for preview full-text search
CREATE INDEX IF NOT EXISTS idx_documents_preview_fts ON documents
  USING GIN(to_tsvector('english', COALESCE(preview_text, '')));

-- Documents: active documents linked to cards
DROP INDEX IF EXISTS idx_documents_parent_card;
CREATE INDEX IF NOT EXISTS idx_documents_parent_card ON documents(parent_card_id)
  WHERE parent_card_id IS NOT NULL AND status = 'active';
