-- ============================================================================
-- RESTORE the Gazette findings set aside by gazette-personal-quarantine.sql.
-- NOT EXECUTED; owner-authorised like the quarantine itself.
--
-- Rows go back with their original ids and timestamps. An evidence row whose
-- investigation was deleted in the meantime cannot return (its foreign key
-- would fail) and stays in quarantine; the notice reports how many.
-- The quarantine tables are emptied of what was restored, never dropped.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  n_ev integer; n_rf integer; n_po integer; left_ev integer;
BEGIN
  IF to_regclass('lambda_quarantine.gazette_evidence') IS NULL THEN
    RAISE NOTICE 'no Gazette quarantine present — nothing to restore';
    RETURN;
  END IF;

  INSERT INTO public.evidence
    SELECT q.* FROM lambda_quarantine.gazette_evidence q
    WHERE EXISTS (SELECT 1 FROM public.investigations i WHERE i.id = q.investigation_id)
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS n_ev = ROW_COUNT;
  DELETE FROM lambda_quarantine.gazette_evidence q USING public.evidence e WHERE e.id = q.id;
  SELECT count(*) INTO left_ev FROM lambda_quarantine.gazette_evidence;

  INSERT INTO public.radar_findings SELECT * FROM lambda_quarantine.gazette_radar_findings ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n_rf = ROW_COUNT;
  DELETE FROM lambda_quarantine.gazette_radar_findings q USING public.radar_findings r WHERE r.id = q.id;

  INSERT INTO public.posts SELECT * FROM lambda_quarantine.gazette_posts ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS n_po = ROW_COUNT;
  DELETE FROM lambda_quarantine.gazette_posts q USING public.posts p WHERE p.id = q.id;

  RAISE NOTICE 'restored: evidence %, radar_findings %, posts %; evidence left in quarantine (investigation gone): %',
    n_ev, n_rf, n_po, left_ev;
END $$;

COMMIT;
