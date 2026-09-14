CREATE TABLE IF NOT EXISTS "resource_publication_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"agreement_id" integer,
	"resource_type" varchar(20) NOT NULL,
	"resource_id" integer NOT NULL,
	"status" varchar(32) DEFAULT 'claim_pending' NOT NULL,
	"approved_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_uses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provenance_note" text,
	"terms_version" varchar(80),
	"requested_by_user_id" integer,
	"reviewed_by_user_id" integer,
	"approved_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"withdrawal_reason" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_publication_permissions" ADD CONSTRAINT "resource_publication_permissions_type_check" CHECK ("resource_type" IN ('hard', 'soft'));
--> statement-breakpoint
ALTER TABLE "resource_publication_permissions" ADD CONSTRAINT "resource_publication_permissions_status_check" CHECK ("status" IN ('claim_pending', 'owner_verified', 'publishing_approved', 'permission_withdrawn'));
--> statement-breakpoint
ALTER TABLE "resource_publication_permissions" ADD CONSTRAINT "resource_publication_permissions_fields_check" CHECK (jsonb_typeof("approved_fields") = 'array' AND "approved_fields" <@ '["logoUrl", "bannerUrl", "galleryUrls", "description", "website", "socialLinks", "ctaUrl"]'::jsonb);
--> statement-breakpoint
ALTER TABLE "resource_publication_permissions" ADD CONSTRAINT "resource_publication_permissions_uses_check" CHECK (jsonb_typeof("allowed_uses") = 'object');
--> statement-breakpoint
ALTER TABLE "resource_publication_permissions" ADD CONSTRAINT "resource_publication_permissions_revision_check" CHECK ("revision" > 0);
--> statement-breakpoint
ALTER TABLE "resource_publication_permissions" ADD CONSTRAINT "resource_publication_permissions_approval_state_check" CHECK ("status" <> 'publishing_approved' OR ("agreement_id" IS NOT NULL AND "requested_by_user_id" IS NOT NULL AND "reviewed_by_user_id" IS NOT NULL AND "approved_at" IS NOT NULL AND length(trim("terms_version")) > 0));
--> statement-breakpoint
ALTER TABLE "resource_publication_permissions" ADD CONSTRAINT "resource_publication_permissions_withdrawal_state_check" CHECK ("status" <> 'permission_withdrawn' OR ("withdrawn_at" IS NOT NULL AND length(trim("withdrawal_reason")) > 0));
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_publication_permissions" ADD CONSTRAINT "resource_publication_permissions_organization_id_partner_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."partner_organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_publication_permissions" ADD CONSTRAINT "resource_publication_permissions_agreement_id_organization_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."organization_agreements"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_publication_permissions" ADD CONSTRAINT "resource_publication_permissions_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_publication_permissions" ADD CONSTRAINT "resource_publication_permissions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_publication_permissions_org_resource_unique" ON "resource_publication_permissions" ("organization_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_publication_permissions_resource_idx" ON "resource_publication_permissions" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_publication_permissions_status_idx" ON "resource_publication_permissions" ("status");
