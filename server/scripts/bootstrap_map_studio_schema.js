import { getDb } from '../src/db/index.js';
import { ensureMapStudioSchema, verifyMapStudioSchema } from '../src/utils/mapStudioSchema.js';

async function main() {
    const db = getDb();
    await ensureMapStudioSchema(db);
    const verified = await verifyMapStudioSchema(db);
    console.log(`Map Studio schema bootstrap completed (${verified.columns.length} columns verified).`);
}

main().catch((error) => {
    console.error('Map Studio schema bootstrap failed:', error);
    process.exitCode = 1;
});
