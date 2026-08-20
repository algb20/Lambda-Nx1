-- Email verification and password-reset codes.
--
-- Off-Pi accounts previously came into existence the moment somebody typed an
-- address into the form, which meant the address was never checked: a typo
-- created an account nobody could recover, and a stranger's address created an
-- account that stranger could not stop. This table is the proof step.
--
-- One live code per (email, purpose). Issuing a new one replaces the previous
-- one rather than adding to it — five valid codes in a mailbox are five chances
-- for a guess and one confused reader.
--
-- The code is never stored. `code_hash` is the same scrypt hash used for
-- passwords, which matters more here than for a password: six digits is a
-- keyspace of one million, so a plain-text column would hand every pending code
-- to anyone who reads a backup. scrypt makes an offline sweep cost days per
-- code; `attempts` makes an online one cost five tries.
--
-- Written by hand, and idempotent, because this migration is applied to
-- databases that are already live.

DO $$ BEGIN
  CREATE TYPE "public"."verification_purpose" AS ENUM('signup', 'reset');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "verification_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "purpose" "verification_purpose" NOT NULL,
  "code_hash" text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "verification_codes_email_purpose_uq" UNIQUE("email", "purpose")
);
--> statement-breakpoint

-- Expired rows are swept by age, not only when their owner comes back: a code
-- nobody returns for would otherwise sit in the table forever.
CREATE INDEX IF NOT EXISTS "verification_codes_expires_idx"
  ON "verification_codes" ("expires_at");
