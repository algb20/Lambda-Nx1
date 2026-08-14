-- Durable object storage.
--
-- The storage port defaulted to the filesystem, which is a correct choice for a
-- self-hosted box with a disk and a silently wrong one everywhere this app
-- actually runs. On Netlify and Vercel the function filesystem is ephemeral:
-- a profile picture written during one request is gone by the next deploy —
-- often by the next cold start. The upload appeared to succeed, the database
-- kept a URL pointing at a file that no longer existed, and the user's picture
-- quietly reverted to their initials with nothing reporting an error.
--
-- Blobs therefore live in the database, which is the one component of this
-- platform that is already durable, backed up and shared across every instance.
-- For the sizes involved (avatars are capped at 2 MB) this is a better trade
-- than another vendor: no new key to leak, no new provider to be locked into,
-- and it works identically on every host.
--
-- The storage port is unchanged, so swapping this for S3 or Supabase Storage
-- later stays a provider switch rather than an application change (charter §4).

CREATE TABLE IF NOT EXISTS "blobs" (
  -- The storage key, e.g. 'avatars/<user-id>/<version>.png'. Versioned keys are
  -- why a replaced picture gets a new URL instead of being masked by a cache.
  "key" text PRIMARY KEY,
  "content_type" text,
  "bytes" bytea NOT NULL,
  -- Denormalised so a size query never has to read the payload.
  "size" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Avatar keys carry the owner's id as their first segment, so this index makes
-- "everything belonging to this user" a range scan. Account deletion needs it.
CREATE INDEX IF NOT EXISTS "blobs_key_prefix_idx" ON "blobs" ("key" text_pattern_ops);
