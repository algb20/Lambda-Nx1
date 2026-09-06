-- Indexes for the six foreign keys that had none.
--
-- Found by asking the catalogue rather than by reading queries: every
-- single-column foreign key whose column had no index behind it. Postgres does
-- not create one automatically, and the cost lands in two places that are easy
-- to miss until the tables are large.
--
--   * **Every join and lookup through that column is a sequential scan.**
--     `entity_links.from_entity_id` and `to_entity_id` are the two ends of the
--     graph — "what links to this entity?" is the ontology's central question,
--     and it read the whole table.
--   * **Every delete on the parent scans the child** to enforce the referential
--     action. `entities` cascades into `entity_links` twice, and `users`
--     into `visitors`. Account erasure is exactly that delete.
--
-- `IF NOT EXISTS` so this is safe on a database that already has any of them.
CREATE INDEX IF NOT EXISTS "entity_links_from_idx" ON "entity_links" ("from_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entity_links_to_idx" ON "entity_links" ("to_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_entity_idx" ON "evidence" ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_source_idx" ON "evidence" ("source_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_source_idx" ON "scans" ("source_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitors_user_idx" ON "visitors" ("user_id");
