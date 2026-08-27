-- Fail without exposing identifier values if legacy case variants would make
-- either normalized unique index unsafe to create.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "users" GROUP BY lower("username") HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Normalized username index blocked by case-insensitive duplicates.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM "users" GROUP BY lower("email") HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Normalized email index blocked by case-insensitive duplicates.';
    END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_normalized_unique" ON "users" (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_normalized_unique" ON "users" (lower("email"));
