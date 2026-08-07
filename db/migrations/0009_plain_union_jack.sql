CREATE TABLE "visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_key" text NOT NULL,
	"user_id" uuid,
	"provider" "auth_provider",
	"display_name" text,
	"country_code" char(2),
	"country_name" text,
	"region" text,
	"last_mode" text,
	"visit_count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitors_subject_uq" UNIQUE("subject_key")
);
--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visitors_country_idx" ON "visitors" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "visitors_last_seen_idx" ON "visitors" USING btree ("last_seen_at");--> statement-breakpoint
-- Lockdown posture: RLS on, no policies. Only the service role (the app, via
-- DATABASE_URL) can touch this table; anon/authenticated are denied. This
-- registry is admin-only and is never reached from the client.
ALTER TABLE "visitors" ENABLE ROW LEVEL SECURITY;