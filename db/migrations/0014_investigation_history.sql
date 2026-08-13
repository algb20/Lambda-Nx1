-- Investigation history.
--
-- `investigations` already recorded the domain gateway's archive. History needs
-- two more facts to be useful: which gateway produced the run, and how much it
-- found — so a list can say "Ownership · Nestle · 12 findings · 2 days ago"
-- without loading every finding to count them.
--
-- Both are nullable: rows written before this migration are real history and
-- must not be discarded to make a column non-null.
ALTER TABLE "investigations" ADD COLUMN IF NOT EXISTS "gateway" text;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN IF NOT EXISTS "finding_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- The history list is always "this user's, newest first", optionally filtered by
-- gateway. One composite index serves both.
CREATE INDEX IF NOT EXISTS "investigations_user_created_idx" ON "investigations" ("user_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "investigations_user_gateway_idx" ON "investigations" ("user_id","gateway");
