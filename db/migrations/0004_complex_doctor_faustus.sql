CREATE TYPE "public"."effort" AS ENUM('small', 'medium', 'large');--> statement-breakpoint
CREATE TYPE "public"."impact" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."suggestion_kind" AS ENUM('feature', 'improvement', 'bug', 'integration', 'data_source', 'other');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('new', 'triaged', 'planned', 'in_progress', 'shipped', 'declined');--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"locale" text,
	"kind" "suggestion_kind" DEFAULT 'other' NOT NULL,
	"status" "suggestion_status" DEFAULT 'new' NOT NULL,
	"category" text,
	"impact" "impact",
	"effort" "effort",
	"sentiment" text,
	"summary" text,
	"tags" jsonb,
	"cluster_key" text,
	"submitter_weight" integer DEFAULT 1 NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"triaged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "suggestions_status_idx" ON "suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "suggestions_cluster_idx" ON "suggestions" USING btree ("cluster_key");--> statement-breakpoint
CREATE INDEX "suggestions_user_idx" ON "suggestions" USING btree ("user_id");