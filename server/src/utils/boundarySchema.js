import { sql } from 'drizzle-orm';

let ensureBoundarySchemaPromise = null;

export async function ensureBoundarySchema(db) {
    if (!ensureBoundarySchemaPromise) {
        ensureBoundarySchemaPromise = (async () => {
            await db.execute(sql`ALTER TABLE subregions ADD COLUMN IF NOT EXISTS postal_patterns TEXT NOT NULL DEFAULT ''`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20) NOT NULL DEFAULT ''`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS users_manager_user_idx ON users (manager_user_id)`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS audience_mode VARCHAR(40) NOT NULL DEFAULT 'public'`);
            await db.execute(sql`ALTER TABLE hard_assets ALTER COLUMN partner_id DROP NOT NULL`);
            await db.execute(sql`ALTER TABLE soft_assets ALTER COLUMN partner_id DROP NOT NULL`);
            await db.execute(sql`UPDATE hard_assets SET created_by_user_id = partner_id WHERE created_by_user_id IS NULL`);
            await db.execute(sql`UPDATE soft_assets SET created_by_user_id = partner_id WHERE created_by_user_id IS NULL`);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS subregion_postal_codes (
                    subregion_id INTEGER NOT NULL REFERENCES subregions(id) ON DELETE CASCADE,
                    postal_code VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (subregion_id, postal_code)
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS partner_postal_codes (
                    partner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    postal_code VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (partner_user_id, postal_code)
                )
            `);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS subregion_postal_codes_subregion_idx ON subregion_postal_codes (subregion_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS subregion_postal_codes_postal_idx ON subregion_postal_codes (postal_code)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_postal_codes_partner_idx ON partner_postal_codes (partner_user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_postal_codes_postal_idx ON partner_postal_codes (postal_code)`);
        })().catch((err) => {
            ensureBoundarySchemaPromise = null;
            throw err;
        });
    }

    await ensureBoundarySchemaPromise;
}
