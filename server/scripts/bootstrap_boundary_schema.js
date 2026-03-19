import { getDb } from '../src/db/index.js';
import { ensureBoundarySchema } from '../src/utils/boundarySchema.js';

async function main() {
    const db = getDb();
    await ensureBoundarySchema(db, { NODE_ENV: 'production', ALLOW_RUNTIME_SCHEMA_BOOTSTRAP: 'true' });
    console.log('Boundary schema bootstrap completed.');
}

main().catch((error) => {
    console.error('Boundary schema bootstrap failed:', error);
    process.exitCode = 1;
});
