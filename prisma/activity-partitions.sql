-- ============================================================
-- ACTIVITY (unified) — monthly RANGE partitions over created_at.
--
-- Prisma model: `Activity` @@map("activity_events").
-- Physical table stays `activity_events` so existing partitions
-- (activity_events_YYYY_MM), indexes and the
-- `ensure_activity_partitions()` helper keep working after the
-- Old `activities` / New `Activity` unification.
--
-- Apply AFTER `npx prisma db push` (fresh DB: push creates a plain
-- table, this script converts it to partitioned):
--   docker exec -i syncboard-postgres psql -U syncuser -d syncboard < prisma/activity-partitions.sql
--
-- Idempotent: safe to run multiple times. Also one-time migrates:
--   1. legacy `activities` rows (old board-only audit table) -> payload JSONB
--   2. drops the old `activities` table once backfilled
--   3. drops the interim `legacy_id` column / index (UUID-cursor compat)
-- ============================================================
BEGIN;
SET LOCAL TIME ZONE 'UTC';
SELECT pg_advisory_xact_lock(6062026);

-- 1. If push created a PLAIN activity_events table, replace it with the
--    partitioned one (only safe when empty; otherwise abort loudly).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('public.activity_events') AND relkind <> 'p') THEN
    IF (SELECT count(*) FROM public.activity_events) = 0 THEN
      DROP TABLE public.activity_events CASCADE;
    ELSE
      RAISE EXCEPTION 'activity_events must be created as a partitioned table before prisma db push';
    END IF;
  END IF;
END $$;

-- 2. Canonical partitioned table for the unified Activity model.
--    NOTE: no legacy_id — composite cursor (created_at, id) is the only
--    pagination path now.
CREATE TABLE IF NOT EXISTS public.activity_events (
  id BIGSERIAL NOT NULL,
  workspace_id UUID NOT NULL,
  board_id UUID,
  entity_type public.entity_type NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_id UUID NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 3. Drop the interim UUID-cursor compat column/index when upgrading
--    from the interim ActivityEvent version of the table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_events'
      AND column_name = 'legacy_id'
  ) THEN
    ALTER TABLE public.activity_events DROP COLUMN legacy_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE oid = to_regclass('public.idx_activity_legacy')
  ) THEN
    DROP INDEX public.idx_activity_legacy;
  END IF;
END $$;

-- 4. Partition upkeep: covers last month .. next 2 months, extended to
--    the min/max month found in either the new table or the old
--    `activities` table when it still exists (pre-migration).
CREATE OR REPLACE FUNCTION public.ensure_activity_partitions() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  first_month DATE;
  last_month DATE;
  month_date DATE;
BEGIN
  PERFORM pg_advisory_xact_lock(6062026);
  first_month := (date_trunc('month', now() AT TIME ZONE 'UTC') - INTERVAL '1 month')::date;
  last_month := (date_trunc('month', now() AT TIME ZONE 'UTC') + INTERVAL '2 months')::date;
  IF to_regclass('public.activity_events') IS NOT NULL THEN
    EXECUTE 'SELECT LEAST($1, date_trunc(''month'', min(created_at) AT TIME ZONE ''UTC'')::date), GREATEST($2, date_trunc(''month'', max(created_at) AT TIME ZONE ''UTC'')::date) FROM public.activity_events'
      INTO first_month, last_month USING first_month, last_month;
  END IF;
  IF to_regclass('public.activities') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT LEAST($1, date_trunc(''month'', min(created_at) AT TIME ZONE ''UTC'')::date), GREATEST($2, date_trunc(''month'', max(created_at) AT TIME ZONE ''UTC'')::date) FROM public.activities'
        INTO first_month, last_month USING first_month, last_month;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      -- old table already dropped / unexpected shape: ignore
    END;
  END IF;
  month_date := first_month;
  WHILE month_date <= last_month LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.activity_events FOR VALUES FROM (%L) TO (%L)',
      'activity_events_' || to_char(month_date, 'YYYY_MM'),
      month_date::timestamp AT TIME ZONE 'UTC',
      (month_date + INTERVAL '1 month')::timestamp AT TIME ZONE 'UTC'
    );
    month_date := (month_date + INTERVAL '1 month')::date;
  END LOOP;
END $$;

SELECT public.ensure_activity_partitions();
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON public.activity_events (workspace_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_board ON public.activity_events (workspace_id, board_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_actor_workspace ON public.activity_events (workspace_id, actor_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON public.activity_events (entity_type, entity_id, created_at DESC, id DESC);

-- 5. One-time backfill: old board-only `activities` rows -> unified payload.
--    Old columns (entityTitle/from_list_id/to_list_id/details) fold into
--    the extensible JSONB payload. Rows that cannot be workspace-scoped
--    (orphan board + non-document entity) are skipped.
DO $$
DECLARE
  migrated_count BIGINT := 0;
BEGIN
  IF to_regclass('public.activities') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activities'
      AND column_name = 'user_id'
  ) THEN RETURN; END IF;
  LOCK TABLE public.activities IN SHARE MODE;
  INSERT INTO public.activity_events
    (workspace_id, board_id, entity_type, entity_id, action, actor_id, payload, created_at)
  SELECT COALESCE(b.workspace_id, d.workspace_id), a.board_id,
    a.entity_type, a.entity_id, a.action::text, a.user_id,
    jsonb_build_object('entityTitle', a."entityTitle", 'fromListId', a.from_list_id, 'toListId', a.to_list_id, 'details', a.details),
    a.created_at
  FROM public.activities a
  LEFT JOIN public.boards b ON b.id = a.board_id
  LEFT JOIN public.documents d ON d.id = a.entity_id AND a.entity_type::text = 'document'
  WHERE COALESCE(b.workspace_id, d.workspace_id) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.activity_events ae
      WHERE ae.workspace_id = COALESCE(b.workspace_id, d.workspace_id)
        AND ae.board_id IS NOT DISTINCT FROM a.board_id
        AND ae.entity_type = a.entity_type
        AND ae.entity_id = a.entity_id
        AND ae.action = a.action::text
        AND ae.actor_id = a.user_id
        AND ae.created_at = a.created_at
    );
  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  RAISE NOTICE 'Activity migration: % rows backfilled from activities', migrated_count;
END $$;

-- 6. Drop the old table once every workspace-scoped row is migrated.
--    Orphan rows (no workspace) are intentionally left behind -> abort
--    loudly instead of silently losing them.
DO $$
DECLARE
  remaining BIGINT;
BEGIN
  IF to_regclass('public.activities') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activities'
      AND column_name = 'user_id'
  ) THEN RETURN; END IF;
  SELECT count(*) INTO remaining FROM public.activities a
  LEFT JOIN public.boards b ON b.id = a.board_id
  LEFT JOIN public.documents d ON d.id = a.entity_id AND a.entity_type::text = 'document'
  WHERE COALESCE(b.workspace_id, d.workspace_id) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.activity_events ae
      WHERE ae.workspace_id = COALESCE(b.workspace_id, d.workspace_id)
        AND ae.board_id IS NOT DISTINCT FROM a.board_id
        AND ae.entity_type = a.entity_type
        AND ae.entity_id = a.entity_id
        AND ae.action = a.action::text
        AND ae.actor_id = a.user_id
        AND ae.created_at = a.created_at
    );
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'Activity backfill failed: % workspace-scoped rows not migrated; old activities table kept', remaining;
  END IF;
  DROP TABLE public.activities CASCADE;
  RAISE NOTICE 'Activity migration: old activities table dropped';
END $$;
COMMIT;
