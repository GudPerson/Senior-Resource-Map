import { and, eq, isNull, or } from 'drizzle-orm';

import { getDb } from '../src/db/index.js';
import { softAssetParents, softAssets } from '../src/db/schema.js';
import { inferSoftAssetBucket } from '../src/utils/softAssetBuckets.js';
import { ensureBoundarySchema } from '../src/utils/boundarySchema.js';

const APPLY = process.argv.includes('--apply');
const INCLUDE_LOW_CONFIDENCE = process.argv.includes('--include-low-confidence');

function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === '';
}

function summarizeConfidence(rows) {
    return rows.reduce((summary, row) => {
        summary.total += 1;
        summary[row.confidence] = (summary[row.confidence] || 0) + 1;
        return summary;
    }, { total: 0, high: 0, low: 0, explicit: 0 });
}

function shouldApply(confidence) {
    if (confidence === 'high' || confidence === 'explicit') return true;
    if (confidence === 'low') return INCLUDE_LOW_CONFIDENCE;
    return false;
}

function formatPreviewRow(row) {
    return {
        kind: row.kind,
        id: row.id,
        name: row.name?.slice(0, 48) || '',
        bucket: row.bucket,
        confidence: row.confidence,
        reason: row.reason,
    };
}

async function main() {
    const db = getDb(process.env);
    await ensureBoundarySchema(db);

    const [parents, softAssetRows] = await Promise.all([
        db.query.softAssetParents.findMany({
            where: and(
                eq(softAssetParents.isDeleted, false),
                or(isNull(softAssetParents.bucket), eq(softAssetParents.bucket, ''))
            ),
            columns: {
                id: true,
                name: true,
                subCategory: true,
                description: true,
                tags: true,
            },
        }),
        db.query.softAssets.findMany({
            where: and(
                eq(softAssets.isDeleted, false),
                or(isNull(softAssets.bucket), eq(softAssets.bucket, ''))
            ),
            columns: {
                id: true,
                name: true,
                assetMode: true,
                parentSoftAssetId: true,
                subCategory: true,
                description: true,
            },
            with: {
                parent: {
                    columns: {
                        id: true,
                        bucket: true,
                        name: true,
                        subCategory: true,
                        description: true,
                        tags: true,
                    },
                },
                tags: {
                    with: {
                        tag: {
                            columns: {
                                name: true,
                            },
                        },
                    },
                },
            },
        }),
    ]);

    const inferredParents = parents.map((parent) => {
        const inferred = inferSoftAssetBucket({
            name: parent.name,
            subCategory: parent.subCategory,
            description: parent.description,
            tags: Array.isArray(parent.tags) ? parent.tags : [],
        });

        return {
            kind: 'template',
            id: parent.id,
            name: parent.name,
            ...inferred,
        };
    });

    const parentBucketLookup = new Map(
        inferredParents.map((parent) => [parent.id, parent])
    );

    const inferredSoftAssets = softAssetRows.map((asset) => {
        const parentAssignment = asset.parentSoftAssetId ? parentBucketLookup.get(asset.parentSoftAssetId) : null;
        if (asset.parentSoftAssetId && asset.parent) {
            const inheritedBucket = !isBlank(asset.parent.bucket)
                ? { bucket: asset.parent.bucket, confidence: 'explicit', reason: 'parent-explicit' }
                : parentAssignment;

            if (inheritedBucket) {
                return {
                    kind: asset.assetMode === 'child' ? 'child' : 'offering',
                    id: asset.id,
                    name: asset.name,
                    ...inheritedBucket,
                };
            }
        }

        const inferred = inferSoftAssetBucket({
            name: asset.name,
            subCategory: asset.subCategory,
            description: asset.description,
            tags: asset.tags.map((entry) => entry.tag.name),
        });

        return {
            kind: asset.assetMode === 'child' ? 'child' : 'offering',
            id: asset.id,
            name: asset.name,
            ...inferred,
        };
    });

    const parentSummary = summarizeConfidence(inferredParents);
    const assetSummary = summarizeConfidence(inferredSoftAssets);

    console.log(`Soft-asset bucket backfill mode: ${APPLY ? 'APPLY' : 'DRY RUN'}${INCLUDE_LOW_CONFIDENCE ? ' (including low confidence)' : ''}`);
    console.log('Missing template buckets:', parentSummary);
    console.log('Missing soft-asset buckets:', assetSummary);

    const lowConfidenceRows = [...inferredParents, ...inferredSoftAssets].filter((row) => row.confidence === 'low');
    if (lowConfidenceRows.length > 0) {
        console.log('\nLow-confidence candidates (first 20):');
        console.table(lowConfidenceRows.slice(0, 20).map(formatPreviewRow));
    }

    if (!APPLY) {
        console.log('\nDry run only. Re-run with --apply to write the inferred buckets.');
        if (lowConfidenceRows.length > 0) {
            console.log('Add --include-low-confidence if you want default-fallback Programme assignments written too.');
        }
        return;
    }

    let updatedParents = 0;
    for (const row of inferredParents) {
        if (!shouldApply(row.confidence)) continue;
        await db.update(softAssetParents)
            .set({ bucket: row.bucket, updatedAt: new Date() })
            .where(eq(softAssetParents.id, row.id));
        updatedParents += 1;
    }

    let updatedSoftAssets = 0;
    for (const row of inferredSoftAssets) {
        if (!shouldApply(row.confidence)) continue;
        await db.update(softAssets)
            .set({ bucket: row.bucket, updatedAt: new Date() })
            .where(eq(softAssets.id, row.id));
        updatedSoftAssets += 1;
    }

    console.log(`\nUpdated ${updatedParents} templates and ${updatedSoftAssets} soft assets.`);
    if (lowConfidenceRows.length > 0 && !INCLUDE_LOW_CONFIDENCE) {
        console.log(`${lowConfidenceRows.length} low-confidence records were left unchanged for manual review.`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
