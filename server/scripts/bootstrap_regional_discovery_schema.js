import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { getDb } from '../src/db/index.js';
import { executeAtomicBatch } from '../src/utils/atomicWrites.js';
import { verifyRegionalDiscoverySchema } from '../src/utils/regionalDiscoverySchema.js';

// Read-only by default. --apply is a separate, explicitly authorised release
// action against the operator-selected environment, never a request-path repair.
async function main() {
    const flags = process.argv.slice(2);
    if (flags.some(flag => !['--verify', '--apply'].includes(flag)) || (flags.includes('--apply') && flags.includes('--verify'))) throw new Error('Use --verify (default), or separately authorised --apply.');
    const db = getDb();
    if (flags.includes('--apply')) {
        const migration = await readFile(new URL('../drizzle/0011_regional_discovery.sql', import.meta.url), 'utf8');
        const statements = migration.split('--> statement-breakpoint').map(statement => statement.trim()).filter(Boolean);
        await executeAtomicBatch(db, statements.map(statement => db.execute(sql.raw(statement))), 'regional discovery schema installation');
    }
    const verified = await verifyRegionalDiscoverySchema(db);
    console.log(`Regional discovery schema verified (${verified.tables.length} isolated tables).`);
}

main().catch(() => {
    // Connection strings, database errors and credentials must not enter output.
    console.error('Regional discovery schema operation failed. Check the selected environment and reviewed migration prerequisites.');
    process.exitCode = 1;
});
