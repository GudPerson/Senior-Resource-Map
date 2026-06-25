import { tags, hardAssetTags, softAssetTags } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

/**
 * Syncs tags for an asset using any drizzle executor with select/insert/delete methods.
 * This intentionally works with the neon-http driver, which does not support transactions.
 */
export async function syncAssetTags(tx, assetId, assetType, newTags) {
    if (!newTags) return;

    const normalizedTags = [...new Set(newTags
        .map((tag) => String(tag || '').trim().toLowerCase())
        .filter(Boolean))];

    // Remove existing mappings
    if (assetType === 'hard') {
        await tx.delete(hardAssetTags).where(eq(hardAssetTags.hardAssetId, assetId));
    } else if (assetType === 'soft') {
        await tx.delete(softAssetTags).where(eq(softAssetTags.softAssetId, assetId));
    }

    if (normalizedTags.length === 0) return;

    const existingTags = await tx.select().from(tags).where(inArray(tags.name, normalizedTags));
    const existingNames = new Set(existingTags.map((tag) => tag.name));
    const missingTagValues = normalizedTags
        .filter((tag) => !existingNames.has(tag))
        .map((name) => ({ name }));

    if (missingTagValues.length > 0) {
        await tx.insert(tags).values(missingTagValues).onConflictDoNothing();
    }

    const syncedTags = await tx.select().from(tags).where(inArray(tags.name, normalizedTags));
    const tagIdsByName = new Map(syncedTags.map((tag) => [tag.name, tag.id]));

    const mappingValues = normalizedTags
        .map((name) => tagIdsByName.get(name))
        .filter((tagId) => Number.isInteger(tagId))
        .map((tagId) => {
            if (assetType === 'hard') {
                return {
                    hardAssetId: assetId,
                    tagId,
                };
            }
            return {
                softAssetId: assetId,
                tagId,
            };
        });

    if (mappingValues.length === 0) return;

    if (assetType === 'hard') {
        await tx.insert(hardAssetTags).values(mappingValues);
    } else if (assetType === 'soft') {
        await tx.insert(softAssetTags).values(mappingValues);
    }
}
