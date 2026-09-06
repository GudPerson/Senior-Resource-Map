CREATE TABLE IF NOT EXISTS "support_conversations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"owner_user_id" integer,
	"guest_token_hash" varchar(64),
	"guest_expires_at" timestamp with time zone,
	"title" varchar(120) NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"revision" integer DEFAULT 2 NOT NULL,
	"user_read_sequence" integer DEFAULT 1 NOT NULL,
	"staff_read_sequence" integer DEFAULT 0 NOT NULL,
	"current_proposal_id" varchar(36),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_conversations_owner_check" CHECK (("owner_user_id" IS NOT NULL AND "guest_token_hash" IS NULL AND "guest_expires_at" IS NULL) OR ("owner_user_id" IS NULL AND "guest_token_hash" IS NOT NULL AND "guest_expires_at" IS NOT NULL)),
	CONSTRAINT "support_conversations_status_check" CHECK ("status" IN ('open', 'in_progress', 'awaiting_user', 'fix_available', 'resolved')),
	CONSTRAINT "support_conversations_read_check" CHECK ("revision" >= 2 AND "user_read_sequence" BETWEEN 0 AND "revision" AND "staff_read_sequence" BETWEEN 0 AND "revision")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_fix_proposals" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"conversation_id" varchar(36) NOT NULL,
	"source_revision" varchar(40) NOT NULL,
	"target" varchar(10) NOT NULL,
	"summary" text NOT NULL,
	"test_evidence" text NOT NULL,
	"proposed_by_user_id" integer,
	"approved_by_user_id" integer,
	"approved_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"release_evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_fix_proposals_target_check" CHECK ("target" IN ('client', 'server', 'both')),
	CONSTRAINT "support_fix_proposals_revision_check" CHECK ("source_revision" ~ '^[a-f0-9]{40}$'),
	CONSTRAINT "support_fix_proposals_verification_check" CHECK ("verified_at" IS NULL OR ("approved_at" IS NOT NULL AND "release_evidence" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_messages" (
	"conversation_id" varchar(36) NOT NULL,
	"sequence" integer NOT NULL,
	"request_key" varchar(100) NOT NULL,
	"author_kind" varchar(20) NOT NULL,
	"author_user_id" integer,
	"body" text NOT NULL,
	"event_type" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_messages_conversation_id_sequence_pk" PRIMARY KEY("conversation_id","sequence"),
	CONSTRAINT "support_messages_author_check" CHECK ("author_kind" IN ('user', 'staff', 'system')),
	CONSTRAINT "support_messages_sequence_check" CHECK ("sequence" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_fix_proposals" ADD CONSTRAINT "support_fix_proposals_conversation_id_support_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."support_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_fix_proposals" ADD CONSTRAINT "support_fix_proposals_proposed_by_user_id_users_id_fk" FOREIGN KEY ("proposed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_fix_proposals" ADD CONSTRAINT "support_fix_proposals_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversation_id_support_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."support_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_conversations_owner_updated_idx" ON "support_conversations" ("owner_user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_conversations_status_updated_idx" ON "support_conversations" ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_conversations_guest_hash_unique" ON "support_conversations" ("guest_token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_fix_proposals_conversation_idx" ON "support_fix_proposals" ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_messages_request_unique" ON "support_messages" ("conversation_id","request_key");
