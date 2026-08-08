import { getDb } from '../src/db/index.js';
import { ensureMapEmbedSchema, verifyMapEmbedSchema } from '../src/utils/mapEmbedSchema.js';

async function main() {
    const db = getDb();
    await ensureMapEmbedSchema(db);
    const verified = await verifyMapEmbedSchema(db);
    console.log(`Map embed schema bootstrap completed (${verified.columns.length} columns verified).`);
}

main().catch((error) => {
    console.error('Map embed schema bootstrap failed:', error);
    process.exitCode = 1;
});
