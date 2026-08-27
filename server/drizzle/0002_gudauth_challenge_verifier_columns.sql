ALTER TABLE "phone_login_attempts" ADD COLUMN IF NOT EXISTS "provider_challenge_verifier" varchar(128);--> statement-breakpoint
ALTER TABLE "phone_verification_attempts" ADD COLUMN IF NOT EXISTS "provider_challenge_verifier" varchar(128);
