-- ============================================================
-- ACTIVITY — monthly RANGE partitions over created_at.
--
-- Prisma model: `Activity` @@map("activities").
-- Single unified table: workspace-scoped, JSONB payload, composite
-- cursor (created_at, id). Data loss on re-apply is accepted.
--
-- Run order: apply AFTER `npx prisma db push` (push creates `activities`
-- as a plain table; this script replaces it with the partitioned one):
--   docker exec -i syncboard-postgres psql -U syncuser -d syncboard < prisma/activity-partitions.sql
-- CI applies this automatically (see `.github/workflows/test.yml`).
--
-- Idempotent: safe to run multiple times.
-- ============================================================

-- Everything below runs in one transaction so a failure leaves the
-- previous table, partitions and function untouched.
BEGIN;

-- Month boundaries below are computed in UTC; forcing the session time
-- zone keeps partition ranges stable regardless of server locale.
SET LOCAL TIME ZONE 'UTC';

-- Serialize concurrent applies (CI push, app boot, daily cron) so two
-- processes never CREATE the same monthly partition at once.
SELECT pg_advisory_xact_lock(6062026);

-- Fresh start: drop the interim `activity_events` table from the previous
-- iteration and any plain `activities` table created by `prisma db push`.
-- CASCADE also removes their monthly partitions and indexes.
DROP TABLE IF EXISTS public.activity_events CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;

-- Canonical partitioned table. Notes on the shape:
--   * BIGSERIAL id gives a monotonic, roughly time-ordered key used as the
--     tiebreaker in the composite (created_at, id) pagination cursor.
--   * PRIMARY KEY must include the partition key (created_at) — a Postgres
--     requirement for partitioned tables.
--   * board_id is nullable: workspace-level events (invites, role changes)
--     have no board; boardId filters simply ignore NULL rows.
--   * payload/metadata are JSONB so new event kinds (priority, status, time
--     logs, checklists) need no schema change.
--   * No foreign keys by design: partition pruning and bulk retention drops
--     stay cheap; workspace/board membership is enforced at the API layer.
CREATE TABLE public.activities (
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

-- Partition upkeep helper, also called daily by `ActivityPartitionTask`
-- (04:00 UTC) and after seeding. Keeps a rolling window of monthly
-- partitions: previous month .. two months ahead, stretched to cover the
-- oldest/newest rows when backfilled data spans a wider range.
-- Partition naming: activities_YYYY_MM (e.g. activities_2026_09).
CREATE OR REPLACE FUNCTION public.ensure_activity_partitions() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  first_month DATE;
  last_month DATE;
  month_date DATE;
BEGIN
  -- Re-acquire the lock: the function also runs outside this script
  -- (cron/seed) where the session-level lock above is not held.
  PERFORM pg_advisory_xact_lock(6062026);
  first_month := (date_trunc('month', now() AT TIME ZONE 'UTC') - INTERVAL '1 month')::date;
  last_month := (date_trunc('month', now() AT TIME ZONE 'UTC') + INTERVAL '2 months')::date;
  IF to_regclass('public.activities') IS NOT NULL THEN
    EXECUTE 'SELECT LEAST($1, date_trunc(''month'', min(created_at) AT TIME ZONE ''UTC'')::date), GREATEST($2, date_trunc(''month'', max(created_at) AT TIME ZONE ''UTC'')::date) FROM public.activities'
      INTO first_month, last_month USING first_month, last_month;
  END IF;
  month_date := first_month;
  WHILE month_date <= last_month LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.activities FOR VALUES FROM (%L) TO (%L)',
      'activities_' || to_char(month_date, 'YYYY_MM'),
      month_date::timestamp AT TIME ZONE 'UTC',
      (month_date + INTERVAL '1 month')::timestamp AT TIME ZONE 'UTC'
    );
    month_date := (month_date + INTERVAL '1 month')::date;
  END LOOP;
END $$;

-- Materialize the current window immediately so the first insert never
-- hits a missing-partition error.
SELECT public.ensure_activity_partitions();

-- One composite index per feed query pattern (all newest-first, matching
-- ORDER BY created_at DESC, id DESC):
--   workspace feed, board feed, per-actor feed, per-entity history.
-- Retention is a metadata-only DROP TABLE activities_YYYY_MM per month.
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON public.activities (workspace_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_board ON public.activities (workspace_id, board_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_actor_workspace ON public.activities (workspace_id, actor_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON public.activities (entity_type, entity_id, created_at DESC, id DESC);
COMMIT;
