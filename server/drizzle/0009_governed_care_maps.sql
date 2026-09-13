CREATE TABLE IF NOT EXISTS "governed_map_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"actor_user_id" integer,
	"action_type" varchar(80) NOT NULL,
	"resource_type" varchar(20),
	"resource_id" integer,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "governed_map_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "governed_map_publications" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"share_token" varchar(128) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"published_by_user_id" integer,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by_user_id" integer,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "governed_map_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"resource_type" varchar(20) NOT NULL,
	"resource_id" integer NOT NULL,
	"organization_id_at_add" integer,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"added_by_user_id" integer,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_by_user_id" integer,
	"removed_at" timestamp with time zone,
	"removal_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "governed_maps" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_group_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"lifecycle_status" varchar(32) DEFAULT 'draft' NOT NULL,
	"presentation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" integer,
	"updated_by_user_id" integer,
	"retirement_requested_by_user_id" integer,
	"retirement_reason" text,
	"retirement_requested_at" timestamp with time zone,
	"retirement_eligible_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_asset_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"agreement_id" integer,
	"logo_url" text,
	"banner_url" text,
	"source" varchar(40) DEFAULT 'organization_supplied' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"license_granted_at" timestamp with time zone NOT NULL,
	"submitted_by_user_id" integer,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"domain" varchar(255) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"verified_by_user_id" integer,
	"verified_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_join_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"terms_version" varchar(80) NOT NULL,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"decided_by_user_id" integer,
	"decided_at" timestamp with time zone,
	"decision_reason" text,
	"created_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_onboarding_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_name" varchar(255) NOT NULL,
	"email_domain" varchar(255) NOT NULL,
	"website_url" text,
	"applicant_name" varchar(255) NOT NULL,
	"applicant_email" varchar(320) NOT NULL,
	"logo_url" text,
	"banner_url" text,
	"terms_version" varchar(80) NOT NULL,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"digital_asset_use_granted" boolean DEFAULT false NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" integer,
	"reviewed_at" timestamp with time zone,
	"review_reason" text,
	"created_organization_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "governed_map_events" ADD CONSTRAINT "governed_map_events_metadata_check" CHECK (jsonb_typeof("metadata") = 'object');
--> statement-breakpoint
ALTER TABLE "governed_map_publications" ADD CONSTRAINT "governed_map_publications_revision_check" CHECK ("revision" > 0);
--> statement-breakpoint
ALTER TABLE "governed_map_publications" ADD CONSTRAINT "governed_map_publications_snapshot_check" CHECK (jsonb_typeof("snapshot") = 'object');
--> statement-breakpoint
ALTER TABLE "governed_map_publications" ADD CONSTRAINT "governed_map_publications_origins_check" CHECK (jsonb_typeof("allowed_origins") = 'array');
--> statement-breakpoint
ALTER TABLE "governed_map_resources" ADD CONSTRAINT "governed_map_resources_type_check" CHECK ("resource_type" IN ('hard', 'soft'));
--> statement-breakpoint
ALTER TABLE "governed_map_resources" ADD CONSTRAINT "governed_map_resources_snapshot_check" CHECK (jsonb_typeof("snapshot") = 'object');
--> statement-breakpoint
ALTER TABLE "governed_maps" ADD CONSTRAINT "governed_maps_lifecycle_check" CHECK ("lifecycle_status" IN ('draft', 'published', 'retirement_pending', 'archived'));
--> statement-breakpoint
ALTER TABLE "governed_maps" ADD CONSTRAINT "governed_maps_revision_check" CHECK ("revision" > 0);
--> statement-breakpoint
ALTER TABLE "governed_maps" ADD CONSTRAINT "governed_maps_presentation_check" CHECK (jsonb_typeof("presentation") = 'object');
--> statement-breakpoint
ALTER TABLE "organization_asset_packs" ADD CONSTRAINT "organization_asset_packs_status_check" CHECK ("status" IN ('active', 'revoked'));
--> statement-breakpoint
ALTER TABLE "organization_domains" ADD CONSTRAINT "organization_domains_status_check" CHECK ("status" IN ('pending', 'verified', 'revoked'));
--> statement-breakpoint
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'withdrawn'));
--> statement-breakpoint
ALTER TABLE "organization_onboarding_requests" ADD CONSTRAINT "organization_onboarding_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'withdrawn'));
--> statement-breakpoint
ALTER TABLE "organization_onboarding_requests" ADD CONSTRAINT "organization_onboarding_requests_grant_check" CHECK ("digital_asset_use_granted" = TRUE);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_map_events" ADD CONSTRAINT "governed_map_events_map_id_governed_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."governed_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_map_events" ADD CONSTRAINT "governed_map_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_map_notifications" ADD CONSTRAINT "governed_map_notifications_map_id_governed_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."governed_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_map_notifications" ADD CONSTRAINT "governed_map_notifications_event_id_governed_map_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."governed_map_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_map_notifications" ADD CONSTRAINT "governed_map_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_map_publications" ADD CONSTRAINT "governed_map_publications_map_id_governed_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."governed_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_map_publications" ADD CONSTRAINT "governed_map_publications_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_map_publications" ADD CONSTRAINT "governed_map_publications_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_map_resources" ADD CONSTRAINT "governed_map_resources_map_id_governed_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."governed_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_map_resources" ADD CONSTRAINT "governed_map_resources_organization_id_at_add_partner_organizations_id_fk" FOREIGN KEY ("organization_id_at_add") REFERENCES "public"."partner_organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_map_resources" ADD CONSTRAINT "governed_map_resources_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_map_resources" ADD CONSTRAINT "governed_map_resources_removed_by_user_id_users_id_fk" FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_maps" ADD CONSTRAINT "governed_maps_region_group_id_governance_groups_id_fk" FOREIGN KEY ("region_group_id") REFERENCES "public"."governance_groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_maps" ADD CONSTRAINT "governed_maps_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_maps" ADD CONSTRAINT "governed_maps_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governed_maps" ADD CONSTRAINT "governed_maps_retirement_requested_by_user_id_users_id_fk" FOREIGN KEY ("retirement_requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_asset_packs" ADD CONSTRAINT "organization_asset_packs_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_asset_packs" ADD CONSTRAINT "organization_asset_packs_agreement_id_organization_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."organization_agreements"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_asset_packs" ADD CONSTRAINT "organization_asset_packs_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_domains" ADD CONSTRAINT "organization_domains_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_domains" ADD CONSTRAINT "organization_domains_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_domains" ADD CONSTRAINT "organization_domains_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_created_user_id_users_id_fk" FOREIGN KEY ("created_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_onboarding_requests" ADD CONSTRAINT "organization_onboarding_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_onboarding_requests" ADD CONSTRAINT "organization_onboarding_requests_created_organization_id_partner_organizations_id_fk" FOREIGN KEY ("created_organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governed_map_events_map_idx" ON "governed_map_events" ("map_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governed_map_events_actor_idx" ON "governed_map_events" ("actor_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governed_map_events_created_idx" ON "governed_map_events" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "governed_map_notifications_event_user_unique" ON "governed_map_notifications" ("event_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governed_map_notifications_user_read_idx" ON "governed_map_notifications" ("user_id","read_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governed_map_notifications_map_idx" ON "governed_map_notifications" ("map_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "governed_map_publications_share_token_unique" ON "governed_map_publications" ("share_token");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "governed_map_publications_active_map_unique" ON "governed_map_publications" ("map_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governed_map_publications_map_idx" ON "governed_map_publications" ("map_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "governed_map_resources_active_unique" ON "governed_map_resources" ("map_id","resource_type","resource_id") WHERE "removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governed_map_resources_map_idx" ON "governed_map_resources" ("map_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governed_map_resources_resource_idx" ON "governed_map_resources" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governed_map_resources_organization_idx" ON "governed_map_resources" ("organization_id_at_add");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governed_maps_region_group_idx" ON "governed_maps" ("region_group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governed_maps_status_idx" ON "governed_maps" ("lifecycle_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governed_maps_retirement_idx" ON "governed_maps" ("retirement_eligible_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_asset_packs_active_organization_unique" ON "organization_asset_packs" ("organization_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_asset_packs_organization_idx" ON "organization_asset_packs" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_domains_normalized_unique" ON "organization_domains" (lower("domain")) WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_domains_organization_idx" ON "organization_domains" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_domains_status_idx" ON "organization_domains" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_join_requests_active_email_unique" ON "organization_join_requests" (lower("email")) WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_join_requests_organization_idx" ON "organization_join_requests" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_join_requests_status_idx" ON "organization_join_requests" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_onboarding_requests_status_idx" ON "organization_onboarding_requests" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_onboarding_requests_domain_idx" ON "organization_onboarding_requests" ("email_domain");