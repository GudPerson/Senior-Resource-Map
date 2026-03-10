import { sql } from 'drizzle-orm';

let ensureBoundarySchemaPromise = null;

export async function ensureBoundarySchema(db) {
    if (!ensureBoundarySchemaPromise) {
        ensureBoundarySchemaPromise = (async () => {
            await db.execute(sql`ALTER TABLE subregions ADD COLUMN IF NOT EXISTS postal_patterns TEXT NOT NULL DEFAULT ''`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20) NOT NULL DEFAULT ''`);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS subregion_postal_codes (
                    subregion_id INTEGER NOT NULL REFERENCES subregions(id) ON DELETE CASCADE,
                    postal_code VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (subregion_id, postal_code)
                )
            `);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS subregion_postal_codes_subregion_idx ON subregion_postal_codes (subregion_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS subregion_postal_codes_postal_idx ON subregion_postal_codes (postal_code)`);
        })().catch((err) => {
            ensureBoundarySchemaPromise = null;
            throw err;
        });
    }

    await ensureBoundarySchemaPromise;
}
