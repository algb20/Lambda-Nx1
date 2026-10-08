-- ============================================================================
-- QUARANTINE stored findings from The Gazette  (reversible — see
-- gazette-personal-restore.sql).  NOT EXECUTED: a write to a live database
-- needs the owner's explicit authorisation for this action (CLAUDE.md §9;
-- docs/reconciliation/PENDING_OWNER_ITEMS.md item E1).
--
-- ## Why (batch 13, R321)
--
-- Before commit acd8c97 the `uk_gazette` source turned every Gazette notice
-- into a finding, including bankruptcy orders (25xx) and deceased estates
-- (29xx) whose headline is a private individual's name. That conflicts with
-- charter §3, and the Gazette's OGL "does not cover the re-use of personal
-- data". The notice code is not stored with a finding, so personal and
-- company notices cannot be told apart in the database. Every stored Gazette
-- finding is therefore set aside. The company notices come back by
-- themselves on the next runs, through the fixed source.
--
-- ## What moves
--
--   * evidence       rows whose source_key = 'uk_gazette' or whose
--                    source_url is a Gazette notice
--   * radar_findings rows whose feed = 'uk_gazette' or whose source_url is a
--                    Gazette notice
--   * posts          system-published rows only (author_user_id IS NULL) with
--                    a Gazette source_url. A post a person wrote is theirs and
--                    is only counted (see the report at the end), never moved.
--
-- Rows are copied into schema lambda_quarantine, then deleted from public, in
-- one transaction. Nothing is destroyed; the restore script puts them back.
--
-- ## When
--
-- Production runs 9c19303, which predates the fix, so it keeps producing such
-- rows until a deploy carrying acd8c97 (paused, R294/R306). Run this after
-- that deploy, or run it again after it. It is safe to repeat: rows already
-- quarantined are skipped by primary key.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS lambda_quarantine;
COMMENT ON SCHEMA lambda_quarantine IS
  'Rows set aside pending an owner decision; not exposed to the API. See db/ops/*-quarantine.sql.';

CREATE TABLE IF NOT EXISTS lambda_quarantine.gazette_evidence (LIKE public.evidence INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS lambda_quarantine.gazette_radar_findings (LIKE public.radar_findings INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS lambda_quarantine.gazette_posts (LIKE public.posts INCLUDING DEFAULTS);

DO $$
DECLARE
  n_ev integer; n_rf integer; n_po integer; n_user_posts integer;
BEGIN
  INSERT INTO lambda_quarantine.gazette_evidence
    SELECT e.* FROM public.evidence e
    WHERE (e.source_key = 'uk_gazette' OR e.source_url LIKE 'https://www.thegazette.co.uk/notice/%')
      AND NOT EXISTS (SELECT 1 FROM lambda_quarantine.gazette_evidence q WHERE q.id = e.id);
  GET DIAGNOSTICS n_ev = ROW_COUNT;
  DELETE FROM public.evidence e USING lambda_quarantine.gazette_evidence q WHERE e.id = q.id;

  INSERT INTO lambda_quarantine.gazette_radar_findings
    SELECT r.* FROM public.radar_findings r
    WHERE (r.feed = 'uk_gazette' OR r.source_url LIKE 'https://www.thegazette.co.uk/notice/%')
      AND NOT EXISTS (SELECT 1 FROM lambda_quarantine.gazette_radar_findings q WHERE q.id = r.id);
  GET DIAGNOSTICS n_rf = ROW_COUNT;
  DELETE FROM public.radar_findings r USING lambda_quarantine.gazette_radar_findings q WHERE r.id = q.id;

  INSERT INTO lambda_quarantine.gazette_posts
    SELECT p.* FROM public.posts p
    WHERE p.author_user_id IS NULL AND p.source_url LIKE 'https://www.thegazette.co.uk/notice/%'
      AND NOT EXISTS (SELECT 1 FROM lambda_quarantine.gazette_posts q WHERE q.id = p.id);
  GET DIAGNOSTICS n_po = ROW_COUNT;
  DELETE FROM public.posts p USING lambda_quarantine.gazette_posts q WHERE p.id = q.id;

  SELECT count(*) INTO n_user_posts FROM public.posts
    WHERE author_user_id IS NOT NULL AND source_url LIKE 'https://www.thegazette.co.uk/notice/%';

  RAISE NOTICE 'quarantined: evidence %, radar_findings %, system posts %; user-written posts citing the Gazette left in place: %',
    n_ev, n_rf, n_po, n_user_posts;
END $$;

COMMIT;
