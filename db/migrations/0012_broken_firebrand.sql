CREATE TYPE "public"."social_platform" AS ENUM('webhook', 'discord', 'slack', 'telegram');--> statement-breakpoint
CREATE TABLE "social_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "social_platform" NOT NULL,
	"label" text NOT NULL,
	"target" text NOT NULL,
	"secret_enc" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"auto_publish" boolean DEFAULT false NOT NULL,
	"kind_filter" "post_kind",
	"last_status" text,
	"last_error" text,
	"last_at" timestamp with time zone,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "social_channels_enabled_idx" ON "social_channels" USING btree ("enabled","auto_publish");--> statement-breakpoint
-- The table holds encrypted bot tokens, so nothing may reach it except the
-- server's own connection. No policy is defined, which with RLS enabled means
-- no anon or authenticated role can read a row at all.
ALTER TABLE "social_channels" ENABLE ROW LEVEL SECURITY;
