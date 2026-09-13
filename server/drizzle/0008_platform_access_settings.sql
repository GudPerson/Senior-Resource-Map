CREATE TABLE IF NOT EXISTS "platform_access_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"public_directory_mode" varchar(32) DEFAULT 'open' NOT NULL,
	"public_registration_mode" varchar(32) DEFAULT 'open' NOT NULL,
	"public_login_mode" varchar(32) DEFAULT 'open' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_access_settings" ADD CONSTRAINT "platform_access_settings_singleton_check" CHECK ("id" = 1);
--> statement-breakpoint
ALTER TABLE "platform_access_settings" ADD CONSTRAINT "platform_access_settings_directory_mode_check" CHECK ("public_directory_mode" IN ('open', 'authenticated', 'closed'));
--> statement-breakpoint
ALTER TABLE "platform_access_settings" ADD CONSTRAINT "platform_access_settings_registration_mode_check" CHECK ("public_registration_mode" IN ('open', 'organization_only', 'closed'));
--> statement-breakpoint
ALTER TABLE "platform_access_settings" ADD CONSTRAINT "platform_access_settings_login_mode_check" CHECK ("public_login_mode" IN ('open', 'organization_only', 'closed'));
--> statement-breakpoint
ALTER TABLE "platform_access_settings" ADD CONSTRAINT "platform_access_settings_revision_check" CHECK ("revision" > 0);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_access_settings" ADD CONSTRAINT "platform_access_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
