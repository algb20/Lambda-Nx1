-- People who asked to be sent the brief by email.
--
-- ## Double opt-in, and why it is not optional here
--
-- A row exists the moment somebody types an address, but it is `pending` and
-- nothing is ever sent to it except the one message asking whether they meant
-- it. Only a click on that link sets `confirmed_at`, and only a confirmed row
-- receives anything.
--
-- The reason is not etiquette. Without it, a form on a public intelligence
-- platform is a machine for mailing strangers: anyone could type anyone's
-- address and we would send it world-event briefs it never asked for, from a
-- domain whose reputation we depend on for the verification codes that sign
-- people in. One abused subscribe box takes the whole account system down with
-- it.
--
-- ## Two tokens, and neither is stored
--
-- `confirm_token_hash` proves the person reached their own inbox.
-- `unsubscribe_token_hash` lets them leave without signing in, which is what
-- one-click unsubscribe (RFC 8058) requires and what every mail provider now
-- scores a sender on. Both are hashed with the same scrypt used for passwords,
-- because a leaked backup of plain unsubscribe tokens is a leaked list of who
-- reads us, and the confirm token is a way to subscribe somebody who declined.
--
-- The unsubscribe token deliberately outlives confirmation: it is printed in
-- every message we ever send, so it cannot be single-use or one-time-only the
-- way the confirm token is.
--
-- Written by hand and idempotent, like every migration here, because it is
-- applied to databases that are already live.

CREATE TABLE IF NOT EXISTS "email_followers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Normalised (trimmed, lowercased). One subscription per address, ever.
  "email" text NOT NULL,
  -- The language their brief is written in, from the interface they asked in.
  "locale" text NOT NULL DEFAULT 'en',
  "confirm_token_hash" text NOT NULL,
  "unsubscribe_token_hash" text NOT NULL,
  -- Null until they click the link. Nothing is sent to a null row.
  "confirmed_at" timestamp with time zone,
  -- Set when they leave. The row is kept rather than deleted so that a later
  -- re-subscribe is a deliberate act and not a silently restored old one.
  "unsubscribed_at" timestamp with time zone,
  -- When we last sent them anything, so a run can skip what it already sent.
  "last_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_followers_email_uq" UNIQUE("email")
);
--> statement-breakpoint

-- A send picks up confirmed, still-subscribed rows. Both columns are null for
-- the overwhelming majority of the table's life, so the partial index is the
-- one that stays small.
CREATE INDEX IF NOT EXISTS "email_followers_sendable_idx"
  ON "email_followers" ("confirmed_at")
  WHERE "confirmed_at" IS NOT NULL AND "unsubscribed_at" IS NULL;
--> statement-breakpoint

-- Unconfirmed rows are swept by age: an address somebody typed by mistake, or
-- typed for a stranger who sensibly ignored the message, must not sit here
-- forever waiting to be confirmed.
CREATE INDEX IF NOT EXISTS "email_followers_pending_idx"
  ON "email_followers" ("created_at")
  WHERE "confirmed_at" IS NULL;
