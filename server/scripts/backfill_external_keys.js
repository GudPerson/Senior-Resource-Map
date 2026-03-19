import { and, eq, isNull, or } from 'drizzle-orm';

import { getDb } from '../src/db/index.js';
import { hardAssets, softAssetParents, softAssets } from '../src/db/schema.js';
import { ensureBoundarySchema } from '../src/utils/boundarySchema.js';
import { buildChildExternalKey, resolveOrCreateExternalKey } from '../src/utils/externalKeys.js';

const APPLY = process.argv.includes('--apply');

async function main() {
    const db = getDb(process.env);
    await ensureBoundarySchema(db);

    const [hardRows, templateRows, softRows] = await Promise.all([
        db.query.hardAssets.findMany({
            where: and(eq(hardAssets.isDeleted, false), or(isNull(hardAssets.externalKey), eq(hardAssets.externalKey, ''))),
            columns: { id: true, name: true },
        }),
        db.query.softAssetParents.findMany({
            where: and(eq(softAssetParents.isDeleted, false), or(isNull(softAssetParents.externalKey), eq(softAssetParents.externalKey, ''))),
            columns: { id: true, name: true },
        }),
        db.query.softAssets.findMany({
            where: and(eq(softAssets.isDeleted, false), or(isNull(softAssets.externalKey), eq(softAssets.externalKey, ''))),
            columns: {
                id: true,
                name: true,
                assetMode: true,
                parentSoftAssetId: true,
                hostHardAssetId: true,
            },
            with: {
                parent: { columns: { id: true, externalKey: true, name: true } },
                hostHardAsset: { columns: { id: true, externalKey: true, name: true } },
            },
        }),
    ]);

    console.log(`Missing place keys: ${hardRows.length}`);
    console.log(`Missing template keys: ${templateRows.length}`);
    console.log(`Missing offering keys: ${softRows.length}`);

    if (!APPLY) {
        console.log('Dry run only. Re-run with --apply to write keys.');
        return;
    }

    for (const row of hardRows) {
        const externalKey = await resolveOrCreateExternalKey(db, hardAssets, hardAssets.externalKey, {
            prefix: 'place',
            name: row.name,
        });
        await db.update(hardAssets).set({ externalKey }).where(eq(hardAssets.id, row.id));
    }

    for (const row of templateRows) {
        const externalKey = await resolveOrCreateExternalKey(db, softAssetParents, softAssetParents.externalKey, {
            prefix: 'template',
            name: row.name,
        });
        await db.update(softAssetParents).set({ externalKey }).where(eq(softAssetParents.id, row.id));
    }

    for (const row of softRows) {
        const requestedKey = row.assetMode === 'child' && row.parent?.externalKey && row.hostHardAsset?.externalKey
            ? buildChildExternalKey(row.parent.externalKey, row.hostHardAsset.externalKey)
            : null;

        const externalKey = await resolveOrCreateExternalKey(db, softAssets, softAssets.externalKey, {
            requestedKey,
            prefix: row.assetMode === 'child' ? 'rollout' : 'offering',
            name: row.name,
        });
        await db.update(softAssets).set({ externalKey }).where(eq(softAssets.id, row.id));
    }

    console.log('External keys backfilled.');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
