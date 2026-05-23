import { sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { dataStore } from './dataStore.js';

export const MAP_CACHE_SCHEMA_VERSION = 5;

/**
 * Rebuilds the edge cache JSON for a specific subregion
 * @param {number|string} subregionId - The ID of the region to update
 * @param {object} envVars - Edge environment variables context
 */
export function buildMapCacheQuery(subregionId) {
    return subregionId === 'all'
        ? sql`
            SELECT
                h.id,
                h.name as title,
                h.sub_category as category,
                h.description,
                h.lat,
                h.lng,
                'hard' as asset_type,
                h.address,
                h.postal_code,
                h.logo_url,
                h.banner_url,
                h.updated_at,
                h.phone,
                h.whatsapp_contact,
                h.website,
                h.hours,
                NULL::text as schedule,
                NULL::text as bucket,
                NULL::boolean as availability_enabled,
                NULL::integer as availability_count,
                NULL::text as availability_unit,
                h.id as location_hard_asset_id,
                h.name as location_name,
                h.address as location_address,
                h.postal_code as location_postal_code,
                h.whatsapp_contact as location_whatsapp_contact,
                COALESCE((
                    SELECT jsonb_agg(t.name ORDER BY t.name)
                    FROM hard_asset_tags hat
                    INNER JOIN tags t ON t.id = hat.tag_id
                    WHERE hat.hard_asset_id = h.id
                ), '[]'::jsonb) as tags,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'hard'
                      AND rt.resource_id = h.id
                ), '{}'::jsonb) as translations,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'hard'
                      AND rt.resource_id = h.id
                ), '{}'::jsonb) as location_translations
            FROM hard_assets h
            WHERE h.is_deleted = false
              AND h.is_hidden = false
              AND h.lat IS NOT NULL
              AND h.lng IS NOT NULL
            UNION ALL
            SELECT
                s.id,
                s.name as title,
                s.sub_category as category,
                s.description,
                l.lat,
                l.lng,
                'soft' as asset_type,
                l.address,
                l.postal_code,
                s.logo_url,
                s.banner_url,
                s.updated_at,
                s.contact_phone as phone,
                s.whatsapp_contact,
                s.cta_url as website,
                NULL::text as hours,
                s.schedule,
                s.bucket,
                s.availability_enabled,
                s.availability_count,
                s.availability_unit,
                l.id as location_hard_asset_id,
                l.name as location_name,
                l.address as location_address,
                l.postal_code as location_postal_code,
                l.whatsapp_contact as location_whatsapp_contact,
                COALESCE((
                    SELECT jsonb_agg(t.name ORDER BY t.name)
                    FROM soft_asset_tags sat
                    INNER JOIN tags t ON t.id = sat.tag_id
                    WHERE sat.soft_asset_id = s.id
                ), '[]'::jsonb) as tags,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'soft'
                      AND rt.resource_id = s.id
                ), '{}'::jsonb) as translations,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'hard'
                      AND rt.resource_id = l.id
                ), '{}'::jsonb) as location_translations
            FROM soft_assets s
            INNER JOIN soft_asset_locations sl ON s.id = sl.soft_asset_id
            INNER JOIN hard_assets l ON sl.hard_asset_id = l.id
            WHERE s.is_deleted = false
              AND COALESCE(s.asset_mode, 'standalone') = 'standalone'
              AND s.is_hidden = false
              AND s.is_member_only = false
              AND s.audience_mode = 'public'
              AND l.is_deleted = false
              AND l.is_hidden = false
              AND l.lat IS NOT NULL
              AND l.lng IS NOT NULL
            UNION ALL
            SELECT
                s.id,
                s.name as title,
                s.sub_category as category,
                s.description,
                NULL::numeric as lat,
                NULL::numeric as lng,
                'soft' as asset_type,
                NULL::text as address,
                NULL::text as postal_code,
                s.logo_url,
                s.banner_url,
                s.updated_at,
                s.contact_phone as phone,
                s.whatsapp_contact,
                s.cta_url as website,
                NULL::text as hours,
                s.schedule,
                s.bucket,
                s.availability_enabled,
                s.availability_count,
                s.availability_unit,
                NULL::integer as location_hard_asset_id,
                NULL::text as location_name,
                NULL::text as location_address,
                NULL::text as location_postal_code,
                NULL::text as location_whatsapp_contact,
                COALESCE((
                    SELECT jsonb_agg(t.name ORDER BY t.name)
                    FROM soft_asset_tags sat
                    INNER JOIN tags t ON t.id = sat.tag_id
                    WHERE sat.soft_asset_id = s.id
                ), '[]'::jsonb) as tags,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'soft'
                      AND rt.resource_id = s.id
                ), '{}'::jsonb) as translations,
                '{}'::jsonb as location_translations
            FROM soft_assets s
            WHERE s.is_deleted = false
              AND COALESCE(s.asset_mode, 'standalone') = 'standalone'
              AND s.is_hidden = false
              AND s.is_member_only = false
              AND s.audience_mode = 'public'
              AND NOT EXISTS (
                  SELECT 1
                  FROM soft_asset_locations sl
                  WHERE sl.soft_asset_id = s.id
              )
            UNION ALL
            SELECT
                s.id,
                s.name as title,
                s.sub_category as category,
                s.description,
                l.lat,
                l.lng,
                'soft' as asset_type,
                l.address,
                l.postal_code,
                s.logo_url,
                s.banner_url,
                s.updated_at,
                s.contact_phone as phone,
                s.whatsapp_contact,
                s.cta_url as website,
                NULL::text as hours,
                s.schedule,
                s.bucket,
                s.availability_enabled,
                s.availability_count,
                s.availability_unit,
                l.id as location_hard_asset_id,
                l.name as location_name,
                l.address as location_address,
                l.postal_code as location_postal_code,
                l.whatsapp_contact as location_whatsapp_contact,
                COALESCE((
                    SELECT jsonb_agg(t.name ORDER BY t.name)
                    FROM soft_asset_tags sat
                    INNER JOIN tags t ON t.id = sat.tag_id
                    WHERE sat.soft_asset_id = s.id
                ), '[]'::jsonb) as tags,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'soft'
                      AND rt.resource_id = s.id
                ), '{}'::jsonb) as translations,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'hard'
                      AND rt.resource_id = l.id
                ), '{}'::jsonb) as location_translations
            FROM soft_assets s
            INNER JOIN hard_assets l ON s.host_hard_asset_id = l.id
            WHERE s.is_deleted = false
              AND COALESCE(s.asset_mode, 'standalone') = 'child'
              AND s.is_hidden = false
              AND s.is_member_only = false
              AND s.audience_mode = 'public'
              AND l.is_deleted = false
              AND l.is_hidden = false
              AND l.lat IS NOT NULL
              AND l.lng IS NOT NULL
        `
        : sql`
            SELECT
                h.id,
                h.name as title,
                h.sub_category as category,
                h.description,
                h.lat,
                h.lng,
                'hard' as asset_type,
                h.address,
                h.postal_code,
                h.logo_url,
                h.banner_url,
                h.updated_at,
                h.phone,
                h.whatsapp_contact,
                h.website,
                h.hours,
                NULL::text as schedule,
                NULL::text as bucket,
                NULL::boolean as availability_enabled,
                NULL::integer as availability_count,
                NULL::text as availability_unit,
                h.id as location_hard_asset_id,
                h.name as location_name,
                h.address as location_address,
                h.postal_code as location_postal_code,
                h.whatsapp_contact as location_whatsapp_contact,
                COALESCE((
                    SELECT jsonb_agg(t.name ORDER BY t.name)
                    FROM hard_asset_tags hat
                    INNER JOIN tags t ON t.id = hat.tag_id
                    WHERE hat.hard_asset_id = h.id
                ), '[]'::jsonb) as tags,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'hard'
                      AND rt.resource_id = h.id
                ), '{}'::jsonb) as translations,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'hard'
                      AND rt.resource_id = h.id
                ), '{}'::jsonb) as location_translations
            FROM hard_assets h
            WHERE h.subregion_id = ${subregionId}
              AND h.is_deleted = false
              AND h.is_hidden = false
              AND h.lat IS NOT NULL
              AND h.lng IS NOT NULL
            UNION ALL
            SELECT
                s.id,
                s.name as title,
                s.sub_category as category,
                s.description,
                l.lat,
                l.lng,
                'soft' as asset_type,
                l.address,
                l.postal_code,
                s.logo_url,
                s.banner_url,
                s.updated_at,
                s.contact_phone as phone,
                s.whatsapp_contact,
                s.cta_url as website,
                NULL::text as hours,
                s.schedule,
                s.bucket,
                s.availability_enabled,
                s.availability_count,
                s.availability_unit,
                l.id as location_hard_asset_id,
                l.name as location_name,
                l.address as location_address,
                l.postal_code as location_postal_code,
                l.whatsapp_contact as location_whatsapp_contact,
                COALESCE((
                    SELECT jsonb_agg(t.name ORDER BY t.name)
                    FROM soft_asset_tags sat
                    INNER JOIN tags t ON t.id = sat.tag_id
                    WHERE sat.soft_asset_id = s.id
                ), '[]'::jsonb) as tags,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'soft'
                      AND rt.resource_id = s.id
                ), '{}'::jsonb) as translations,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'hard'
                      AND rt.resource_id = l.id
                ), '{}'::jsonb) as location_translations
            FROM soft_assets s
            INNER JOIN soft_asset_locations sl ON s.id = sl.soft_asset_id
            INNER JOIN hard_assets l ON sl.hard_asset_id = l.id
            WHERE s.subregion_id = ${subregionId} 
              AND COALESCE(s.asset_mode, 'standalone') = 'standalone'
              AND s.is_deleted = false
              AND s.is_hidden = false
              AND s.is_member_only = false
              AND s.audience_mode = 'public'
              AND l.is_deleted = false
              AND l.is_hidden = false
              AND l.lat IS NOT NULL
              AND l.lng IS NOT NULL
            UNION ALL
            SELECT
                s.id,
                s.name as title,
                s.sub_category as category,
                s.description,
                NULL::numeric as lat,
                NULL::numeric as lng,
                'soft' as asset_type,
                NULL::text as address,
                NULL::text as postal_code,
                s.logo_url,
                s.banner_url,
                s.updated_at,
                s.contact_phone as phone,
                s.whatsapp_contact,
                s.cta_url as website,
                NULL::text as hours,
                s.schedule,
                s.bucket,
                s.availability_enabled,
                s.availability_count,
                s.availability_unit,
                NULL::integer as location_hard_asset_id,
                NULL::text as location_name,
                NULL::text as location_address,
                NULL::text as location_postal_code,
                NULL::text as location_whatsapp_contact,
                COALESCE((
                    SELECT jsonb_agg(t.name ORDER BY t.name)
                    FROM soft_asset_tags sat
                    INNER JOIN tags t ON t.id = sat.tag_id
                    WHERE sat.soft_asset_id = s.id
                ), '[]'::jsonb) as tags,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'soft'
                      AND rt.resource_id = s.id
                ), '{}'::jsonb) as translations,
                '{}'::jsonb as location_translations
            FROM soft_assets s
            WHERE s.is_deleted = false
              AND COALESCE(s.asset_mode, 'standalone') = 'standalone'
              AND s.is_hidden = false
              AND s.is_member_only = false
              AND s.audience_mode = 'public'
              AND (
                  s.subregion_id = ${subregionId}
                  OR EXISTS (
                      SELECT 1
                      FROM soft_asset_region_coverages sarc
                      WHERE sarc.soft_asset_id = s.id
                        AND sarc.subregion_id = ${subregionId}
                  )
              )
              AND NOT EXISTS (
                  SELECT 1
                  FROM soft_asset_locations sl
                  WHERE sl.soft_asset_id = s.id
              )
            UNION ALL
            SELECT
                s.id,
                s.name as title,
                s.sub_category as category,
                s.description,
                l.lat,
                l.lng,
                'soft' as asset_type,
                l.address,
                l.postal_code,
                s.logo_url,
                s.banner_url,
                s.updated_at,
                s.contact_phone as phone,
                s.whatsapp_contact,
                s.cta_url as website,
                NULL::text as hours,
                s.schedule,
                s.bucket,
                s.availability_enabled,
                s.availability_count,
                s.availability_unit,
                l.id as location_hard_asset_id,
                l.name as location_name,
                l.address as location_address,
                l.postal_code as location_postal_code,
                l.whatsapp_contact as location_whatsapp_contact,
                COALESCE((
                    SELECT jsonb_agg(t.name ORDER BY t.name)
                    FROM soft_asset_tags sat
                    INNER JOIN tags t ON t.id = sat.tag_id
                    WHERE sat.soft_asset_id = s.id
                ), '[]'::jsonb) as tags,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'soft'
                      AND rt.resource_id = s.id
                ), '{}'::jsonb) as translations,
                COALESCE((
                    SELECT jsonb_object_agg(rt.locale, jsonb_build_object('fields', rt.fields, 'fieldMeta', rt.field_meta))
                    FROM resource_translations rt
                    WHERE rt.resource_type = 'hard'
                      AND rt.resource_id = l.id
                ), '{}'::jsonb) as location_translations
            FROM soft_assets s
            INNER JOIN hard_assets l ON s.host_hard_asset_id = l.id
            WHERE s.subregion_id = ${subregionId}
              AND COALESCE(s.asset_mode, 'standalone') = 'child'
              AND s.is_deleted = false
              AND s.is_hidden = false
              AND s.is_member_only = false
              AND s.audience_mode = 'public'
              AND l.is_deleted = false
              AND l.is_hidden = false
              AND l.lat IS NOT NULL
              AND l.lng IS NOT NULL
        `;
}

export const rebuildMapCache = async (subregionId, envVars, deps = {}) => {
    if (!subregionId) {
        console.error("rebuildMapCache requires a subregionId");
        return;
    }

    try {
        const db = deps.db || getDb(envVars);
        const store = deps.store || dataStore;
        const query = buildMapCacheQuery(subregionId);

        const { rows } = await db.execute(query);

        const blobKey = `locations-cache-region-${subregionId}.json`;
        await store.setJSON(blobKey, {
            version: MAP_CACHE_SCHEMA_VERSION,
            generatedAt: new Date().toISOString(),
            data: rows,
        }, envVars);
        console.log(`✅ Edge cache updated for subregion ${subregionId}: ${blobKey}`);

        if (subregionId !== 'all') {
            await rebuildMapCache('all', envVars, deps);
        }

    } catch (error) {
        console.error(`❌ Failed to rebuild map cache for region ${subregionId}:`, error.message);
    }
};
