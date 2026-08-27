-- CareAround SG current-schema baseline generated from src/db/schema.js.
-- This creates a fresh database. Existing environments must be fingerprinted
-- and baselined in the migration journal; do not run this file over them.
DO $$ BEGIN
 CREATE TYPE "public"."role" AS ENUM('super_admin', 'regional_admin', 'partner', 'standard', 'guest');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audience_zone_postal_codes" (
	"audience_zone_id" integer NOT NULL,
	"postal_code" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "audience_zone_postal_codes_audience_zone_id_postal_code_pk" PRIMARY KEY("audience_zone_id","postal_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audience_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_code" varchar(80),
	"partner_user_id" integer,
	"hard_asset_id" integer,
	"sharing_status" varchar(40) DEFAULT 'approved' NOT NULL,
	"approved_by_user_id" integer,
	"approved_at" timestamp,
	"created_by_user_id" integer,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "audience_zones_zone_code_unique" UNIQUE("zone_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "governance_group_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"group_role" varchar(40) DEFAULT 'staff' NOT NULL,
	"revoked_at" timestamp,
	"created_by_user_id" integer,
	"updated_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "governance_group_organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"link_status" varchar(40) DEFAULT 'active' NOT NULL,
	"unlinked_at" timestamp,
	"linked_by_user_id" integer,
	"unlinked_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "governance_group_resource_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"resource_type" varchar(20) NOT NULL,
	"resource_id" integer NOT NULL,
	"link_status" varchar(40) DEFAULT 'active' NOT NULL,
	"unlinked_at" timestamp,
	"linked_by_user_id" integer,
	"unlinked_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "governance_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_type" varchar(20) NOT NULL,
	"organization_id" integer,
	"subregion_id" integer,
	"name" varchar(255) NOT NULL,
	"description" text,
	"coordination_status" varchar(40) DEFAULT 'active' NOT NULL,
	"public_label" varchar(255),
	"public_summary" text,
	"archived_at" timestamp,
	"created_by_user_id" integer,
	"updated_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hard_asset_staff_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"hard_asset_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"staff_role" varchar(40) DEFAULT 'staff' NOT NULL,
	"revoked_at" timestamp,
	"created_by_user_id" integer,
	"updated_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hard_asset_tags" (
	"hard_asset_id" integer NOT NULL,
	"tag_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hard_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_key" varchar(160),
	"partner_id" integer,
	"created_by_user_id" integer,
	"subregion_id" integer,
	"name" varchar(255) NOT NULL,
	"sub_category" varchar(50) DEFAULT 'Active Ageing Centres' NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"address" text NOT NULL,
	"country" varchar(2) DEFAULT 'US' NOT NULL,
	"postal_code" varchar(20) DEFAULT '' NOT NULL,
	"phone" varchar(50),
	"whatsapp_contact" varchar(255),
	"contact_email" varchar(255),
	"hours" text,
	"website" text,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"logo_url" text,
	"banner_url" text,
	"gallery_urls" jsonb DEFAULT '[]',
	"source_google_place_id" text,
	"source_google_maps_uri" text,
	"last_reviewed_at" timestamp,
	"last_verified_by_user_id" integer,
	"source_type" varchar(80),
	"verification_status" varchar(40) DEFAULT 'unverified' NOT NULL,
	"verification_confidence" varchar(40),
	"is_hidden" boolean DEFAULT false,
	"hide_from" timestamp,
	"hide_until" timestamp,
	"is_deleted" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "hard_assets_external_key_unique" UNIQUE("external_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "my_map_asset_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_asset_id" integer NOT NULL,
	"note_text" text NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "my_map_asset_short_descriptors" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_asset_id" integer NOT NULL,
	"descriptor_text" varchar(240) NOT NULL,
	"text_color" varchar(7),
	"highlight_color" varchar(7),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "my_map_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"resource_type" varchar(20) NOT NULL,
	"resource_id" integer NOT NULL,
	"snapshot" jsonb,
	"short_descriptor" varchar(240),
	"short_descriptor_text_color" varchar(7),
	"short_descriptor_highlight_color" varchar(7),
	"private_note" text,
	"handoff_note" text,
	"notes_updated_at" timestamp,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "my_map_personal_place_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"personal_place_id" integer NOT NULL,
	"short_descriptors" jsonb,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "my_map_personal_places" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"category_label" varchar(120),
	"address" text,
	"postal_code" varchar(20),
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "my_map_print_annotation_documents" (
	"map_id" integer PRIMARY KEY NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"annotations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "my_map_share_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"share_token" varchar(64) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "my_map_studio_documents" (
	"map_id" integer PRIMARY KEY NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"document" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "my_maps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_shared" boolean DEFAULT false NOT NULL,
	"share_token" varchar(64),
	"share_includes_handoff_notes" boolean DEFAULT false NOT NULL,
	"share_updated_at" timestamp,
	"embed_enabled" boolean DEFAULT false NOT NULL,
	"embed_allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"channel" varchar(40) NOT NULL,
	"category" varchar(80) DEFAULT 'general' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"delivery_allowed" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offering_schedule_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"soft_asset_id" integer NOT NULL,
	"revision" integer NOT NULL,
	"entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schedule_notes" text,
	"public_summary" text,
	"source" varchar(40) DEFAULT 'manual' NOT NULL,
	"published_by_user_id" integer,
	"published_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_access_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"access_role" varchar(40) DEFAULT 'staff' NOT NULL,
	"revoked_at" timestamp,
	"created_by_user_id" integer,
	"updated_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"agreement_reference" varchar(160) NOT NULL,
	"agreement_type" varchar(80) DEFAULT 'data_sharing' NOT NULL,
	"file_url" text,
	"file_name" text,
	"status" varchar(40) DEFAULT 'draft' NOT NULL,
	"effective_at" timestamp,
	"expires_at" timestamp,
	"allowed_uses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewed_by_user_id" integer,
	"approved_by_user_id" integer,
	"reviewed_at" timestamp,
	"approved_at" timestamp,
	"revoked_at" timestamp,
	"created_by_user_id" integer,
	"updated_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_resource_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"resource_type" varchar(20) NOT NULL,
	"resource_id" integer NOT NULL,
	"link_status" varchar(40) DEFAULT 'active' NOT NULL,
	"agreement_coverage_status" varchar(40) DEFAULT 'unknown' NOT NULL,
	"linked_by_user_id" integer,
	"unlinked_by_user_id" integer,
	"unlinked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partner_organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_partner_user_id" integer,
	"name" varchar(255) NOT NULL,
	"description" text,
	"governance_status" varchar(40) DEFAULT 'active' NOT NULL,
	"data_contact_name" varchar(255),
	"data_contact_email" varchar(255),
	"created_by_user_id" integer,
	"updated_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partner_postal_codes" (
	"partner_user_id" integer NOT NULL,
	"postal_code" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "partner_postal_codes_partner_user_id_postal_code_pk" PRIMARY KEY("partner_user_id","postal_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partner_staff_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer,
	"actor_user_id" integer,
	"target_user_id" integer,
	"event_type" varchar(80) NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partner_staff_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"staff_role" varchar(40) DEFAULT 'editor' NOT NULL,
	"revoked_at" timestamp,
	"created_by_user_id" integer,
	"updated_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "phone_login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(40) DEFAULT 'gudauth' NOT NULL,
	"provider_challenge_id" varchar(255),
	"attempt_token_hash" varchar(128),
	"requested_phone_e164" varchar(32),
	"verified_phone_e164" varchar(32),
	"resolved_user_id" integer,
	"status" varchar(40) DEFAULT 'pending' NOT NULL,
	"provider_status" varchar(80),
	"failure_reason" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "phone_verification_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(40) DEFAULT 'gudauth' NOT NULL,
	"provider_challenge_id" varchar(255),
	"requested_phone_e164" varchar(32),
	"verified_phone_e164" varchar(32),
	"status" varchar(40) DEFAULT 'pending' NOT NULL,
	"provider_status" varchar(80),
	"failure_reason" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "private_resource_content_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "private_resource_content_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" varchar(160) NOT NULL,
	"file_size" integer NOT NULL,
	"file_data" text NOT NULL,
	"uploaded_by_user_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "private_resource_contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_type" varchar(20) NOT NULL,
	"resource_id" integer NOT NULL,
	"notes" text,
	"created_by_user_id" integer,
	"updated_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recommendation_review_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"reviewer_user_id" integer,
	"map_id" integer,
	"resource_type" varchar(20),
	"resource_id" integer,
	"recommendation_type" varchar(80) DEFAULT 'social_prescribing' NOT NULL,
	"decision" varchar(40) DEFAULT 'pending' NOT NULL,
	"status" varchar(40) DEFAULT 'draft' NOT NULL,
	"explanation_shown" text,
	"review_notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_type" varchar(30) NOT NULL,
	"resource_id" integer NOT NULL,
	"locale" varchar(12) NOT NULL,
	"fields" jsonb DEFAULT '{}' NOT NULL,
	"field_meta" jsonb DEFAULT '{}' NOT NULL,
	"reviewed_at" timestamp,
	"updated_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "retention_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" integer NOT NULL,
	"retention_category" varchar(80) NOT NULL,
	"retain_until" timestamp,
	"deletion_eligible" boolean DEFAULT false NOT NULL,
	"deletion_status" varchar(40) DEFAULT 'active' NOT NULL,
	"reviewed_by_user_id" integer,
	"deleted_by_user_id" integer,
	"reviewed_at" timestamp,
	"deleted_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sensitive_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"target_user_id" integer,
	"action_type" varchar(120) NOT NULL,
	"entity_type" varchar(80),
	"entity_id" integer,
	"resource_type" varchar(20),
	"resource_id" integer,
	"organization_id" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soft_asset_audience_zones" (
	"soft_asset_id" integer NOT NULL,
	"audience_zone_id" integer NOT NULL,
	CONSTRAINT "soft_asset_audience_zones_soft_asset_id_audience_zone_id_pk" PRIMARY KEY("soft_asset_id","audience_zone_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soft_asset_group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_soft_asset_id" integer NOT NULL,
	"member_resource_type" varchar(20) NOT NULL,
	"member_resource_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_by_user_id" integer,
	"added_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soft_asset_locations" (
	"soft_asset_id" integer NOT NULL,
	"hard_asset_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soft_asset_parent_audience_zones" (
	"soft_asset_parent_id" integer NOT NULL,
	"audience_zone_id" integer NOT NULL,
	CONSTRAINT "soft_asset_parent_audience_zones_soft_asset_parent_id_audience_zone_id_pk" PRIMARY KEY("soft_asset_parent_id","audience_zone_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soft_asset_parents" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_key" varchar(160),
	"partner_id" integer,
	"created_by_user_id" integer,
	"name" varchar(255) NOT NULL,
	"bucket" varchar(20),
	"sub_category" varchar(50) DEFAULT 'Programmes' NOT NULL,
	"description" text,
	"schedule" text,
	"logo_url" text,
	"banner_url" text,
	"gallery_urls" jsonb DEFAULT '[]',
	"website" text,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"contact_phone" varchar(50),
	"whatsapp_contact" varchar(255),
	"contact_email" varchar(255),
	"audience_mode" varchar(40) DEFAULT 'public' NOT NULL,
	"is_member_only" boolean DEFAULT false,
	"eligibility_rules" jsonb,
	"tags" jsonb DEFAULT '[]',
	"last_reviewed_at" timestamp,
	"last_verified_by_user_id" integer,
	"source_type" varchar(80),
	"verification_status" varchar(40) DEFAULT 'unverified' NOT NULL,
	"verification_confidence" varchar(40),
	"is_deleted" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "soft_asset_parents_external_key_unique" UNIQUE("external_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soft_asset_region_coverages" (
	"soft_asset_id" integer NOT NULL,
	"subregion_id" integer NOT NULL,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "soft_asset_region_coverages_soft_asset_id_subregion_id_pk" PRIMARY KEY("soft_asset_id","subregion_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soft_asset_staff_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"soft_asset_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"staff_role" varchar(40) DEFAULT 'staff' NOT NULL,
	"revoked_at" timestamp,
	"created_by_user_id" integer,
	"updated_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soft_asset_tags" (
	"soft_asset_id" integer NOT NULL,
	"tag_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "soft_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_key" varchar(160),
	"partner_id" integer,
	"created_by_user_id" integer,
	"updated_by_user_id" integer,
	"subregion_id" integer,
	"asset_mode" varchar(20) DEFAULT 'standalone' NOT NULL,
	"parent_soft_asset_id" integer,
	"host_hard_asset_id" integer,
	"name" varchar(255) NOT NULL,
	"bucket" varchar(20),
	"sub_category" varchar(50) DEFAULT 'Programmes' NOT NULL,
	"description" text,
	"schedule" text,
	"calendar_enabled" boolean DEFAULT false NOT NULL,
	"calendar_starts_at" timestamp with time zone,
	"calendar_ends_at" timestamp with time zone,
	"calendar_recurrence" varchar(20) DEFAULT 'once' NOT NULL,
	"calendar_weekdays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calendar_repeat_until" timestamp with time zone,
	"calendar_timezone" varchar(80) DEFAULT 'Asia/Singapore' NOT NULL,
	"calendar_status" varchar(20) DEFAULT 'active' NOT NULL,
	"calendar_revision" integer DEFAULT 0 NOT NULL,
	"calendar_updated_at" timestamp with time zone,
	"calendar_entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schedule_notes" text,
	"calendar_schedule_source" varchar(40) DEFAULT 'legacy' NOT NULL,
	"logo_url" text,
	"banner_url" text,
	"gallery_urls" jsonb DEFAULT '[]',
	"website" text,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"audience_mode" varchar(40) DEFAULT 'public' NOT NULL,
	"is_member_only" boolean DEFAULT false,
	"eligibility_rules" jsonb,
	"overridden_fields" jsonb DEFAULT '[]',
	"contact_phone" varchar(50),
	"whatsapp_contact" varchar(255),
	"contact_email" varchar(255),
	"cta_label" varchar(255),
	"cta_url" text,
	"venue_note" text,
	"availability_enabled" boolean DEFAULT false,
	"availability_count" integer DEFAULT 0,
	"availability_unit" text,
	"last_reviewed_at" timestamp,
	"last_verified_by_user_id" integer,
	"source_type" varchar(80),
	"verification_status" varchar(40) DEFAULT 'unverified' NOT NULL,
	"verification_confidence" varchar(40),
	"is_hidden" boolean DEFAULT false,
	"hide_from" timestamp,
	"hide_until" timestamp,
	"is_deleted" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "soft_assets_external_key_unique" UNIQUE("external_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sub_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"color" varchar(20) DEFAULT '#3b82f6',
	"icon_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subregion_postal_codes" (
	"subregion_id" integer NOT NULL,
	"postal_code" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "subregion_postal_codes_subregion_id_postal_code_pk" PRIMARY KEY("subregion_id","postal_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subregions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subregion_code" varchar(80),
	"name" varchar(255) NOT NULL,
	"description" text,
	"postal_patterns" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "subregions_subregion_code_unique" UNIQUE("subregion_code"),
	CONSTRAINT "subregions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_asset_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"hard_asset_id" integer NOT NULL,
	"join_method" varchar(40) NOT NULL,
	"status" varchar(40) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_calendar_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"item_type" varchar(40) NOT NULL,
	"soft_asset_id" integer,
	"map_asset_note_id" integer,
	"title" varchar(255) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"status" varchar(40) DEFAULT 'planned' NOT NULL,
	"source_schedule_entry_key" varchar(80),
	"source_starts_at" timestamp with time zone,
	"source_revision" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_calendar_schedule_states" (
	"user_id" integer NOT NULL,
	"soft_asset_id" integer NOT NULL,
	"last_seen_revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_calendar_schedule_states_user_id_soft_asset_id_pk" PRIMARY KEY("user_id","soft_asset_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_consent_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"consent_type" varchar(80) NOT NULL,
	"consent_version" varchar(40) NOT NULL,
	"status" varchar(40) DEFAULT 'accepted' NOT NULL,
	"source_surface" varchar(120),
	"accepted_at" timestamp,
	"withdrawn_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"resource_type" varchar(20) NOT NULL,
	"resource_id" integer NOT NULL,
	"snapshot" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_opt_out_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"opt_out_type" varchar(80) NOT NULL,
	"reason" text,
	"active" boolean DEFAULT true NOT NULL,
	"source_surface" varchar(120),
	"created_by_user_id" integer,
	"revoked_by_user_id" integer,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_personal_place_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"normalized_name" varchar(120) NOT NULL,
	"icon_key" varchar(40) DEFAULT 'map-pin' NOT NULL,
	"icon_url" text,
	"color" varchar(7) DEFAULT '#64748B' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_personal_places" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"category_id" integer,
	"legacy_category_label" varchar(120),
	"name" varchar(255) NOT NULL,
	"logo_url" text,
	"address" text,
	"postal_code" varchar(20),
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"short_description" varchar(240),
	"note" text,
	"legacy_map_personal_place_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_phone_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"phone_e164" varchar(32) NOT NULL,
	"country_code" varchar(8) DEFAULT '+65' NOT NULL,
	"national_number" varchar(24) NOT NULL,
	"status" varchar(40) DEFAULT 'legacy_unverified' NOT NULL,
	"source" varchar(40) DEFAULT 'legacy_profile' NOT NULL,
	"provider_subject" varchar(255),
	"verified_at" timestamp,
	"revoked_at" timestamp,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_subregions" (
	"user_id" integer NOT NULL,
	"subregion_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"google_subject" varchar(255),
	"password_hash" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "role" DEFAULT 'standard' NOT NULL,
	"manager_user_id" integer,
	"phone" varchar(50),
	"postal_code" varchar(20) DEFAULT '' NOT NULL,
	"date_of_birth" text,
	"chas_card" varchar(20),
	"caregiver_status" varchar(10),
	"gender" varchar(40),
	"property_type" varchar(60),
	"volunteer_interest" varchar(10),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audience_zone_postal_codes" ADD CONSTRAINT "audience_zone_postal_codes_audience_zone_id_audience_zones_id_fk" FOREIGN KEY ("audience_zone_id") REFERENCES "public"."audience_zones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audience_zones" ADD CONSTRAINT "audience_zones_partner_user_id_users_id_fk" FOREIGN KEY ("partner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audience_zones" ADD CONSTRAINT "audience_zones_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audience_zones" ADD CONSTRAINT "audience_zones_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_group_memberships" ADD CONSTRAINT "governance_group_memberships_group_id_governance_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."governance_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_group_memberships" ADD CONSTRAINT "governance_group_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_group_memberships" ADD CONSTRAINT "governance_group_memberships_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_group_memberships" ADD CONSTRAINT "governance_group_memberships_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_group_organizations" ADD CONSTRAINT "governance_group_organizations_group_id_governance_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."governance_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_group_organizations" ADD CONSTRAINT "governance_group_organizations_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_group_organizations" ADD CONSTRAINT "governance_group_organizations_linked_by_user_id_users_id_fk" FOREIGN KEY ("linked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_group_organizations" ADD CONSTRAINT "governance_group_organizations_unlinked_by_user_id_users_id_fk" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_group_resource_links" ADD CONSTRAINT "governance_group_resource_links_group_id_governance_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."governance_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_group_resource_links" ADD CONSTRAINT "governance_group_resource_links_linked_by_user_id_users_id_fk" FOREIGN KEY ("linked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_group_resource_links" ADD CONSTRAINT "governance_group_resource_links_unlinked_by_user_id_users_id_fk" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_groups" ADD CONSTRAINT "governance_groups_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_groups" ADD CONSTRAINT "governance_groups_subregion_id_subregions_id_fk" FOREIGN KEY ("subregion_id") REFERENCES "public"."subregions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_groups" ADD CONSTRAINT "governance_groups_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governance_groups" ADD CONSTRAINT "governance_groups_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hard_asset_staff_memberships" ADD CONSTRAINT "hard_asset_staff_memberships_hard_asset_id_hard_assets_id_fk" FOREIGN KEY ("hard_asset_id") REFERENCES "public"."hard_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hard_asset_staff_memberships" ADD CONSTRAINT "hard_asset_staff_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hard_asset_staff_memberships" ADD CONSTRAINT "hard_asset_staff_memberships_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hard_asset_staff_memberships" ADD CONSTRAINT "hard_asset_staff_memberships_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hard_asset_tags" ADD CONSTRAINT "hard_asset_tags_hard_asset_id_hard_assets_id_fk" FOREIGN KEY ("hard_asset_id") REFERENCES "public"."hard_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hard_asset_tags" ADD CONSTRAINT "hard_asset_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hard_assets" ADD CONSTRAINT "hard_assets_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hard_assets" ADD CONSTRAINT "hard_assets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hard_assets" ADD CONSTRAINT "hard_assets_subregion_id_subregions_id_fk" FOREIGN KEY ("subregion_id") REFERENCES "public"."subregions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hard_assets" ADD CONSTRAINT "hard_assets_last_verified_by_user_id_users_id_fk" FOREIGN KEY ("last_verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "my_map_asset_notes" ADD CONSTRAINT "my_map_asset_notes_map_asset_id_my_map_assets_id_fk" FOREIGN KEY ("map_asset_id") REFERENCES "public"."my_map_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "my_map_asset_short_descriptors" ADD CONSTRAINT "my_map_asset_short_descriptors_map_asset_id_my_map_assets_id_fk" FOREIGN KEY ("map_asset_id") REFERENCES "public"."my_map_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "my_map_assets" ADD CONSTRAINT "my_map_assets_map_id_my_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."my_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "my_map_personal_place_links" ADD CONSTRAINT "my_map_personal_place_links_map_id_my_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."my_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "my_map_personal_place_links" ADD CONSTRAINT "my_map_personal_place_links_personal_place_id_user_personal_places_id_fk" FOREIGN KEY ("personal_place_id") REFERENCES "public"."user_personal_places"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "my_map_personal_places" ADD CONSTRAINT "my_map_personal_places_map_id_my_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."my_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "my_map_print_annotation_documents" ADD CONSTRAINT "my_map_print_annotation_documents_map_id_my_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."my_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "my_map_share_snapshots" ADD CONSTRAINT "my_map_share_snapshots_map_id_my_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."my_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "my_map_studio_documents" ADD CONSTRAINT "my_map_studio_documents_map_id_my_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."my_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "my_maps" ADD CONSTRAINT "my_maps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offering_schedule_versions" ADD CONSTRAINT "offering_schedule_versions_soft_asset_id_soft_assets_id_fk" FOREIGN KEY ("soft_asset_id") REFERENCES "public"."soft_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offering_schedule_versions" ADD CONSTRAINT "offering_schedule_versions_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_access_memberships" ADD CONSTRAINT "organization_access_memberships_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_access_memberships" ADD CONSTRAINT "organization_access_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_access_memberships" ADD CONSTRAINT "organization_access_memberships_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_access_memberships" ADD CONSTRAINT "organization_access_memberships_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_agreements" ADD CONSTRAINT "organization_agreements_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_agreements" ADD CONSTRAINT "organization_agreements_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_agreements" ADD CONSTRAINT "organization_agreements_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_agreements" ADD CONSTRAINT "organization_agreements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_agreements" ADD CONSTRAINT "organization_agreements_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_resource_links" ADD CONSTRAINT "organization_resource_links_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_resource_links" ADD CONSTRAINT "organization_resource_links_linked_by_user_id_users_id_fk" FOREIGN KEY ("linked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_resource_links" ADD CONSTRAINT "organization_resource_links_unlinked_by_user_id_users_id_fk" FOREIGN KEY ("unlinked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_organizations" ADD CONSTRAINT "partner_organizations_legacy_partner_user_id_users_id_fk" FOREIGN KEY ("legacy_partner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_organizations" ADD CONSTRAINT "partner_organizations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_organizations" ADD CONSTRAINT "partner_organizations_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_postal_codes" ADD CONSTRAINT "partner_postal_codes_partner_user_id_users_id_fk" FOREIGN KEY ("partner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_staff_events" ADD CONSTRAINT "partner_staff_events_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_staff_events" ADD CONSTRAINT "partner_staff_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_staff_events" ADD CONSTRAINT "partner_staff_events_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_staff_memberships" ADD CONSTRAINT "partner_staff_memberships_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_staff_memberships" ADD CONSTRAINT "partner_staff_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_staff_memberships" ADD CONSTRAINT "partner_staff_memberships_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_staff_memberships" ADD CONSTRAINT "partner_staff_memberships_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "phone_login_attempts" ADD CONSTRAINT "phone_login_attempts_resolved_user_id_users_id_fk" FOREIGN KEY ("resolved_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "phone_verification_attempts" ADD CONSTRAINT "phone_verification_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "private_resource_content_access" ADD CONSTRAINT "private_resource_content_access_content_id_private_resource_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."private_resource_contents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "private_resource_content_access" ADD CONSTRAINT "private_resource_content_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "private_resource_content_access" ADD CONSTRAINT "private_resource_content_access_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "private_resource_content_files" ADD CONSTRAINT "private_resource_content_files_content_id_private_resource_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."private_resource_contents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "private_resource_content_files" ADD CONSTRAINT "private_resource_content_files_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "private_resource_contents" ADD CONSTRAINT "private_resource_contents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "private_resource_contents" ADD CONSTRAINT "private_resource_contents_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendation_review_records" ADD CONSTRAINT "recommendation_review_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendation_review_records" ADD CONSTRAINT "recommendation_review_records_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendation_review_records" ADD CONSTRAINT "recommendation_review_records_map_id_my_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."my_maps"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_translations" ADD CONSTRAINT "resource_translations_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "retention_records" ADD CONSTRAINT "retention_records_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "retention_records" ADD CONSTRAINT "retention_records_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensitive_audit_logs" ADD CONSTRAINT "sensitive_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensitive_audit_logs" ADD CONSTRAINT "sensitive_audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensitive_audit_logs" ADD CONSTRAINT "sensitive_audit_logs_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_audience_zones" ADD CONSTRAINT "soft_asset_audience_zones_soft_asset_id_soft_assets_id_fk" FOREIGN KEY ("soft_asset_id") REFERENCES "public"."soft_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_audience_zones" ADD CONSTRAINT "soft_asset_audience_zones_audience_zone_id_audience_zones_id_fk" FOREIGN KEY ("audience_zone_id") REFERENCES "public"."audience_zones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_group_members" ADD CONSTRAINT "soft_asset_group_members_group_soft_asset_id_soft_assets_id_fk" FOREIGN KEY ("group_soft_asset_id") REFERENCES "public"."soft_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_group_members" ADD CONSTRAINT "soft_asset_group_members_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_locations" ADD CONSTRAINT "soft_asset_locations_soft_asset_id_soft_assets_id_fk" FOREIGN KEY ("soft_asset_id") REFERENCES "public"."soft_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_locations" ADD CONSTRAINT "soft_asset_locations_hard_asset_id_hard_assets_id_fk" FOREIGN KEY ("hard_asset_id") REFERENCES "public"."hard_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_parent_audience_zones" ADD CONSTRAINT "soft_asset_parent_audience_zones_soft_asset_parent_id_soft_asset_parents_id_fk" FOREIGN KEY ("soft_asset_parent_id") REFERENCES "public"."soft_asset_parents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_parent_audience_zones" ADD CONSTRAINT "soft_asset_parent_audience_zones_audience_zone_id_audience_zones_id_fk" FOREIGN KEY ("audience_zone_id") REFERENCES "public"."audience_zones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_parents" ADD CONSTRAINT "soft_asset_parents_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_parents" ADD CONSTRAINT "soft_asset_parents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_parents" ADD CONSTRAINT "soft_asset_parents_last_verified_by_user_id_users_id_fk" FOREIGN KEY ("last_verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_region_coverages" ADD CONSTRAINT "soft_asset_region_coverages_soft_asset_id_soft_assets_id_fk" FOREIGN KEY ("soft_asset_id") REFERENCES "public"."soft_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_region_coverages" ADD CONSTRAINT "soft_asset_region_coverages_subregion_id_subregions_id_fk" FOREIGN KEY ("subregion_id") REFERENCES "public"."subregions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_region_coverages" ADD CONSTRAINT "soft_asset_region_coverages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_staff_memberships" ADD CONSTRAINT "soft_asset_staff_memberships_soft_asset_id_soft_assets_id_fk" FOREIGN KEY ("soft_asset_id") REFERENCES "public"."soft_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_staff_memberships" ADD CONSTRAINT "soft_asset_staff_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_staff_memberships" ADD CONSTRAINT "soft_asset_staff_memberships_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_staff_memberships" ADD CONSTRAINT "soft_asset_staff_memberships_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_tags" ADD CONSTRAINT "soft_asset_tags_soft_asset_id_soft_assets_id_fk" FOREIGN KEY ("soft_asset_id") REFERENCES "public"."soft_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_asset_tags" ADD CONSTRAINT "soft_asset_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_assets" ADD CONSTRAINT "soft_assets_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_assets" ADD CONSTRAINT "soft_assets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_assets" ADD CONSTRAINT "soft_assets_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_assets" ADD CONSTRAINT "soft_assets_subregion_id_subregions_id_fk" FOREIGN KEY ("subregion_id") REFERENCES "public"."subregions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_assets" ADD CONSTRAINT "soft_assets_parent_soft_asset_id_soft_asset_parents_id_fk" FOREIGN KEY ("parent_soft_asset_id") REFERENCES "public"."soft_asset_parents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_assets" ADD CONSTRAINT "soft_assets_host_hard_asset_id_hard_assets_id_fk" FOREIGN KEY ("host_hard_asset_id") REFERENCES "public"."hard_assets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "soft_assets" ADD CONSTRAINT "soft_assets_last_verified_by_user_id_users_id_fk" FOREIGN KEY ("last_verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subregion_postal_codes" ADD CONSTRAINT "subregion_postal_codes_subregion_id_subregions_id_fk" FOREIGN KEY ("subregion_id") REFERENCES "public"."subregions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_asset_memberships" ADD CONSTRAINT "user_asset_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_asset_memberships" ADD CONSTRAINT "user_asset_memberships_hard_asset_id_hard_assets_id_fk" FOREIGN KEY ("hard_asset_id") REFERENCES "public"."hard_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_calendar_items" ADD CONSTRAINT "user_calendar_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_calendar_items" ADD CONSTRAINT "user_calendar_items_soft_asset_id_soft_assets_id_fk" FOREIGN KEY ("soft_asset_id") REFERENCES "public"."soft_assets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_calendar_items" ADD CONSTRAINT "user_calendar_items_map_asset_note_id_my_map_asset_notes_id_fk" FOREIGN KEY ("map_asset_note_id") REFERENCES "public"."my_map_asset_notes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_calendar_schedule_states" ADD CONSTRAINT "user_calendar_schedule_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_calendar_schedule_states" ADD CONSTRAINT "user_calendar_schedule_states_soft_asset_id_soft_assets_id_fk" FOREIGN KEY ("soft_asset_id") REFERENCES "public"."soft_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_consent_records" ADD CONSTRAINT "user_consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_opt_out_records" ADD CONSTRAINT "user_opt_out_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_opt_out_records" ADD CONSTRAINT "user_opt_out_records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_opt_out_records" ADD CONSTRAINT "user_opt_out_records_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_personal_place_categories" ADD CONSTRAINT "user_personal_place_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_personal_places" ADD CONSTRAINT "user_personal_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_personal_places" ADD CONSTRAINT "user_personal_places_category_id_user_personal_place_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."user_personal_place_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_personal_places" ADD CONSTRAINT "user_personal_places_legacy_map_personal_place_id_my_map_personal_places_id_fk" FOREIGN KEY ("legacy_map_personal_place_id") REFERENCES "public"."my_map_personal_places"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_phone_identities" ADD CONSTRAINT "user_phone_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_phone_identities" ADD CONSTRAINT "user_phone_identities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_subregions" ADD CONSTRAINT "user_subregions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_subregions" ADD CONSTRAINT "user_subregions_subregion_id_subregions_id_fk" FOREIGN KEY ("subregion_id") REFERENCES "public"."subregions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "governance_group_memberships_active_user_unique" ON "governance_group_memberships" ("group_id","user_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governance_group_memberships_group_idx" ON "governance_group_memberships" ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governance_group_memberships_user_idx" ON "governance_group_memberships" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governance_group_memberships_role_idx" ON "governance_group_memberships" ("group_role");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "governance_group_organizations_active_unique" ON "governance_group_organizations" ("group_id","organization_id") WHERE "unlinked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governance_group_organizations_group_idx" ON "governance_group_organizations" ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governance_group_organizations_organization_idx" ON "governance_group_organizations" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "governance_group_resource_links_active_resource_unique" ON "governance_group_resource_links" ("group_id","resource_type","resource_id") WHERE "unlinked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governance_group_resource_links_group_idx" ON "governance_group_resource_links" ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governance_group_resource_links_resource_idx" ON "governance_group_resource_links" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governance_groups_type_idx" ON "governance_groups" ("group_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governance_groups_organization_idx" ON "governance_groups" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governance_groups_subregion_idx" ON "governance_groups" ("subregion_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "governance_groups_status_idx" ON "governance_groups" ("coordination_status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hard_asset_staff_memberships_active_user_unique" ON "hard_asset_staff_memberships" ("hard_asset_id","user_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hard_asset_staff_memberships_hard_asset_idx" ON "hard_asset_staff_memberships" ("hard_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hard_asset_staff_memberships_user_idx" ON "hard_asset_staff_memberships" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hard_asset_staff_memberships_role_idx" ON "hard_asset_staff_memberships" ("staff_role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "my_map_asset_notes_map_asset_idx" ON "my_map_asset_notes" ("map_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "my_map_asset_notes_map_asset_sort_idx" ON "my_map_asset_notes" ("map_asset_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "my_map_asset_short_descriptors_map_asset_idx" ON "my_map_asset_short_descriptors" ("map_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "my_map_asset_short_descriptors_map_asset_sort_idx" ON "my_map_asset_short_descriptors" ("map_asset_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "my_map_assets_map_resource_unique" ON "my_map_assets" ("map_id","resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "my_map_personal_place_links_map_place_unique" ON "my_map_personal_place_links" ("map_id","personal_place_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "my_map_personal_place_links_map_idx" ON "my_map_personal_place_links" ("map_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "my_map_personal_place_links_place_idx" ON "my_map_personal_place_links" ("personal_place_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "my_map_personal_places_map_idx" ON "my_map_personal_places" ("map_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "my_map_personal_places_map_name_idx" ON "my_map_personal_places" ("map_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "my_map_share_snapshots_map_unique" ON "my_map_share_snapshots" ("map_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "my_map_share_snapshots_share_token_idx" ON "my_map_share_snapshots" ("share_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "my_maps_user_idx" ON "my_maps" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "my_maps_share_token_unique" ON "my_maps" ("share_token");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_user_channel_category_unique" ON "notification_preferences" ("user_id","channel","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_preferences_user_idx" ON "notification_preferences" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_preferences_channel_idx" ON "notification_preferences" ("channel");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "offering_schedule_versions_asset_revision_unique" ON "offering_schedule_versions" ("soft_asset_id","revision");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offering_schedule_versions_asset_published_idx" ON "offering_schedule_versions" ("soft_asset_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_access_memberships_active_user_unique" ON "organization_access_memberships" ("organization_id","user_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_access_memberships_organization_idx" ON "organization_access_memberships" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_access_memberships_user_idx" ON "organization_access_memberships" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_access_memberships_role_idx" ON "organization_access_memberships" ("access_role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_agreements_organization_idx" ON "organization_agreements" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_agreements_status_idx" ON "organization_agreements" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_agreements_expires_idx" ON "organization_agreements" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_resource_links_active_resource_unique" ON "organization_resource_links" ("organization_id","resource_type","resource_id") WHERE "unlinked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_resource_links_organization_idx" ON "organization_resource_links" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_resource_links_resource_idx" ON "organization_resource_links" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_resource_links_status_idx" ON "organization_resource_links" ("link_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_resource_links_coverage_status_idx" ON "organization_resource_links" ("agreement_coverage_status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "partner_organizations_legacy_partner_unique" ON "partner_organizations" ("legacy_partner_user_id") WHERE "legacy_partner_user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_organizations_legacy_partner_idx" ON "partner_organizations" ("legacy_partner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_staff_events_organization_idx" ON "partner_staff_events" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_staff_events_actor_idx" ON "partner_staff_events" ("actor_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_staff_events_target_idx" ON "partner_staff_events" ("target_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "partner_staff_memberships_active_user_unique" ON "partner_staff_memberships" ("organization_id","user_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "partner_staff_memberships_active_owner_unique" ON "partner_staff_memberships" ("organization_id") WHERE "revoked_at" IS NULL AND "staff_role" = 'owner';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_staff_memberships_organization_idx" ON "partner_staff_memberships" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_staff_memberships_user_idx" ON "partner_staff_memberships" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "phone_login_attempts_provider_challenge_unique" ON "phone_login_attempts" ("provider","provider_challenge_id") WHERE "provider_challenge_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_login_attempts_status_idx" ON "phone_login_attempts" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_login_attempts_requested_phone_idx" ON "phone_login_attempts" ("requested_phone_e164");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_login_attempts_resolved_user_idx" ON "phone_login_attempts" ("resolved_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_verification_attempts_user_idx" ON "phone_verification_attempts" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "phone_verification_attempts_provider_challenge_unique" ON "phone_verification_attempts" ("provider","provider_challenge_id") WHERE "provider_challenge_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_verification_attempts_status_idx" ON "phone_verification_attempts" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_resource_content_access_content_user_unique" ON "private_resource_content_access" ("content_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_resource_content_access_user_idx" ON "private_resource_content_access" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_resource_content_files_content_idx" ON "private_resource_content_files" ("content_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_resource_contents_resource_unique" ON "private_resource_contents" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_resource_contents_resource_idx" ON "private_resource_contents" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recommendation_review_records_user_idx" ON "recommendation_review_records" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recommendation_review_records_reviewer_idx" ON "recommendation_review_records" ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recommendation_review_records_resource_idx" ON "recommendation_review_records" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recommendation_review_records_status_idx" ON "recommendation_review_records" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_translations_resource_locale_unique" ON "resource_translations" ("resource_type","resource_id","locale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_translations_resource_idx" ON "resource_translations" ("resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "retention_records_entity_category_unique" ON "retention_records" ("entity_type","entity_id","retention_category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retention_records_status_idx" ON "retention_records" ("deletion_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retention_records_retain_until_idx" ON "retention_records" ("retain_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_audit_logs_actor_idx" ON "sensitive_audit_logs" ("actor_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_audit_logs_action_idx" ON "sensitive_audit_logs" ("action_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_audit_logs_entity_idx" ON "sensitive_audit_logs" ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_audit_logs_organization_idx" ON "sensitive_audit_logs" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_audit_logs_resource_idx" ON "sensitive_audit_logs" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_audit_logs_created_idx" ON "sensitive_audit_logs" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "soft_asset_group_members_unique_member_idx" ON "soft_asset_group_members" ("group_soft_asset_id","member_resource_type","member_resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "soft_asset_group_members_group_idx" ON "soft_asset_group_members" ("group_soft_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "soft_asset_group_members_member_idx" ON "soft_asset_group_members" ("member_resource_type","member_resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "soft_asset_region_coverages_soft_asset_idx" ON "soft_asset_region_coverages" ("soft_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "soft_asset_region_coverages_subregion_idx" ON "soft_asset_region_coverages" ("subregion_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "soft_asset_staff_memberships_active_user_unique" ON "soft_asset_staff_memberships" ("soft_asset_id","user_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "soft_asset_staff_memberships_soft_asset_idx" ON "soft_asset_staff_memberships" ("soft_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "soft_asset_staff_memberships_user_idx" ON "soft_asset_staff_memberships" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "soft_asset_staff_memberships_role_idx" ON "soft_asset_staff_memberships" ("staff_role");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_asset_memberships_user_hard_asset_unique" ON "user_asset_memberships" ("user_id","hard_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_asset_memberships_user_idx" ON "user_asset_memberships" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_asset_memberships_hard_asset_idx" ON "user_asset_memberships" ("hard_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_calendar_items_user_starts_idx" ON "user_calendar_items" ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_calendar_items_source_idx" ON "user_calendar_items" ("soft_asset_id","source_starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_calendar_items_note_idx" ON "user_calendar_items" ("map_asset_note_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_calendar_items_planned_occurrence_unique" ON "user_calendar_items" ("user_id","soft_asset_id",coalesce("source_schedule_entry_key", 'legacy-primary'),"source_starts_at") WHERE "item_type" = 'planned_session' AND "soft_asset_id" IS NOT NULL AND "source_starts_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_calendar_schedule_states_user_idx" ON "user_calendar_schedule_states" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_calendar_schedule_states_soft_asset_idx" ON "user_calendar_schedule_states" ("soft_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_consent_records_user_idx" ON "user_consent_records" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_consent_records_user_type_version_idx" ON "user_consent_records" ("user_id","consent_type","consent_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_consent_records_status_idx" ON "user_consent_records" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_favorites_user_resource_unique" ON "user_favorites" ("user_id","resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_opt_out_records_active_user_type_unique" ON "user_opt_out_records" ("user_id","opt_out_type") WHERE "active" = TRUE AND "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_opt_out_records_user_idx" ON "user_opt_out_records" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_opt_out_records_type_idx" ON "user_opt_out_records" ("opt_out_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_personal_place_categories_user_name_unique" ON "user_personal_place_categories" ("user_id","normalized_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_personal_place_categories_user_sort_idx" ON "user_personal_place_categories" ("user_id","sort_order","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_personal_places_user_idx" ON "user_personal_places" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_personal_places_user_name_idx" ON "user_personal_places" ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_personal_places_legacy_place_unique" ON "user_personal_places" ("legacy_map_personal_place_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_phone_identities_active_phone_unique" ON "user_phone_identities" ("phone_e164") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_phone_identities_active_user_unique" ON "user_phone_identities" ("user_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_phone_identities_user_idx" ON "user_phone_identities" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_phone_identities_phone_idx" ON "user_phone_identities" ("phone_e164");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_subject_unique" ON "users" ("google_subject") WHERE "google_subject" IS NOT NULL;
