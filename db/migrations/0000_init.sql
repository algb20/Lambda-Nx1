CREATE TYPE "public"."auth_provider" AS ENUM('pi', 'standalone');--> statement-breakpoint
CREATE TYPE "public"."confidence" AS ENUM('confirmed', 'probable', 'possible', 'unconfirmed');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('domain', 'ip', 'email', 'username', 'organization', 'phone', 'url', 'image', 'wallet', 'other');--> statement-breakpoint
CREATE TYPE "public"."investigation_status" AS ENUM('open', 'archived');--> statement-breakpoint
CREATE TYPE "public"."monitor_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."radar_kind" AS ENUM('internal', 'product');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('queued', 'running', 'done', 'error');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"title" text NOT NULL,
	"detail" jsonb,
	"seen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"type" "entity_type" NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_investigation_type_value_uq" UNIQUE("investigation_id","type","value")
);
--> statement-breakpoint
CREATE TABLE "entity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"from_entity_id" uuid NOT NULL,
	"to_entity_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"entity_id" uuid,
	"claim" text NOT NULL,
	"source_key" text,
	"source_url" text,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archive_url" text,
	"content_hash" text,
	"admiralty_source" char(1),
	"admiralty_info" integer,
	"confidence" "confidence" DEFAULT 'possible' NOT NULL,
	"notes" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"target_type" "entity_type" NOT NULL,
	"target_value" text NOT NULL,
	"status" "investigation_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" "entity_type" NOT NULL,
	"target_value" text NOT NULL,
	"interval_minutes" integer DEFAULT 1440 NOT NULL,
	"status" "monitor_status" DEFAULT 'active' NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "radar_kind" NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"source_url" text,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confidence" "confidence" DEFAULT 'possible' NOT NULL,
	"dedupe_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "radar_findings_dedupe_hash_unique" UNIQUE("dedupe_hash")
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid,
	"source_key" text NOT NULL,
	"input" text NOT NULL,
	"status" "scan_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"capability" text NOT NULL,
	"passive" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider" "auth_provider" NOT NULL,
	"external_id" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_provider_external_uq" UNIQUE("auth_provider","external_id")
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_from_entity_id_entities_id_fk" FOREIGN KEY ("from_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_to_entity_id_entities_id_fk" FOREIGN KEY ("to_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_source_key_sources_key_fk" FOREIGN KEY ("source_key") REFERENCES "public"."sources"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_source_key_sources_key_fk" FOREIGN KEY ("source_key") REFERENCES "public"."sources"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_monitor_idx" ON "alerts" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "entities_investigation_idx" ON "entities" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "entity_links_investigation_idx" ON "entity_links" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "evidence_investigation_idx" ON "evidence" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "monitors_user_idx" ON "monitors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scans_investigation_idx" ON "scans" USING btree ("investigation_id");