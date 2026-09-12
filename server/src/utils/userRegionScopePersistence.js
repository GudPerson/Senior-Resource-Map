import { eq } from 'drizzle-orm';
import { userSubregions } from '../db/schema.js';
import { buildReplacementQueries, executeAtomicBatch } from './atomicWrites.js';

export async function replaceUserRegionScope(db, userId, subregionIds) {
    const replacementQueries = buildReplacementQueries(
        db,
        userSubregions,
        eq(userSubregions.userId, userId),
        subregionIds.map((subregionId) => ({ userId, subregionId })),
    );
    await executeAtomicBatch(db, replacementQueries, 'Admin region scope replacement');
}
