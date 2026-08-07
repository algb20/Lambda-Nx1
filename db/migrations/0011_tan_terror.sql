ALTER TABLE "credentials" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN "pi_username" text;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_pi_username_unique" UNIQUE("pi_username");