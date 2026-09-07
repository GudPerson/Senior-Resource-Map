CREATE TABLE IF NOT EXISTS "region_postal_codes" (
	"region_id" integer NOT NULL,
	"postal_code" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "region_postal_codes_region_id_postal_code_pk" PRIMARY KEY("region_id","postal_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "region_subregions" (
	"region_id" integer NOT NULL,
	"subregion_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "region_subregions_region_id_subregion_id_pk" PRIMARY KEY("region_id","subregion_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "regions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unmapped_postal_codes" (
	"postal_code" varchar(20) PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "region_postal_codes" ADD CONSTRAINT "region_postal_codes_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "region_subregions" ADD CONSTRAINT "region_subregions_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "region_subregions" ADD CONSTRAINT "region_subregions_subregion_id_subregions_id_fk" FOREIGN KEY ("subregion_id") REFERENCES "public"."subregions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "region_postal_codes_postal_code_unique" ON "region_postal_codes" ("postal_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "region_subregions_subregion_unique" ON "region_subregions" ("subregion_id");