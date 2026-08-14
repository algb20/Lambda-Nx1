-- Public handles.
--
-- Every account gets a username: a Pi pioneer arrives with the one Pi assigned
-- them, and someone signing up off-Pi chooses one at sign-up. Both live in a
-- single namespace, because two namespaces would let an off-Pi account register
-- a name that reads as a Pi user's identity — the exact impersonation a handle
-- is meant to prevent.
--
-- Nullable, because accounts created before handles existed have none and
-- nothing may be invented for them. The unique constraint still holds: in
-- Postgres, NULLs do not collide, so any number of legacy rows can sit without
-- a handle while every real handle stays unique.
--
-- Values are stored already lowercased by the application (normalizeUsername),
-- which is what makes uniqueness case-insensitive: `Lambda` and `lambda` must
-- not be two people.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;

-- Backfill Pi accounts from the identity Pi already gave them, so a pioneer who
-- signed in before this migration keeps the handle they already had rather than
-- being asked to invent a second one.
UPDATE "users"
   SET "username" = lower("external_id")
 WHERE "username" IS NULL
   AND "auth_provider" = 'pi'
   AND lower("external_id") ~ '^[a-z0-9_]{3,30}$'
   AND NOT EXISTS (
     SELECT 1 FROM "users" AS other
      WHERE other."username" = lower("users"."external_id")
   );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_uq'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_username_uq" UNIQUE ("username");
  END IF;
END $$;
