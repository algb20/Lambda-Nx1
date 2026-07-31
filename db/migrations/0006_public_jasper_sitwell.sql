CREATE TYPE "public"."calibration_author_kind" AS ENUM('us', 'external');--> statement-breakpoint
CREATE TYPE "public"."calibration_outcome" AS ENUM('correct', 'partial', 'wrong');--> statement-breakpoint
CREATE TYPE "public"."calibration_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TABLE "calibration_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_kind" "calibration_author_kind" NOT NULL,
	"author" text NOT NULL,
	"claim" text NOT NULL,
	"topic" text,
	"asserted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"horizon" timestamp with time zone,
	"status" "calibration_status" DEFAULT 'open' NOT NULL,
	"outcome" "calibration_outcome",
	"resolved_at" timestamp with time zone,
	"note" text,
	"source_url" text,
	"confidence" "confidence" DEFAULT 'possible' NOT NULL,
	"dedupe_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calibration_claims_dedupe_hash_unique" UNIQUE("dedupe_hash")
);
--> statement-breakpoint
CREATE INDEX "calibration_status_idx" ON "calibration_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "calibration_horizon_idx" ON "calibration_claims" USING btree ("horizon");--> statement-breakpoint
CREATE INDEX "calibration_author_idx" ON "calibration_claims" USING btree ("author");