CREATE TABLE IF NOT EXISTS "boundary_library_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"request_id" varchar(160) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"name" varchar(240) NOT NULL,
	"group_name" varchar(240),
	"source_name" varchar(240),
	"source_group_name" varchar(240),
	"type" varchar(20) NOT NULL,
	"source" jsonb NOT NULL,
	"drawing" jsonb NOT NULL,
	"area" jsonb NOT NULL,
	"point_count" integer NOT NULL,
	"snapshot_sha256" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "boundary_map_requests" (
	"owner_id" integer NOT NULL,
	"request_id" varchar(160) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"map_id" integer,
	"hard_asset_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"outcome_hash" varchar(64) NOT NULL,
	"guidance_cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boundary_map_requests_owner_id_request_id_pk" PRIMARY KEY("owner_id","request_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "boundary_zone_commit_requests" (
	"owner_id" integer NOT NULL,
	"request_id" varchar(160) NOT NULL,
	"job_id" integer NOT NULL,
	"expected_revision" integer NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"snapshot_sha256" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boundary_zone_commit_requests_owner_id_request_id_pk" PRIMARY KEY("owner_id","request_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "boundary_zone_job_rows" (
	"job_id" integer NOT NULL,
	"row_key" varchar(160) NOT NULL,
	"position" integer NOT NULL,
	"hard_asset_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"zone_code" varchar(80),
	"source" jsonb NOT NULL,
	"drawing" jsonb NOT NULL,
	"area" jsonb NOT NULL,
	"snapshot_sha256" varchar(64) NOT NULL,
	"point_count" integer NOT NULL,
	"save_to_library" boolean DEFAULT false NOT NULL,
	"library_name" varchar(240),
	"library_group_name" varchar(240),
	"state" varchar(20) DEFAULT 'preparing' NOT NULL,
	"cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"postal_count" integer DEFAULT 0 NOT NULL,
	"zone_id" integer,
	"library_item_id" integer,
	"error_code" varchar(80),
	CONSTRAINT "boundary_zone_job_rows_job_id_row_key_pk" PRIMARY KEY("job_id","row_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "boundary_zone_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"request_id" varchar(160) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"snapshot_sha256" varchar(64) NOT NULL,
	"manifest_sha256" varchar(64) NOT NULL,
	"manifest_identity" jsonb NOT NULL,
	"state" varchar(20) DEFAULT 'preparing' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"resume_state" varchar(20),
	"cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lease_id" varchar(80),
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "boundary_zone_staged_postals" (
	"job_id" integer NOT NULL,
	"row_key" varchar(160) NOT NULL,
	"postal_code" varchar(6) NOT NULL,
	CONSTRAINT "boundary_staged_postal_format" CHECK ("postal_code" ~ '^[0-9]{6}$'),
	CONSTRAINT "boundary_zone_staged_postals_job_id_row_key_postal_code_pk" PRIMARY KEY("job_id","row_key","postal_code")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boundary_jobs_owner_page" ON "boundary_zone_jobs" ("owner_id","id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boundary_library_items" ADD CONSTRAINT "boundary_library_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boundary_map_requests" ADD CONSTRAINT "boundary_map_requests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boundary_map_requests" ADD CONSTRAINT "boundary_map_requests_map_id_my_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."my_maps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boundary_zone_commit_requests" ADD CONSTRAINT "boundary_commit_owner_job_fk" FOREIGN KEY ("owner_id","job_id") REFERENCES "public"."boundary_zone_jobs"("owner_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boundary_zone_job_rows" ADD CONSTRAINT "boundary_zone_job_rows_job_id_boundary_zone_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."boundary_zone_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boundary_zone_jobs" ADD CONSTRAINT "boundary_zone_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boundary_zone_staged_postals" ADD CONSTRAINT "boundary_staged_postals_row_fk" FOREIGN KEY ("job_id","row_key") REFERENCES "public"."boundary_zone_job_rows"("job_id","row_key") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boundary_library_owner_request" ON "boundary_library_items" ("owner_id","request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boundary_library_owner_page" ON "boundary_library_items" ("owner_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boundary_map_requests_map" ON "boundary_map_requests" ("map_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boundary_commit_job" ON "boundary_zone_commit_requests" ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boundary_job_row_position" ON "boundary_zone_job_rows" ("job_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "boundary_jobs_owner_request" ON "boundary_zone_jobs" ("owner_id","request_id");
