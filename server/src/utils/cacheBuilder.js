import { sql } from 'drizzle-orm';
import db from '../db/index.js';
import { dataStore } from './dataStore.js';

/**
 * Rebuilds the edge cache JSON for a specific subregion
 * @param {number|string} subregionId - The ID of the region to update
 */
export const rebuildMapCache = async (subregionId) => {
    if (!subregionId) {
        console.error("rebuildMapCache requires a subregionId");
        return;
    }

    try {
        // Fetch stripped payload (only essential map data) for both asset types
        const query = subregionId === 'all'
            ? sql`
                SELECT id, name as title, sub_category as category, lat, lng, 'hard' as asset_type 
                FROM hard_assets 
                WHERE is_deleted = false
                UNION ALL
                SELECT s.id, s.name as title, s.sub_category as category, l.lat, l.lng, 'soft' as asset_type 
                FROM soft_assets s
                LEFT JOIN soft_asset_locations sl ON s.id = sl.soft_asset_id
                LEFT JOIN hard_assets l ON sl.hard_asset_id = l.id
                WHERE s.is_deleted = false
            `
            : sql`
                SELECT id, name as title, sub_category as category, lat, lng, 'hard' as asset_type 
                FROM hard_assets 
                WHERE subregion_id = ${subregionId} 
                  AND is_deleted = false
                UNION ALL
                SELECT s.id, s.name as title, s.sub_category as category, l.lat, l.lng, 'soft' as asset_type 
                FROM soft_assets s
                LEFT JOIN soft_asset_locations sl ON s.id = sl.soft_asset_id
                LEFT JOIN hard_assets l ON sl.hard_asset_id = l.id
                WHERE s.subregion_id = ${subregionId} 
                  AND s.is_deleted = false
            `;

        const { rows } = await db.execute(query);

        // Push to Edge Storage
        const blobKey = `locations-cache-region-${subregionId}.json`;

        await dataStore.setJSON(blobKey, rows);
        console.log(`✅ Edge cache updated for subregion ${subregionId}: ${blobKey}`);

        // Always rebuild the global 'all' cache when a specific subregion is updated
        if (subregionId !== 'all') {
            await rebuildMapCache('all');
        }

    } catch (error) {
        console.error(`❌ Failed to rebuild map cache for region ${subregionId}:`, error.message);
    }
};
