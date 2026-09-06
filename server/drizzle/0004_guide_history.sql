CREATE TABLE IF NOT EXISTS "guide_conversations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"owner_user_id" integer NOT NULL,
	"slot" integer NOT NULL,
	"title" varchar(120) NOT NULL,
	"inputs" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"last_request_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guide_conversations_slot_check" CHECK ("slot" BETWEEN 0 AND 19),
	CONSTRAINT "guide_conversations_revision_check" CHECK ("revision" > 0),
	CONSTRAINT "guide_conversations_inputs_check" CHECK (jsonb_typeof("inputs") = 'array' AND jsonb_array_length("inputs") BETWEEN 1 AND 20 AND octet_length("inputs"::text) <= 60000)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guide_conversations" ADD CONSTRAINT "guide_conversations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guide_conversations_owner_slot_unique" ON "guide_conversations" ("owner_user_id","slot");
