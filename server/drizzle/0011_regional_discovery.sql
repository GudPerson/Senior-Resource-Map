CREATE TABLE IF NOT EXISTS "my_map_regional_discovery_documents" (
	"map_id" integer PRIMARY KEY NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"config" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regional_embed_email_grants" (
	"resource_type" varchar(20) NOT NULL,
	"resource_id" integer NOT NULL,
	"status" varchar(16) NOT NULL,
	"approved_original_email" text,
	"value_hash" varchar(64),
	"provenance" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"approved_by_user_id" integer,
	"approved_at" timestamp with time zone,
	"withdrawn_by_user_id" integer,
	"withdrawn_at" timestamp with time zone,
	"withdrawal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regional_embed_email_grants_resource_type_resource_id_pk" PRIMARY KEY("resource_type","resource_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subregion_enquiry_contact_fields" (
	"subregion_id" integer NOT NULL,
	"field" varchar(10) NOT NULL,
	"status" varchar(16) NOT NULL,
	"value" text,
	"value_hash" varchar(64),
	"provenance" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"approved_by_user_id" integer,
	"approved_at" timestamp with time zone,
	"withdrawn_by_user_id" integer,
	"withdrawn_at" timestamp with time zone,
	"withdrawal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subregion_enquiry_contact_fields_subregion_id_field_pk" PRIMARY KEY("subregion_id","field")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "my_map_regional_discovery_documents" ADD CONSTRAINT "my_map_regional_discovery_documents_map_id_my_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."my_maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "my_map_regional_discovery_documents" ADD CONSTRAINT "my_map_regional_discovery_documents_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subregion_enquiry_contact_fields" ADD CONSTRAINT "subregion_enquiry_contact_fields_subregion_id_subregions_id_fk" FOREIGN KEY ("subregion_id") REFERENCES "public"."subregions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "my_map_regional_discovery_documents" ADD CONSTRAINT "regional_document_version_check" CHECK ("my_map_regional_discovery_documents"."schema_version" = 1);

--> statement-breakpoint
ALTER TABLE "my_map_regional_discovery_documents" ADD CONSTRAINT "regional_document_revision_check" CHECK ("my_map_regional_discovery_documents"."revision" > 0);

--> statement-breakpoint
ALTER TABLE "my_map_regional_discovery_documents" ADD CONSTRAINT "regional_document_config_check" CHECK ((jsonb_typeof("my_map_regional_discovery_documents"."config") = 'object' AND "my_map_regional_discovery_documents"."config" ?& ARRAY['schemaVersion', 'mode', 'includedSubregionIds', 'regionExtent', 'entries'] AND "my_map_regional_discovery_documents"."config"->>'schemaVersion' = '1' AND "my_map_regional_discovery_documents"."config"->>'mode' IN ('compact', 'regional-discovery') AND octet_length("my_map_regional_discovery_documents"."config"::text) <= 65536) IS TRUE);

--> statement-breakpoint
ALTER TABLE "subregion_enquiry_contact_fields" ADD CONSTRAINT "regional_contact_field_check" CHECK ("subregion_enquiry_contact_fields"."field" IN ('email', 'phone'));

--> statement-breakpoint
ALTER TABLE "subregion_enquiry_contact_fields" ADD CONSTRAINT "regional_contact_revision_check" CHECK ("subregion_enquiry_contact_fields"."revision" > 0);

--> statement-breakpoint
ALTER TABLE "subregion_enquiry_contact_fields" ADD CONSTRAINT "regional_contact_provenance_check" CHECK (length(trim("subregion_enquiry_contact_fields"."provenance")) BETWEEN 1 AND 2000);

--> statement-breakpoint
ALTER TABLE "subregion_enquiry_contact_fields" ADD CONSTRAINT "regional_contact_state_check" CHECK (("subregion_enquiry_contact_fields"."status" = 'approved' AND "subregion_enquiry_contact_fields"."value" IS NOT NULL AND length(trim("subregion_enquiry_contact_fields"."value")) > 0 AND "subregion_enquiry_contact_fields"."value_hash" IS NOT NULL AND "subregion_enquiry_contact_fields"."value_hash" ~ '^[0-9a-f]{64}$' AND "subregion_enquiry_contact_fields"."approved_by_user_id" IS NOT NULL AND "subregion_enquiry_contact_fields"."approved_by_user_id" > 0 AND "subregion_enquiry_contact_fields"."approved_at" IS NOT NULL AND "subregion_enquiry_contact_fields"."withdrawn_at" IS NULL AND "subregion_enquiry_contact_fields"."withdrawn_by_user_id" IS NULL AND "subregion_enquiry_contact_fields"."withdrawal_reason" IS NULL) OR ("subregion_enquiry_contact_fields"."status" = 'withdrawn' AND "subregion_enquiry_contact_fields"."value" IS NULL AND "subregion_enquiry_contact_fields"."value_hash" IS NULL AND "subregion_enquiry_contact_fields"."withdrawn_by_user_id" IS NOT NULL AND "subregion_enquiry_contact_fields"."withdrawn_by_user_id" > 0 AND ("subregion_enquiry_contact_fields"."approved_by_user_id" IS NULL OR "subregion_enquiry_contact_fields"."approved_by_user_id" > 0) AND "subregion_enquiry_contact_fields"."withdrawn_at" IS NOT NULL AND "subregion_enquiry_contact_fields"."withdrawal_reason" IS NOT NULL AND length(trim("subregion_enquiry_contact_fields"."withdrawal_reason")) BETWEEN 1 AND 2000));

--> statement-breakpoint
ALTER TABLE "regional_embed_email_grants" ADD CONSTRAINT "regional_email_grant_resource_check" CHECK ("regional_embed_email_grants"."resource_type" IN ('hard', 'soft') AND "regional_embed_email_grants"."resource_id" > 0);

--> statement-breakpoint
ALTER TABLE "regional_embed_email_grants" ADD CONSTRAINT "regional_email_grant_revision_check" CHECK ("regional_embed_email_grants"."revision" > 0);

--> statement-breakpoint
ALTER TABLE "regional_embed_email_grants" ADD CONSTRAINT "regional_email_grant_provenance_check" CHECK (length(trim("regional_embed_email_grants"."provenance")) BETWEEN 1 AND 2000);

--> statement-breakpoint
ALTER TABLE "regional_embed_email_grants" ADD CONSTRAINT "regional_email_grant_state_check" CHECK (("regional_embed_email_grants"."status" = 'approved' AND "regional_embed_email_grants"."approved_original_email" IS NOT NULL AND length(trim("regional_embed_email_grants"."approved_original_email")) > 0 AND "regional_embed_email_grants"."value_hash" IS NOT NULL AND "regional_embed_email_grants"."value_hash" ~ '^[0-9a-f]{64}$' AND "regional_embed_email_grants"."approved_by_user_id" IS NOT NULL AND "regional_embed_email_grants"."approved_by_user_id" > 0 AND "regional_embed_email_grants"."approved_at" IS NOT NULL AND "regional_embed_email_grants"."withdrawn_at" IS NULL AND "regional_embed_email_grants"."withdrawn_by_user_id" IS NULL AND "regional_embed_email_grants"."withdrawal_reason" IS NULL) OR ("regional_embed_email_grants"."status" = 'withdrawn' AND "regional_embed_email_grants"."approved_original_email" IS NULL AND "regional_embed_email_grants"."value_hash" IS NULL AND "regional_embed_email_grants"."withdrawn_by_user_id" IS NOT NULL AND "regional_embed_email_grants"."withdrawn_by_user_id" > 0 AND ("regional_embed_email_grants"."approved_by_user_id" IS NULL OR "regional_embed_email_grants"."approved_by_user_id" > 0) AND "regional_embed_email_grants"."withdrawn_at" IS NOT NULL AND "regional_embed_email_grants"."withdrawal_reason" IS NOT NULL AND length(trim("regional_embed_email_grants"."withdrawal_reason")) BETWEEN 1 AND 2000));
