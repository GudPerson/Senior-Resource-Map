import { neon } from '@neondatabase/serverless';

const sql = neon("postgresql://neondb_owner:npg_I4FfmdV3sxwY@ep-patient-grass-aixppnyq-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");

async function run() {
    console.log("Creating user_subregions table...");
    await sql`CREATE TABLE IF NOT EXISTS user_subregions (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subregion_id INTEGER NOT NULL REFERENCES subregions(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, subregion_id)
    )`;

    console.log("Migrating existing subregions...");
    /* await sql`
        INSERT INTO user_subregions (user_id, subregion_id)
        SELECT id, subregion_id FROM users WHERE subregion_id IS NOT NULL
        ON CONFLICT (user_id, subregion_id) DO NOTHING
    `;*/

    console.log("Dropping old column...");
    await sql`ALTER TABLE users DROP COLUMN IF EXISTS subregion_id`;

    console.log("Dropping composite primary key to avoid drizzle-kit crash...");
    await sql`ALTER TABLE user_subregions DROP CONSTRAINT IF EXISTS user_subregions_pkey`;

    console.log("Migration done!");
}

run().catch(console.error);
