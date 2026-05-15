import { sql } from 'drizzle-orm';

let ensureBoundarySchemaPromise = null;
let ensureUserPreferenceColumnsPromise = null;

export function shouldRunRuntimeSchemaBootstrap(envVars = {}) {
    const env = envVars?.env ?? envVars ?? {};
    const processEnv = typeof globalThis.process !== 'undefined' ? globalThis.process.env || {} : {};
    const nodeEnv = String(env.NODE_ENV || processEnv.NODE_ENV || '').trim().toLowerCase();
    const explicitFlag = String(env.ALLOW_RUNTIME_SCHEMA_BOOTSTRAP || processEnv.ALLOW_RUNTIME_SCHEMA_BOOTSTRAP || '').trim().toLowerCase();

    if (explicitFlag) {
        return ['1', 'true', 'yes', 'on'].includes(explicitFlag);
    }

    return nodeEnv !== 'production';
}

export async function ensureBoundarySchema(db, envVars = {}) {
    if (!shouldRunRuntimeSchemaBootstrap(envVars)) {
        return;
    }

    if (!ensureBoundarySchemaPromise) {
        ensureBoundarySchemaPromise = (async () => {
            await db.execute(sql`ALTER TABLE sub_categories ADD COLUMN IF NOT EXISTS icon_url TEXT`);
            await db.execute(sql`ALTER TABLE subregions ADD COLUMN IF NOT EXISTS postal_patterns TEXT NOT NULL DEFAULT ''`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20) NOT NULL DEFAULT ''`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth TEXT`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS chas_card VARCHAR(20)`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS caregiver_status VARCHAR(10)`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(40)`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS property_type VARCHAR(60)`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS volunteer_interest VARCHAR(10)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS users_manager_user_idx ON users (manager_user_id)`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS external_key VARCHAR(160)`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS website TEXT`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS source_google_place_id TEXT`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS source_google_maps_uri TEXT`);
            await db.execute(sql`ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS snapshot JSONB`);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS my_maps (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    is_shared BOOLEAN NOT NULL DEFAULT FALSE,
                    share_token VARCHAR(64),
                    share_updated_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`ALTER TABLE my_maps ADD COLUMN IF NOT EXISTS description TEXT`);
            await db.execute(sql`ALTER TABLE my_maps ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT FALSE`);
            await db.execute(sql`ALTER TABLE my_maps ADD COLUMN IF NOT EXISTS share_token VARCHAR(64)`);
            await db.execute(sql`ALTER TABLE my_maps ADD COLUMN IF NOT EXISTS share_updated_at TIMESTAMP`);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS my_map_assets (
                    id SERIAL PRIMARY KEY,
                    map_id INTEGER NOT NULL REFERENCES my_maps(id) ON DELETE CASCADE,
                    resource_type VARCHAR(20) NOT NULL,
                    resource_id INTEGER NOT NULL,
                    snapshot JSONB,
                    added_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS private_resource_contents (
                    id SERIAL PRIMARY KEY,
                    resource_type VARCHAR(20) NOT NULL,
                    resource_id INTEGER NOT NULL,
                    notes TEXT,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS private_resource_content_access (
                    id SERIAL PRIMARY KEY,
                    content_id INTEGER NOT NULL REFERENCES private_resource_contents(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS private_resource_content_files (
                    id SERIAL PRIMARY KEY,
                    content_id INTEGER NOT NULL REFERENCES private_resource_contents(id) ON DELETE CASCADE,
                    file_name TEXT NOT NULL,
                    mime_type VARCHAR(160) NOT NULL,
                    file_size INTEGER NOT NULL,
                    file_data TEXT NOT NULL,
                    uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS resource_translations (
                    id SERIAL PRIMARY KEY,
                    resource_type VARCHAR(30) NOT NULL,
                    resource_id INTEGER NOT NULL,
                    locale VARCHAR(12) NOT NULL,
                    fields JSONB NOT NULL DEFAULT '{}'::jsonb,
                    field_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
                    reviewed_at TIMESTAMP,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS soft_asset_parents (
                    id SERIAL PRIMARY KEY,
                    external_key VARCHAR(160),
                    partner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    name VARCHAR(255) NOT NULL,
                    bucket VARCHAR(20),
                    sub_category VARCHAR(50) NOT NULL DEFAULT 'Programmes',
                    description TEXT,
                    schedule TEXT,
                    logo_url TEXT,
                    banner_url TEXT,
                    gallery_urls JSONB DEFAULT '[]'::jsonb,
                    audience_mode VARCHAR(40) NOT NULL DEFAULT 'public',
                    is_member_only BOOLEAN DEFAULT FALSE,
                    eligibility_rules JSONB,
                    tags JSONB DEFAULT '[]'::jsonb,
                    is_deleted BOOLEAN DEFAULT FALSE,
                    updated_at TIMESTAMP DEFAULT NOW(),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS external_key VARCHAR(160)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS audience_mode VARCHAR(40) NOT NULL DEFAULT 'public'`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS eligibility_rules JSONB`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS asset_mode VARCHAR(20) NOT NULL DEFAULT 'standalone'`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS parent_soft_asset_id INTEGER REFERENCES soft_asset_parents(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS host_hard_asset_id INTEGER REFERENCES hard_assets(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE soft_asset_parents ADD COLUMN IF NOT EXISTS external_key VARCHAR(160)`);
            await db.execute(sql`ALTER TABLE soft_asset_parents ADD COLUMN IF NOT EXISTS bucket VARCHAR(20)`);
            await db.execute(sql`ALTER TABLE soft_asset_parents ADD COLUMN IF NOT EXISTS eligibility_rules JSONB`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS bucket VARCHAR(20)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS overridden_fields JSONB NOT NULL DEFAULT '[]'::jsonb`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS cta_label VARCHAR(255)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS cta_url TEXT`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS venue_note TEXT`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS availability_enabled BOOLEAN NOT NULL DEFAULT FALSE`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS availability_count INTEGER NOT NULL DEFAULT 0`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS availability_unit TEXT`);
            await db.execute(sql`ALTER TABLE hard_assets ALTER COLUMN partner_id DROP NOT NULL`);
            await db.execute(sql`ALTER TABLE soft_assets ALTER COLUMN partner_id DROP NOT NULL`);
            await db.execute(sql`UPDATE hard_assets SET created_by_user_id = partner_id WHERE created_by_user_id IS NULL`);
            await db.execute(sql`UPDATE soft_assets SET created_by_user_id = partner_id WHERE created_by_user_id IS NULL`);
            await db.execute(sql`UPDATE soft_assets SET asset_mode = 'standalone' WHERE asset_mode IS NULL OR asset_mode = ''`);
            await db.execute(sql`UPDATE soft_assets SET overridden_fields = '[]'::jsonb WHERE overridden_fields IS NULL`);
            await db.execute(sql`UPDATE soft_assets SET availability_enabled = FALSE WHERE availability_enabled IS NULL`);
            await db.execute(sql`UPDATE soft_assets SET availability_count = 0 WHERE availability_count IS NULL OR availability_count < 0`);
            await db.execute(sql`UPDATE soft_assets SET availability_unit = NULL WHERE availability_unit IS NOT NULL AND BTRIM(availability_unit) = ''`);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS subregion_postal_codes (
                    subregion_id INTEGER NOT NULL REFERENCES subregions(id) ON DELETE CASCADE,
                    postal_code VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (subregion_id, postal_code)
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS partner_postal_codes (
                    partner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    postal_code VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (partner_user_id, postal_code)
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS audience_zones (
                    id SERIAL PRIMARY KEY,
                    zone_code VARCHAR(80),
                    partner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS user_asset_memberships (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    hard_asset_id INTEGER NOT NULL REFERENCES hard_assets(id) ON DELETE CASCADE,
                    join_method VARCHAR(40) NOT NULL,
                    status VARCHAR(40) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS user_phone_identities (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    phone_e164 VARCHAR(32) NOT NULL,
                    country_code VARCHAR(8) NOT NULL DEFAULT '+65',
                    national_number VARCHAR(24) NOT NULL,
                    status VARCHAR(40) NOT NULL DEFAULT 'legacy_unverified',
                    source VARCHAR(40) NOT NULL DEFAULT 'legacy_profile',
                    provider_subject VARCHAR(255),
                    verified_at TIMESTAMP,
                    revoked_at TIMESTAMP,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS phone_verification_attempts (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    provider VARCHAR(40) NOT NULL DEFAULT 'gudauth',
                    provider_challenge_id VARCHAR(255),
                    requested_phone_e164 VARCHAR(32),
                    verified_phone_e164 VARCHAR(32),
                    status VARCHAR(40) NOT NULL DEFAULT 'pending',
                    provider_status VARCHAR(80),
                    failure_reason TEXT,
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS phone_login_attempts (
                    id SERIAL PRIMARY KEY,
                    provider VARCHAR(40) NOT NULL DEFAULT 'gudauth',
                    provider_challenge_id VARCHAR(255),
                    requested_phone_e164 VARCHAR(32),
                    verified_phone_e164 VARCHAR(32),
                    resolved_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    status VARCHAR(40) NOT NULL DEFAULT 'pending',
                    provider_status VARCHAR(80),
                    failure_reason TEXT,
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS partner_organizations (
                    id SERIAL PRIMARY KEY,
                    legacy_partner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    name VARCHAR(255) NOT NULL,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS partner_staff_memberships (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    staff_role VARCHAR(40) NOT NULL DEFAULT 'editor',
                    revoked_at TIMESTAMP,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS partner_staff_events (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER REFERENCES partner_organizations(id) ON DELETE CASCADE,
                    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    event_type VARCHAR(80) NOT NULL,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS hard_asset_staff_memberships (
                    id SERIAL PRIMARY KEY,
                    hard_asset_id INTEGER NOT NULL REFERENCES hard_assets(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    staff_role VARCHAR(40) NOT NULL DEFAULT 'staff',
                    revoked_at TIMESTAMP,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS soft_asset_region_coverages (
                    soft_asset_id INTEGER NOT NULL REFERENCES soft_assets(id) ON DELETE CASCADE,
                    subregion_id INTEGER NOT NULL REFERENCES subregions(id) ON DELETE CASCADE,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (soft_asset_id, subregion_id)
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS soft_asset_staff_memberships (
                    id SERIAL PRIMARY KEY,
                    soft_asset_id INTEGER NOT NULL REFERENCES soft_assets(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    staff_role VARCHAR(40) NOT NULL DEFAULT 'staff',
                    revoked_at TIMESTAMP,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`ALTER TABLE audience_zones ADD COLUMN IF NOT EXISTS hard_asset_id INTEGER REFERENCES hard_assets(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE audience_zones ADD COLUMN IF NOT EXISTS sharing_status VARCHAR(40) NOT NULL DEFAULT 'approved'`);
            await db.execute(sql`ALTER TABLE audience_zones ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE audience_zones ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
            await db.execute(sql`UPDATE audience_zones SET sharing_status = 'approved' WHERE sharing_status IS NULL OR BTRIM(sharing_status) = ''`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS audience_zones_zone_code_unique ON audience_zones (zone_code)`);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS audience_zone_postal_codes (
                    audience_zone_id INTEGER NOT NULL REFERENCES audience_zones(id) ON DELETE CASCADE,
                    postal_code VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    PRIMARY KEY (audience_zone_id, postal_code)
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS soft_asset_audience_zones (
                    soft_asset_id INTEGER NOT NULL REFERENCES soft_assets(id) ON DELETE CASCADE,
                    audience_zone_id INTEGER NOT NULL REFERENCES audience_zones(id) ON DELETE CASCADE,
                    PRIMARY KEY (soft_asset_id, audience_zone_id)
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS soft_asset_parent_audience_zones (
                    soft_asset_parent_id INTEGER NOT NULL REFERENCES soft_asset_parents(id) ON DELETE CASCADE,
                    audience_zone_id INTEGER NOT NULL REFERENCES audience_zones(id) ON DELETE CASCADE,
                    PRIMARY KEY (soft_asset_parent_id, audience_zone_id)
                )
            `);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS subregion_postal_codes_subregion_idx ON subregion_postal_codes (subregion_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS subregion_postal_codes_postal_idx ON subregion_postal_codes (postal_code)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_postal_codes_partner_idx ON partner_postal_codes (partner_user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_postal_codes_postal_idx ON partner_postal_codes (postal_code)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS audience_zones_partner_idx ON audience_zones (partner_user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS audience_zones_creator_idx ON audience_zones (created_by_user_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS hard_assets_external_key_unique ON hard_assets (external_key) WHERE external_key IS NOT NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS hard_assets_source_google_place_id_idx ON hard_assets (source_google_place_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS soft_assets_external_key_unique ON soft_assets (external_key) WHERE external_key IS NOT NULL`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS soft_asset_parents_external_key_unique ON soft_asset_parents (external_key) WHERE external_key IS NOT NULL`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS user_favorites_user_resource_unique ON user_favorites (user_id, resource_type, resource_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS my_maps_user_idx ON my_maps (user_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS my_maps_share_token_unique ON my_maps (share_token) WHERE share_token IS NOT NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS my_map_assets_map_idx ON my_map_assets (map_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS my_map_assets_map_resource_unique ON my_map_assets (map_id, resource_type, resource_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS private_resource_contents_resource_unique ON private_resource_contents (resource_type, resource_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS private_resource_contents_resource_idx ON private_resource_contents (resource_type, resource_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS private_resource_content_access_content_user_unique ON private_resource_content_access (content_id, user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS private_resource_content_access_user_idx ON private_resource_content_access (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS private_resource_content_files_content_idx ON private_resource_content_files (content_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS resource_translations_resource_locale_unique ON resource_translations (resource_type, resource_id, locale)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS resource_translations_resource_idx ON resource_translations (resource_type, resource_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS audience_zone_postal_codes_zone_idx ON audience_zone_postal_codes (audience_zone_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS audience_zone_postal_codes_postal_idx ON audience_zone_postal_codes (postal_code)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_audience_zones_zone_idx ON soft_asset_audience_zones (audience_zone_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_parent_audience_zones_zone_idx ON soft_asset_parent_audience_zones (audience_zone_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS user_asset_memberships_user_hard_asset_unique ON user_asset_memberships (user_id, hard_asset_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS user_asset_memberships_user_idx ON user_asset_memberships (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS user_asset_memberships_hard_asset_idx ON user_asset_memberships (hard_asset_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS user_phone_identities_active_phone_unique ON user_phone_identities (phone_e164) WHERE revoked_at IS NULL`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS user_phone_identities_active_user_unique ON user_phone_identities (user_id) WHERE revoked_at IS NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS user_phone_identities_user_idx ON user_phone_identities (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS user_phone_identities_phone_idx ON user_phone_identities (phone_e164)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS phone_verification_attempts_user_idx ON phone_verification_attempts (user_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS phone_verification_attempts_provider_challenge_unique ON phone_verification_attempts (provider, provider_challenge_id) WHERE provider_challenge_id IS NOT NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS phone_verification_attempts_status_idx ON phone_verification_attempts (status)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS phone_login_attempts_provider_challenge_unique ON phone_login_attempts (provider, provider_challenge_id) WHERE provider_challenge_id IS NOT NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS phone_login_attempts_status_idx ON phone_login_attempts (status)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS phone_login_attempts_requested_phone_idx ON phone_login_attempts (requested_phone_e164)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS phone_login_attempts_resolved_user_idx ON phone_login_attempts (resolved_user_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS partner_organizations_legacy_partner_unique ON partner_organizations (legacy_partner_user_id) WHERE legacy_partner_user_id IS NOT NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_organizations_legacy_partner_idx ON partner_organizations (legacy_partner_user_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS partner_staff_memberships_active_user_unique ON partner_staff_memberships (organization_id, user_id) WHERE revoked_at IS NULL`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS partner_staff_memberships_active_owner_unique ON partner_staff_memberships (organization_id) WHERE revoked_at IS NULL AND staff_role = 'owner'`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_staff_memberships_organization_idx ON partner_staff_memberships (organization_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_staff_memberships_user_idx ON partner_staff_memberships (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_staff_events_organization_idx ON partner_staff_events (organization_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_staff_events_actor_idx ON partner_staff_events (actor_user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_staff_events_target_idx ON partner_staff_events (target_user_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS hard_asset_staff_memberships_active_user_unique ON hard_asset_staff_memberships (hard_asset_id, user_id) WHERE revoked_at IS NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS hard_asset_staff_memberships_hard_asset_idx ON hard_asset_staff_memberships (hard_asset_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS hard_asset_staff_memberships_user_idx ON hard_asset_staff_memberships (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS hard_asset_staff_memberships_role_idx ON hard_asset_staff_memberships (staff_role)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_region_coverages_soft_asset_idx ON soft_asset_region_coverages (soft_asset_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_region_coverages_subregion_idx ON soft_asset_region_coverages (subregion_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS soft_asset_staff_memberships_active_user_unique ON soft_asset_staff_memberships (soft_asset_id, user_id) WHERE revoked_at IS NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_staff_memberships_soft_asset_idx ON soft_asset_staff_memberships (soft_asset_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_staff_memberships_user_idx ON soft_asset_staff_memberships (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_staff_memberships_role_idx ON soft_asset_staff_memberships (staff_role)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS audience_zones_hard_asset_idx ON audience_zones (hard_asset_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS audience_zones_sharing_status_idx ON audience_zones (sharing_status)`);
            await db.execute(sql`
                INSERT INTO partner_organizations (legacy_partner_user_id, name, created_by_user_id, updated_by_user_id)
                SELECT
                    u.id,
                    COALESCE(NULLIF(BTRIM(u.name), ''), u.username, CONCAT('Partner ', u.id)),
                    u.manager_user_id,
                    u.manager_user_id
                FROM users u
                WHERE u.role = 'partner'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM partner_organizations po
                      WHERE po.legacy_partner_user_id = u.id
                  )
            `);
            await db.execute(sql`
                INSERT INTO partner_staff_memberships (organization_id, user_id, staff_role, created_by_user_id, updated_by_user_id)
                SELECT
                    po.id,
                    po.legacy_partner_user_id,
                    'owner',
                    po.created_by_user_id,
                    po.updated_by_user_id
                FROM partner_organizations po
                WHERE po.legacy_partner_user_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM partner_staff_memberships psm
                      WHERE psm.organization_id = po.id
                        AND psm.user_id = po.legacy_partner_user_id
                        AND psm.revoked_at IS NULL
                  )
            `);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_parents_partner_idx ON soft_asset_parents (partner_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_parents_creator_idx ON soft_asset_parents (created_by_user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_assets_asset_mode_idx ON soft_assets (asset_mode)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_assets_parent_idx ON soft_assets (parent_soft_asset_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_assets_host_idx ON soft_assets (host_hard_asset_id)`);
            await db.execute(sql`
                CREATE UNIQUE INDEX IF NOT EXISTS soft_assets_parent_host_unique_idx
                ON soft_assets (parent_soft_asset_id, host_hard_asset_id)
                WHERE parent_soft_asset_id IS NOT NULL
                  AND host_hard_asset_id IS NOT NULL
                  AND is_deleted = FALSE
            `);
        })().catch((err) => {
            ensureBoundarySchemaPromise = null;
            throw err;
        });
    }

    await ensureBoundarySchemaPromise;
}

export function resetBoundarySchemaBootstrapForTests() {
    ensureBoundarySchemaPromise = null;
    ensureUserPreferenceColumnsPromise = null;
}

export async function ensureUserPreferenceColumns(db) {
    if (!ensureUserPreferenceColumnsPromise) {
        ensureUserPreferenceColumnsPromise = (async () => {
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS chas_card VARCHAR(20)`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS caregiver_status VARCHAR(10)`);
            await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS volunteer_interest VARCHAR(10)`);
        })().catch((err) => {
            ensureUserPreferenceColumnsPromise = null;
            throw err;
        });
    }

    await ensureUserPreferenceColumnsPromise;
}
