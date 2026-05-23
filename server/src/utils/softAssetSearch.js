import { ilike, or, sql } from 'drizzle-orm';

import { softAssets } from '../db/schema.js';

export function normalizeSoftAssetSearchTerm(value) {
    return String(value || '').trim();
}

export function buildSoftAssetSearchWhere(query) {
    const term = normalizeSoftAssetSearchTerm(query);
    if (!term) return null;

    const pattern = `%${term}%`;
    return or(
        ilike(softAssets.name, pattern),
        ilike(softAssets.description, pattern),
        ilike(softAssets.subCategory, pattern),
        sql`EXISTS (
            SELECT 1
            FROM hard_assets search_host
            WHERE search_host.id = ${softAssets.hostHardAssetId}
              AND search_host.is_deleted = false
              AND (
                search_host.name ILIKE ${pattern}
                OR search_host.address ILIKE ${pattern}
                OR search_host.postal_code ILIKE ${pattern}
              )
        )`,
        sql`EXISTS (
            SELECT 1
            FROM soft_asset_locations search_link
            INNER JOIN hard_assets search_location
                ON search_location.id = search_link.hard_asset_id
            WHERE search_link.soft_asset_id = ${softAssets.id}
              AND search_location.is_deleted = false
              AND (
                search_location.name ILIKE ${pattern}
                OR search_location.address ILIKE ${pattern}
                OR search_location.postal_code ILIKE ${pattern}
              )
        )`,
    );
}
