-- ============================================================
-- CUSTOM INDEXES (partial + GIN) — Prisma cannot express these.
--
-- Applied manually via:
--   docker exec -i pg psql -U postgres -d syncboard < prisma/custom-indexes.sql
--
-- NOTE: re-run this file after any `npx prisma db push` — Prisma does not
-- know about these indexes and may drop them when syncing schema state.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- Workspaces: owner lookup for ACTIVE workspaces only
DROP INDEX IF EXISTS idx_workspaces_owner;
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id) WHERE archived_at IS NULL;

-- Boards: workspace listing for ACTIVE boards only
CREATE INDEX IF NOT EXISTS idx_boards_workspace ON boards(workspace_id) WHERE archived_at IS NULL;

-- Lists: ordered active lists per board
CREATE INDEX IF NOT EXISTS idx_lists_board_rank ON lists(board_id, rank) WHERE archived_at IS NULL;

-- Cards: ordered active cards per list
CREATE INDEX IF NOT EXISTS idx_cards_list_rank ON cards(list_id, rank) WHERE archived_at IS NULL;

-- Cards: GIN index for JSONB description search
CREATE INDEX IF NOT EXISTS idx_cards_description_gin ON cards USING GIN(description jsonb_path_ops);

-- Cards: overdue finder
CREATE INDEX IF NOT EXISTS idx_cards_due_date ON cards(due_date)
    WHERE due_date IS NOT NULL AND is_complete = false AND archived_at IS NULL;

-- Comments: active comments per card
CREATE INDEX IF NOT EXISTS idx_comments_card ON card_comments(card_id) WHERE deleted_at IS NULL;

-- Invitations: pending invites by email (signup auto-join path)
CREATE INDEX IF NOT EXISTS idx_invitations_email_pending ON workspace_invitations(email, status) WHERE status = 'pending';

-- Refresh tokens: reuse-detection family revocation (active sessions)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_active ON refresh_tokens(family_id) WHERE revoked_at IS NULL;
