-- ============================================================
-- ACTIVITY — monthly RANGE partitions over created_at.
-- Prisma model `Activity` @@map("activities").
-- Apply AFTER `npx prisma db push`. Idempotent, data loss accepted.
-- ============================================================
BEGIN;
SET LOCAL TIME ZONE 'UTC';
SELECT pg_advisory_xact_lock(6062026);

-- Start clean: drop the plain table from db push.
DROP TABLE IF EXISTS public.activities CASCADE;

-- Partitioned audit log. Composite PK must include the partition key;
-- nullable board_id for workspace-level events; JSONB payload, no FKs.
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

-- Upkeep helper: keeps a rolling window (prev month .. +2 months) of
-- activities_YYYY_MM partitions. Also called by the daily cron and seeding.
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

-- Build the current window now so the first insert never fails.
SELECT public.ensure_activity_partitions();

-- One newest-first index per feed query: workspace / board / actor / entity.
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON public.activities (workspace_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_board ON public.activities (workspace_id, board_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_actor_workspace ON public.activities (workspace_id, actor_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON public.activities (entity_type, entity_id, created_at DESC, id DESC);
COMMIT;
