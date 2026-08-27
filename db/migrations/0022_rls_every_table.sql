-- Row-level security on every table, not five of them.
--
-- ## What was open
--
-- Five tables carried `ENABLE ROW LEVEL SECURITY` — the five added in
-- migrations 0009 to 0013, when the practice began. The nineteen that existed
-- before it did not, and no policy exists anywhere in this project.
--
-- On Supabase that is not a formality. A project's PostgREST API is on by
-- default and its anon key is public by design: it ships to every browser and
-- is meant to. The only thing standing between that key and a table in
-- `public` is row-level security. Without it, these were readable by anyone
-- who knew the project URL:
--
--     users                credentials          verification_codes
--     evidence             investigations       scans
--     email_followers      alerts               monitors
--     entities             entity_links         ontology_nodes
--     ontology_edges       radar_findings       calibration_claims
--     suggestions          sources              source_health_daily
--     blobs
--
-- `credentials` holds password hashes. `verification_codes` holds live sign-up
-- and password-reset codes. `email_followers` and `users` are personal data the
-- charter's §3 data-minimisation rule exists to protect.
--
-- ## Why enabling it changes nothing for the application
--
-- The app reaches Postgres through `postgres-js` with `DATABASE_URL` — a direct
-- connection as the database owner, which **bypasses row-level security by
-- definition**. It has never used the Supabase JS client or the anon key; a
-- search of the whole tree for `SUPABASE_ANON`, `NEXT_PUBLIC_SUPABASE` and
-- `createClient` returns nothing.
--
-- So this is deny-by-default for everyone the app is not, and unchanged for the
-- app. It is the same shape `docs/DEPLOY.md` already describes for the visitors
-- table: "RLS on, no policies — only the app's service connection can touch it."
--
-- Deliberately **no policies**. A policy grants access; the correct grant here
-- is none, because nothing outside the app's own connection should read these
-- at all. If a future feature needs browser-side reads, it gets a policy
-- written for that case, seen and argued about — not an absence inherited from
-- 2026.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_followers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "investigations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "monitors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entity_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ontology_nodes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ontology_edges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "radar_findings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "calibration_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "source_health_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blobs" ENABLE ROW LEVEL SECURITY;
