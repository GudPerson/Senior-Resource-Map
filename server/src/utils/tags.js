import { tags, hardAssetTags, softAssetTags } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Syncs tags for an asset using any drizzle executor with select/insert/delete methods.
 * This intentionally works with the neon-http driver, which does not support transactions.
 */
export async function syncAssetTags(tx, assetId, assetType, newTags) {
    if (!newTags) return;

    // Remove existing mappings
    if (assetType === 'hard') {
        await tx.delete(hardAssetTags).where(eq(hardAssetTags.hardAssetId, assetId));
    } else if (assetType === 'soft') {
        await tx.delete(softAssetTags).where(eq(softAssetTags.softAssetId, assetId));
    }

    if (newTags.length === 0) return;

    // Map new tags
    for (const t of newTags) {
        const normalizedTag = t.trim().toLowerCase();
        if (!normalizedTag) continue;

        let [existingTag] = await tx.select().from(tags).where(eq(tags.name, normalizedTag));
        if (!existingTag) {
            [existingTag] = await tx.insert(tags).values({ name: normalizedTag }).returning();
        }

        if (assetType === 'hard') {
            await tx.insert(hardAssetTags).values({
                hardAssetId: assetId,
                tagId: existingTag.id
            });
        } else if (assetType === 'soft') {
            await tx.insert(softAssetTags).values({
                softAssetId: assetId,
                tagId: existingTag.id
            });
        }
    }
}
