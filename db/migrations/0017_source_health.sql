-- The platform's record of its own sources.
--
-- Every catalogue record carries an Admiralty rating we *declared*. This table
-- holds what each source has actually *done*, so the two can be compared: a
-- feed that has rotted goes on carrying its A forever unless something counts.
--
-- Aggregated per source per day rather than one row per run. A row per run
-- grows without bound and buys nothing — every question this data answers (is
-- it reachable, does it carry anything, when did it last work) is answerable
-- from daily counters, and a bounded table is one nobody has to prune.

CREATE TABLE IF NOT EXISTS "source_health_daily" (
  "source_key" text NOT NULL,
  "day" char(10) NOT NULL,
  "ok" integer DEFAULT 0 NOT NULL,
  "empty" integer DEFAULT 0 NOT NULL,
  "failed" integer DEFAULT 0 NOT NULL,
  "items" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- One row per source per day is the whole storage model, so it is enforced
  -- here rather than by the code that writes it. The upsert depends on it.
  CONSTRAINT "source_health_daily_pk" UNIQUE("source_key","day")
);

CREATE INDEX IF NOT EXISTS "source_health_daily_day_idx" ON "source_health_daily" ("day");
