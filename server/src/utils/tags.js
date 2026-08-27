import { tags, hardAssetTags, softAssetTags } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { buildReplacementQueries, executeAtomicBatch } from './atomicWrites.js';

export function normalizeAssetTags(newTags = []) {
    return [...new Set((Array.isArray(newTags) ? newTags : [])
        .map((tag) => String(tag || '').trim().toLowerCase())
        .filter(Boolean))];
}

/**
 * Ensures the shared tag vocabulary exists before the resource transaction.
 * A tag row is harmless if the later resource batch fails; the resource's
 * current mappings are not changed until the atomic batch commits.
 */
export async function prepareAssetTagIds(db, newTags = []) {
    const normalizedTags = normalizeAssetTags(newTags);
    if (normalizedTags.length === 0) return [];

    await db.insert(tags)
        .values(normalizedTags.map((name) => ({ name })))
        .onConflictDoNothing();

    const syncedTags = await db
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(inArray(tags.name, normalizedTags));
    const idsByName = new Map(syncedTags.map((tag) => [tag.name, tag.id]));
    const tagIds = normalizedTags.map((name) => idsByName.get(name));
    if (tagIds.some((tagId) => !Number.isInteger(tagId))) {
        throw new Error('One or more tags could not be prepared for saving.');
    }
    return tagIds;
}

export function buildAssetTagReplacementQueries(db, assetId, assetType, tagIds = []) {
    if (assetType === 'hard') {
        return buildReplacementQueries(
            db,
            hardAssetTags,
            eq(hardAssetTags.hardAssetId, assetId),
            tagIds.map((tagId) => ({ hardAssetId: assetId, tagId })),
        );
    }
    if (assetType === 'soft') {
        return buildReplacementQueries(
            db,
            softAssetTags,
            eq(softAssetTags.softAssetId, assetId),
            tagIds.map((tagId) => ({ softAssetId: assetId, tagId })),
        );
    }
    throw new Error(`Unsupported asset tag type: ${assetType}`);
}

/**
 * Syncs one asset's mappings through Neon HTTP's atomic batch transaction.
 */
export async function syncAssetTags(tx, assetId, assetType, newTags) {
    if (!newTags) return;
    const tagIds = await prepareAssetTagIds(tx, newTags);
    await executeAtomicBatch(
        tx,
        buildAssetTagReplacementQueries(tx, assetId, assetType, tagIds),
        `${assetType} asset tag replacement`,
    );
}
