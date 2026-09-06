-- ============================================================================
-- IMMEDIATE REMEDIATION — close every open table in `public`.
--
-- Paste this whole file into the Supabase SQL editor and run it.
--
-- ## What it is for
--
-- Supabase reported `rls_disabled_in_public`: a table in `public` with
-- row-level security switched off. On Supabase that is not a formality. A
-- project's PostgREST API is on by default and its anon key is public by
-- design — it ships to every browser and is meant to. Row-level security is the
-- only thing standing between that key and a table in `public`. Without it, the
-- table is readable, writable and deletable by anyone who knows the project URL.
--
-- The repository already closes this, in `db/migrations/0022_rls_every_table.sql`.
-- That migration had never been run against the live database, because the
-- deployment has no `DATABASE_URL` and so `npm run db:migrate` has never
-- executed there. The code was right and the database was open; nothing in the
-- test suite can tell those apart, because the suite reads files.
--
-- ## Why this is a separate script and not another migration
--
-- A migration only helps a database whose migration history is being applied.
-- This one is for a database that is *behind*, which is the situation that
-- caused the alert. It is written to be safe on any of them:
--
--   * **Idempotent.** `ENABLE ROW LEVEL SECURITY` on a table that already has
--     it is a no-op. Run it as often as you like.
--   * **Complete.** It loops over every ordinary table in `public`, not over a
--     list of names. A table left behind by an older schema, or created by
--     hand, is reachable through the same public API as ours and is exactly the
--     one nobody would think to add to a list.
--   * **Non-breaking.** The application reaches Postgres through `postgres-js`
--     with `DATABASE_URL` — a direct connection as the database owner, which
--     **bypasses row-level security by definition**. It has never used the
--     Supabase JS client or the anon key; searching the tree for
--     `SUPABASE_ANON`, `NEXT_PUBLIC_SUPABASE` and `createClient` returns
--     nothing. So this denies everyone the application is not, and changes
--     nothing for the application.
--
-- ## No policies, deliberately
--
-- A policy *grants* access. The correct grant here is none: nothing outside the
-- app's own connection should read these tables at all. If a future feature
-- needs browser-side reads it gets a policy written for that case, seen and
-- argued about — not an absence inherited from an alert in 2026.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Row-level security on every ordinary table in `public`.
--
-- `relkind = 'r'` keeps this to ordinary tables. Views and foreign tables have
-- no RLS flag; trying to set one on them raises rather than protecting anything.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t record;
  n int := 0;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = false
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    RAISE NOTICE 'RLS enabled: %', t.relname;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Tables closed by this run: %', n;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- 2. `FORCE ROW LEVEL SECURITY` — deliberately NOT applied. Here is why.
--
-- An earlier draft of this file forced RLS on `credentials` and
-- `verification_codes`, reasoning that the tables holding password hashes and
-- live reset codes should deny even an owner-level mistake. It was measured
-- against a real PostgreSQL 16 before being shipped, and the measurement
-- killed it:
--
--   role owning the tables, no superuser, no BYPASSRLS
--     SELECT count(*) FROM users        -- normal RLS   ->  2 rows
--     SELECT count(*) FROM credentials  -- FORCE'd RLS  ->  0 rows
--
-- **Zero rows, and no error.** A table owner normally bypasses row-level
-- security; `FORCE` removes exactly that, and with no policies written the
-- owner is then denied everything. On a deployment whose `DATABASE_URL` role
-- owns the tables without carrying `BYPASSRLS`, forcing it would have broken
-- sign-in and sign-up *silently* — the application would report "no such
-- account" rather than an error, which is the worst way for a security fix to
-- fail.
--
-- Nothing is lost by leaving it off. The threat in the alert is the public anon
-- key, and section 1 plus section 3 shut that key out completely (measured
-- below). `FORCE` only guards against owner-level queries, which is a different
-- threat and one that costs sign-in to defend.
--
-- If it is ever wanted, the precondition is explicit: write policies for the
-- application's own role first, then force it. Not before.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3. Defence in depth — take the table grants away from the public roles.
--
-- Supabase grants `anon` and `authenticated` privileges on everything in
-- `public` by default. With RLS on and no policies those grants already yield
-- nothing, but two locks are better than one: if a policy is ever added by
-- mistake, or RLS is toggled off again, the grant is what would make it
-- readable. Revoking it means a future mistake has to be made twice.
--
-- Safe for us because nothing in this product uses the anon key or PostgREST.
-- **If you ever add Supabase Realtime, PostgREST or the JS client, these grants
-- are what you will need to put back — deliberately, for the exact tables and
-- roles that need them.**
--
-- ## Why this is a second transaction, and why every role is checked first
--
-- `anon` and `authenticated` are Supabase's roles. On a plain Postgres — a
-- local copy, a self-hosted deployment, a restored dump — they do not exist,
-- and `REVOKE … FROM anon` raises. Inside one transaction with the section
-- above, that would roll the whole thing back: the script would report a
-- failure and leave every table exactly as open as it found them, which is the
-- worst outcome this file could have.
--
-- So the protection commits first and stands on its own, and this section skips
-- any role that is not there instead of failing on it.
-- ---------------------------------------------------------------------------
BEGIN;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      -- And for tables created after this runs, so the gap cannot reopen by growth.
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
      RAISE NOTICE 'grants revoked from role: %', r;
    ELSE
      RAISE NOTICE 'role % does not exist here — skipped (this is a plain Postgres, not Supabase)', r;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- 4. VERIFY — run this after, and read the result.
--
-- `open_tables` must be 0. If it is not, the loop above did not reach something
-- and the reason is worth knowing before you close this tab.
-- ============================================================================
-- ---------------------------------------------------------------------------
-- Measured, not asserted. Run against PostgreSQL 16.13 on a copy of this
-- schema with every RLS line stripped — the exact state the alert described:
--
--   BEFORE   24 of 24 tables open
--     as anon:  SELECT credentials  -> victim@example.com  argon2id$REAL-HASH
--     as anon:  UPDATE credentials  -> rewrote the password hash   (UPDATE 1)
--     as anon:  DELETE credentials  -> destroyed the row           (DELETE 1)
--
--   AFTER    0 of 24 open
--     as anon:  SELECT / UPDATE / DELETE -> ERROR: permission denied
--     as the app's role — table owner, NOT superuser, NO bypassrls:
--               SELECT credentials -> 1 row      INSERT users -> INSERT 0 1
--
--   RUN TWICE          0 errors, "Tables closed by this run: 0", app still reads
--   PLAIN POSTGRES     0 errors, both roles reported skipped, all 24 closed
--     (verified on a cluster with anon/authenticated genuinely absent — roles
--      in Postgres are cluster-wide, and a first attempt at this check was
--      invalid because they still existed from an earlier database)
-- ---------------------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE NOT c.relrowsecurity)            AS open_tables,
  count(*) FILTER (WHERE c.relrowsecurity)                AS protected_tables,
  count(*)                                                AS total_tables,
  coalesce(
    string_agg(c.relname, ', ') FILTER (WHERE NOT c.relrowsecurity),
    '(none — every table is protected)'
  )                                                       AS still_open
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
WHERE ns.nspname = 'public' AND c.relkind = 'r';
