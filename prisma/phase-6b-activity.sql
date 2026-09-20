BEGIN;
SET LOCAL TIME ZONE 'UTC';
SELECT pg_advisory_xact_lock(6062026);
ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'workspace';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('public.activity_events') AND relkind <> 'p') THEN
    RAISE EXCEPTION 'activity_events must be created by this script before prisma db push';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.activity_events (
  id BIGSERIAL NOT NULL,
  legacy_id UUID NOT NULL DEFAULT gen_random_uuid(),
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
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.activity_events FOR VALUES FROM (%L) TO (%L)',
      'activity_events_' || to_char(month_date, 'YYYY_MM'),
      month_date::timestamp AT TIME ZONE 'UTC',
      (month_date + INTERVAL '1 month')::timestamp AT TIME ZONE 'UTC'
    );
    month_date := (month_date + INTERVAL '1 month')::date;
  END LOOP;
END $$;

SELECT public.ensure_activity_partitions();
CREATE INDEX IF NOT EXISTS idx_activity_legacy ON public.activity_events (legacy_id);
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON public.activity_events (workspace_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_board ON public.activity_events (workspace_id, board_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_actor_workspace ON public.activity_events (workspace_id, actor_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON public.activity_events (entity_type, entity_id, created_at DESC, id DESC);

DO $$
DECLARE
  missing_count BIGINT;
BEGIN
  IF to_regclass('public.activities') IS NULL THEN RETURN; END IF;
  LOCK TABLE public.activities IN SHARE MODE;
  INSERT INTO public.activity_events
    (legacy_id, workspace_id, board_id, entity_type, entity_id, action, actor_id, payload, created_at)
  SELECT a.id, COALESCE(b.workspace_id, d.workspace_id), a.board_id,
    a.entity_type, a.entity_id, a.action::text, a.user_id,
    jsonb_build_object('entityTitle', a."entityTitle", 'fromListId', a.from_list_id, 'toListId', a.to_list_id, 'details', a.details),
    a.created_at
  FROM public.activities a
  LEFT JOIN public.boards b ON b.id = a.board_id
  LEFT JOIN public.documents d ON d.id = a.entity_id AND a.entity_type::text = 'document'
  WHERE COALESCE(b.workspace_id, d.workspace_id) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.activity_events ae WHERE ae.legacy_id = a.id);

  SELECT count(*) INTO missing_count FROM public.activities a
  LEFT JOIN public.boards b ON b.id = a.board_id
  LEFT JOIN public.documents d ON d.id = a.entity_id AND a.entity_type::text = 'document'
  WHERE COALESCE(b.workspace_id, d.workspace_id) IS NOT NULL
    AND (SELECT count(*) FROM public.activity_events ae WHERE ae.legacy_id = a.id) <> 1;
  IF missing_count <> 0 THEN
    RAISE EXCEPTION 'Activity backfill failed: % unresolved or duplicate legacy rows; no changes committed', missing_count;
  END IF;
END $$;
COMMIT;
