import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { count } from 'drizzle-orm';

import { getDb } from '../src/db/index.js';
import { ensureBoundarySchema } from '../src/utils/boundarySchema.js';
import { buildCleanSlatePlan, parseCleanSlateFlags, summarizeCleanSlatePlan } from '../src/utils/cleanSlate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.resolve(__dirname, '../output/clean-slate-backups');

function printHeader(title) {
    console.log(`\n${title}`);
    console.log('-'.repeat(title.length));
}

async function countTableRows(db, table) {
    const [row] = await db.select({ count: count() }).from(table);
    return Number(row?.count ?? 0);
}

async function collectResetCounts(db, plan) {
    const counts = [];
    for (const config of plan.reset) {
        counts.push({
            key: config.key,
            label: config.label,
            rows: await countTableRows(db, config.table),
        });
    }
    return counts;
}

async function collectBackupSnapshot(db, plan) {
    const snapshot = {};

    for (const config of plan.reset) {
        snapshot[config.key] = await db.select().from(config.table);
    }

    return snapshot;
}

function writeBackupFile(plan, counts, snapshot) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(BACKUP_DIR, `clean-slate-backup-${timestamp}.json`);

    writeFileSync(filePath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        plan: summarizeCleanSlatePlan(plan),
        counts,
        snapshot,
    }, null, 2));

    return filePath;
}

async function main() {
    const flags = parseCleanSlateFlags();
    const plan = buildCleanSlatePlan(flags);
    const db = getDb(process.env);
    await ensureBoundarySchema(db);

    const counts = await collectResetCounts(db, plan);

    printHeader('Clean-Slate Reset Plan');
    console.table(counts.map((entry) => ({
        table: entry.label,
        rows: entry.rows,
    })));

    if (!flags.apply) {
        console.log('\nDry-run only. Re-run with --apply to write a backup snapshot and delete these rows.');
        console.log('Example: node --env-file=server/.env server/scripts/reset_clean_slate.js --apply');
        console.log('Optional flags: --include-audience-zones --include-partner-boundaries --include-subregion-postcodes --include-subcategories');
        return;
    }

    printHeader('Creating Backup Snapshot');
    const snapshot = await collectBackupSnapshot(db, plan);
    const backupPath = writeBackupFile(plan, counts, snapshot);
    console.log(`Backup written to ${backupPath}`);

    printHeader('Deleting Rows');
    for (const config of plan.reset) {
        await db.delete(config.table);
        console.log(`Cleared ${config.label}`);
    }

    console.log('\nReset complete.');
    console.log(`Backup file: ${backupPath}`);
    console.log('Note: guest/public map cache may still need a rebuild in the live Worker environment.');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
