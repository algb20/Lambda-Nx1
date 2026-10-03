-- ============================================================================
-- RESTORE public."L" exactly as it was before orphan-L-quarantine.sql
--
-- Reverses every step of the quarantine, in the opposite order:
--   1. table back to `public` (its identity sequence moves with it);
--   2. the `service_role` grant it had (ALL) restored;
--   3. membership of the `supabase_realtime` publication restored;
--   4. the quarantine comment cleared;
--   5. the `lambda_orphaned` schema dropped, only if nothing else is in it.
--
-- Pre-quarantine state, recorded 2026-10-03: owner postgres; RLS enabled, not
-- forced; no policies; grants postgres ALL, service_role ALL; sole member of
-- supabase_realtime; 0 rows; sequence L_id_seq last_value 1, is_called false.
-- One transaction; a second run finds nothing in quarantine and stops.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('lambda_orphaned."L"') IS NULL THEN
    RAISE NOTICE 'lambda_orphaned."L" not present — nothing to restore';
    RETURN;
  END IF;
  IF to_regclass('public."L"') IS NOT NULL THEN
    RAISE EXCEPTION 'public."L" already exists — refusing to overwrite it';
  END IF;

  EXECUTE 'ALTER TABLE lambda_orphaned."L" SET SCHEMA public';

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT ALL ON public."L" TO service_role';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public."L"';
  END IF;

  EXECUTE 'COMMENT ON TABLE public."L" IS NULL';

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'lambda_orphaned'
  ) THEN
    EXECUTE 'DROP SCHEMA lambda_orphaned';
  END IF;
END $$;

COMMIT;
