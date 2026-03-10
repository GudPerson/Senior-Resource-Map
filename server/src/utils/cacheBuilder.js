import { sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { dataStore } from './dataStore.js';

/**
 * Rebuilds the edge cache JSON for a specific subregion
 * @param {number|string} subregionId - The ID of the region to update
 * @param {object} envVars - Edge environment variables context
 */
export const rebuildMapCache = async (subregionId, envVars) => {
    if (!subregionId) {
        console.error("rebuildMapCache requires a subregionId");
        return;
    }

    try {
        const db = getDb(envVars);
        const query = subregionId === 'all'
            ? sql`
                SELECT id, name as title, sub_category as category, lat, lng, 'hard' as asset_type 
                FROM hard_assets 
                WHERE is_deleted = false
                  AND is_hidden = false
                  AND lat IS NOT NULL
                  AND lng IS NOT NULL
                UNION ALL
                SELECT s.id, s.name as title, s.sub_category as category, l.lat, l.lng, 'soft' as asset_type 
                FROM soft_assets s
                INNER JOIN soft_asset_locations sl ON s.id = sl.soft_asset_id
                INNER JOIN hard_assets l ON sl.hard_asset_id = l.id
                WHERE s.is_deleted = false
                  AND s.is_hidden = false
                  AND s.is_member_only = false
                  AND s.audience_mode = 'public'
                  AND l.is_deleted = false
                  AND l.is_hidden = false
                  AND l.lat IS NOT NULL
                  AND l.lng IS NOT NULL
            `
            : sql`
                SELECT id, name as title, sub_category as category, lat, lng, 'hard' as asset_type 
                FROM hard_assets 
                WHERE subregion_id = ${subregionId} 
                  AND is_deleted = false
                  AND is_hidden = false
                  AND lat IS NOT NULL
                  AND lng IS NOT NULL
                UNION ALL
                SELECT s.id, s.name as title, s.sub_category as category, l.lat, l.lng, 'soft' as asset_type 
                FROM soft_assets s
                INNER JOIN soft_asset_locations sl ON s.id = sl.soft_asset_id
                INNER JOIN hard_assets l ON sl.hard_asset_id = l.id
                WHERE s.subregion_id = ${subregionId} 
                  AND s.is_deleted = false
                  AND s.is_hidden = false
                  AND s.is_member_only = false
                  AND s.audience_mode = 'public'
                  AND l.is_deleted = false
                  AND l.is_hidden = false
                  AND l.lat IS NOT NULL
                  AND l.lng IS NOT NULL
            `;

        const { rows } = await db.execute(query);

        const blobKey = `locations-cache-region-${subregionId}.json`;
        await dataStore.setJSON(blobKey, rows, envVars);
        console.log(`✅ Edge cache updated for subregion ${subregionId}: ${blobKey}`);

        if (subregionId !== 'all') {
            await rebuildMapCache('all', envVars);
        }

    } catch (error) {
        console.error(`❌ Failed to rebuild map cache for region ${subregionId}:`, error.message);
    }
};
