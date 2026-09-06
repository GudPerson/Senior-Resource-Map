CREATE TABLE IF NOT EXISTS "saved_search_digests" (
	"search_id" varchar(36) PRIMARY KEY NOT NULL,
	"notice_id" varchar(36) NOT NULL,
	"search_revision" integer NOT NULL,
	"baseline_preference" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"read_revision" integer DEFAULT 0 NOT NULL,
	"dismissed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_search_matches" (
	"search_id" varchar(36) NOT NULL,
	"match_key" varchar(64) NOT NULL,
	CONSTRAINT "saved_search_matches_search_id_match_key_pk" PRIMARY KEY("search_id","match_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_searches" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"slot" integer NOT NULL,
	"query" varchar(120) NOT NULL,
	"resource_type" varchar(4) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"baseline_ready" boolean DEFAULT false NOT NULL,
	"baseline_preference" jsonb,
	"scan_page" integer DEFAULT 1 NOT NULL,
	"scan_cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"next_scan_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_id" varchar(36),
	"lease_until" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_search_digests" ADD CONSTRAINT "saved_search_digests_search_id_saved_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_search_matches" ADD CONSTRAINT "saved_search_matches_search_id_saved_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saved_searches_owner_slot_unique" ON "saved_searches" ("user_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "saved_searches_owner_criteria_unique" ON "saved_searches" ("user_id","query","resource_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_searches_due_idx" ON "saved_searches" ("next_scan_at");
--> statement-breakpoint
-- Drizzle 0.21 omits CHECK constraints; preserve all nine declared guards.
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_slot_check" CHECK (slot BETWEEN 1 AND 10);
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_criteria_check" CHECK (length(trim(query)) BETWEEN 2 AND 120 AND resource_type IN ('all', 'hard', 'soft'));
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_progress_check" CHECK (scan_page > 0 AND revision > 0);
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_lease_check" CHECK ((lease_id IS NULL) = (lease_until IS NULL));
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_preference_check" CHECK (baseline_preference IS NULL OR (jsonb_typeof(baseline_preference) = 'object' AND octet_length(baseline_preference::text) <= 512));
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_cursor_check" CHECK (jsonb_typeof(scan_cursor) = 'object' AND octet_length(scan_cursor::text) <= 128);
ALTER TABLE "saved_search_matches" ADD CONSTRAINT "saved_search_matches_key_check" CHECK (match_key ~ '^[0-9a-f]{64}$');
ALTER TABLE "saved_search_digests" ADD CONSTRAINT "saved_search_digests_read_check" CHECK (revision > 0 AND read_revision BETWEEN 0 AND revision);
ALTER TABLE "saved_search_digests" ADD CONSTRAINT "saved_search_digests_epoch_check" CHECK (search_revision > 0 AND jsonb_typeof(baseline_preference) = 'object' AND octet_length(baseline_preference::text) <= 512);
