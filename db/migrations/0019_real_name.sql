-- A real name, and a switch that decides whether anyone else sees it.
--
-- `full_name` is what the person gave at sign-up. It is deliberately not
-- `display_name`: display_name answers "what goes next to this post", this
-- answers "who is this", and conflating them is how a real name ends up
-- published by a piece of code that only wanted a label.
--
-- `show_real_name` defaults to false, and the default is the point. On a
-- platform whose charter forbids profiling private individuals, a real name
-- that is visible until its owner finds the setting has already been published.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "full_name" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "show_real_name" boolean DEFAULT false NOT NULL;
