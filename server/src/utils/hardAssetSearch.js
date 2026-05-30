import { ilike, or, sql } from 'drizzle-orm';

import { hardAssets } from '../db/schema.js';

export function normalizeHardAssetSearchTerm(value) {
    return String(value || '').trim();
}

export function buildHardAssetSearchWhere(query) {
    const term = normalizeHardAssetSearchTerm(query);
    if (!term) return null;

    const pattern = `%${term}%`;
    return or(
        ilike(hardAssets.name, pattern),
        ilike(hardAssets.subCategory, pattern),
        ilike(hardAssets.address, pattern),
        ilike(hardAssets.postalCode, pattern),
        ilike(hardAssets.description, pattern),
        sql`EXISTS (
            SELECT 1
            FROM hard_asset_tags search_hard_tag
            INNER JOIN tags search_tag
                ON search_tag.id = search_hard_tag.tag_id
            WHERE search_hard_tag.hard_asset_id = ${hardAssets.id}
              AND search_tag.name ILIKE ${pattern}
        )`,
    );
}
