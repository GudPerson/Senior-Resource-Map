CREATE TABLE IF NOT EXISTS "notification_resource_jobs" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"favorite_cursor" integer DEFAULT 0 NOT NULL,
	"next_scan_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_id" varchar(36),
	"lease_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_resource_watches" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"favorite_id" integer NOT NULL,
	"baseline" jsonb NOT NULL,
	"muted" boolean DEFAULT false NOT NULL,
	"control_revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_notifications" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"watch_id" varchar(36) NOT NULL,
	"categories" jsonb NOT NULL,
	"changed_fields" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"read_revision" integer DEFAULT 0 NOT NULL,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_resource_jobs" ADD CONSTRAINT "notification_resource_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_resource_watches" ADD CONSTRAINT "notification_resource_watches_favorite_id_user_favorites_id_fk" FOREIGN KEY ("favorite_id") REFERENCES "public"."user_favorites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_watch_id_notification_resource_watches_id_fk" FOREIGN KEY ("watch_id") REFERENCES "public"."notification_resource_watches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_resource_jobs_due_idx" ON "notification_resource_jobs" ("next_scan_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_resource_watches_favorite_unique" ON "notification_resource_watches" ("favorite_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_notifications_watch_unique" ON "user_notifications" ("watch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_notifications_updated_idx" ON "user_notifications" ("updated_at","id");
--> statement-breakpoint
-- Drizzle Kit 0.21 omits declared CHECK constraints; retain them explicitly.
ALTER TABLE "notification_resource_jobs" ADD CONSTRAINT "notification_resource_jobs_cursor_check" CHECK ("favorite_cursor" >= 0);
--> statement-breakpoint
ALTER TABLE "notification_resource_jobs" ADD CONSTRAINT "notification_resource_jobs_lease_check" CHECK (("lease_id" IS NULL) = ("lease_until" IS NULL));
--> statement-breakpoint
ALTER TABLE "notification_resource_watches" ADD CONSTRAINT "notification_resource_watches_baseline_check" CHECK (jsonb_typeof("baseline") = 'object' AND octet_length("baseline"::text) <= 4096);
--> statement-breakpoint
ALTER TABLE "notification_resource_watches" ADD CONSTRAINT "notification_resource_watches_control_check" CHECK ("control_revision" > 0);
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_category_check" CHECK (jsonb_typeof("categories") = 'array' AND jsonb_array_length("categories") BETWEEN 1 AND 2 AND "categories" <@ '["calendar","resources"]'::jsonb);
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_fields_check" CHECK (jsonb_typeof("changed_fields") = 'array' AND jsonb_array_length("changed_fields") BETWEEN 1 AND 8 AND "changed_fields" <@ '["name","category","address","hours","contact","schedule","availability"]'::jsonb);
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_read_check" CHECK ("revision" > 0 AND "read_revision" BETWEEN 0 AND "revision");
