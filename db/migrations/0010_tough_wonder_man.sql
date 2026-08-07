CREATE TYPE "public"."post_kind" AS ENUM('post', 'research', 'signal');--> statement-breakpoint
CREATE TYPE "public"."post_visibility" AS ENUM('public', 'unlisted');--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" uuid,
	"author_name" text,
	"kind" "post_kind" DEFAULT 'post' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"source_url" text,
	"ref_type" text,
	"ref_value" text,
	"locale" text,
	"visibility" "post_visibility" DEFAULT 'public' NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"repost_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_visibility_created_idx" ON "posts" USING btree ("visibility","created_at");--> statement-breakpoint
CREATE INDEX "posts_author_idx" ON "posts" USING btree ("author_user_id");--> statement-breakpoint
-- Lockdown posture (matches every other table): RLS on, no policies. Only the
-- app's service connection reads/writes; all publishing goes through our API,
-- which enforces authorship and public/unlisted visibility server-side.
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;