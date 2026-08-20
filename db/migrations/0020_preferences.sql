-- What a person has chosen, kept.
--
-- Every setting on the globe lived in component state, so switching tabs threw
-- all of it away. A user who spent a minute arranging the board to watch two
-- things lost that minute every time they looked at anything else — which
-- teaches them not to configure anything, and then the configurability may as
-- well not exist.
--
-- One JSON document rather than a row per key: there are eight settings, and a
-- row each means eight round trips, eight migrations, and eight chances for a
-- partial write to leave a layout nobody chose. The shape is validated on read
-- (`lib/prefs/schema.ts`), so a blob written by an older build degrades to
-- defaults instead of crashing the page.
--
-- Nullable, and it stays nullable: signed-out visitors keep their preferences
-- in the browser, and most visitors are signed out — the gateways are open
-- without an account by charter §1.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferences" jsonb;
