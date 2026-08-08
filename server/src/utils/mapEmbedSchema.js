import { sql } from 'drizzle-orm';

export const MAP_EMBED_SCHEMA_COLUMNS = Object.freeze([
    'embed_enabled',
    'embed_allowed_origins',
]);

export async function ensureMapEmbedSchema(db) {
    await db.execute(sql`ALTER TABLE my_maps ADD COLUMN IF NOT EXISTS embed_enabled BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE my_maps ADD COLUMN IF NOT EXISTS embed_allowed_origins JSONB NOT NULL DEFAULT '[]'::jsonb`);
}

export async function verifyMapEmbedSchema(db) {
    const result = await db.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'my_maps'
          AND column_name IN ('embed_enabled', 'embed_allowed_origins')
    `);
    const rows = Array.isArray(result) ? result : (result?.rows || []);
    const available = new Set(rows.map((row) => String(row?.column_name || '')));
    const missing = MAP_EMBED_SCHEMA_COLUMNS.filter((column) => !available.has(column));
    if (missing.length > 0) {
        throw new Error(`Map embed schema verification failed: missing ${missing.join(', ')}`);
    }
    return { columns: [...MAP_EMBED_SCHEMA_COLUMNS] };
}
