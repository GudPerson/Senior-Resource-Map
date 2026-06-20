import { sql } from 'drizzle-orm';

let ensureBoundarySchemaPromise = null;
let ensureGroupAssetSchemaPromise = null;
let ensureUserPreferenceColumnsPromise = null;

export function getRuntimeSchemaBootstrapMode(envVars = {}) {
    const env = envVars?.env ?? envVars ?? {};
    const processEnv = typeof globalThis.process !== 'undefined' ? globalThis.process.env || {} : {};
    const nodeEnv = String(env.NODE_ENV || processEnv.NODE_ENV || '').trim().toLowerCase();
    const explicitFlag = String(env.ALLOW_RUNTIME_SCHEMA_BOOTSTRAP || processEnv.ALLOW_RUNTIME_SCHEMA_BOOTSTRAP || '').trim().toLowerCase();

    if (explicitFlag) {
        if (['group', 'group-only', 'groups'].includes(explicitFlag)) {
            return 'group-only';
        }
        return ['1', 'true', 'yes', 'on'].includes(explicitFlag) ? 'full' : 'off';
    }

    return nodeEnv !== 'production' ? 'full' : 'off';
}

export function shouldRunRuntimeSchemaBootstrap(envVars = {}) {
    return getRuntimeSchemaBootstrapMode(envVars) !== 'off';
}

export async function ensureGroupAssetSchema(db) {
    if (!ensureGroupAssetSchemaPromise) {
        ensureGroupAssetSchemaPromise = (async () => {
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS asset_mode VARCHAR(20) NOT NULL DEFAULT 'standalone'`);
            await db.execute(sql`UPDATE soft_assets SET asset_mode = 'standalone' WHERE asset_mode IS NULL OR asset_mode = ''`);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS soft_asset_group_members (
                    id SERIAL PRIMARY KEY,
                    group_soft_asset_id INTEGER NOT NULL REFERENCES soft_assets(id) ON DELETE CASCADE,
                    member_resource_type VARCHAR(20) NOT NULL,
                    member_resource_id INTEGER NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    added_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    added_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS soft_asset_group_members_unique_member_idx ON soft_asset_group_members (group_soft_asset_id, member_resource_type, member_resource_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_group_members_group_idx ON soft_asset_group_members (group_soft_asset_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_group_members_member_idx ON soft_asset_group_members (member_resource_type, member_resource_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_assets_asset_mode_idx ON soft_assets (asset_mode)`);
        })().catch((err) => {
            ensureGroupAssetSchemaPromise = null;
            throw err;
        });
    }

    await ensureGroupAssetSchemaPromise;
}

export async function ensureBoundarySchema(db, envVars = {}) {
    const bootstrapMode = getRuntimeSchemaBootstrapMode(envVars);
    if (bootstrapMode === 'off') {
        return;
    }

    if (bootstrapMode === 'group-only') {
        await ensureGroupAssetSchema(db);
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
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS whatsapp_contact VARCHAR(255)`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS website TEXT`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::jsonb`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS source_google_place_id TEXT`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS source_google_maps_uri TEXT`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS last_verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS source_type VARCHAR(80)`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS verification_status VARCHAR(40) NOT NULL DEFAULT 'unverified'`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS verification_confidence VARCHAR(40)`);
            await db.execute(sql`ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS snapshot JSONB`);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS my_maps (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    is_shared BOOLEAN NOT NULL DEFAULT FALSE,
                    share_token VARCHAR(64),
                    share_includes_handoff_notes BOOLEAN NOT NULL DEFAULT FALSE,
                    share_updated_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`ALTER TABLE my_maps ADD COLUMN IF NOT EXISTS description TEXT`);
            await db.execute(sql`ALTER TABLE my_maps ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT FALSE`);
            await db.execute(sql`ALTER TABLE my_maps ADD COLUMN IF NOT EXISTS share_token VARCHAR(64)`);
            await db.execute(sql`ALTER TABLE my_maps ADD COLUMN IF NOT EXISTS share_includes_handoff_notes BOOLEAN NOT NULL DEFAULT FALSE`);
            await db.execute(sql`ALTER TABLE my_maps ADD COLUMN IF NOT EXISTS share_updated_at TIMESTAMP`);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS my_map_assets (
                    id SERIAL PRIMARY KEY,
                    map_id INTEGER NOT NULL REFERENCES my_maps(id) ON DELETE CASCADE,
                    resource_type VARCHAR(20) NOT NULL,
                    resource_id INTEGER NOT NULL,
                    snapshot JSONB,
                    private_note TEXT,
                    handoff_note TEXT,
                    notes_updated_at TIMESTAMP,
                    added_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`ALTER TABLE my_map_assets ADD COLUMN IF NOT EXISTS private_note TEXT`);
            await db.execute(sql`ALTER TABLE my_map_assets ADD COLUMN IF NOT EXISTS handoff_note TEXT`);
            await db.execute(sql`ALTER TABLE my_map_assets ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMP`);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS my_map_asset_notes (
                    id SERIAL PRIMARY KEY,
                    map_asset_id INTEGER NOT NULL REFERENCES my_map_assets(id) ON DELETE CASCADE,
                    note_text TEXT NOT NULL,
                    is_shared BOOLEAN NOT NULL DEFAULT FALSE,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS my_map_share_snapshots (
                    id SERIAL PRIMARY KEY,
                    map_id INTEGER NOT NULL REFERENCES my_maps(id) ON DELETE CASCADE,
                    share_token VARCHAR(64) NOT NULL,
                    snapshot JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS recommendation_review_records (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    reviewer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    map_id INTEGER REFERENCES my_maps(id) ON DELETE SET NULL,
                    resource_type VARCHAR(20),
                    resource_id INTEGER,
                    recommendation_type VARCHAR(80) NOT NULL DEFAULT 'social_prescribing',
                    decision VARCHAR(40) NOT NULL DEFAULT 'pending',
                    status VARCHAR(40) NOT NULL DEFAULT 'draft',
                    explanation_shown TEXT,
                    review_notes TEXT,
                    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                    reviewed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                INSERT INTO my_map_asset_notes (map_asset_id, note_text, is_shared, sort_order, created_at, updated_at)
                SELECT legacy.map_asset_id, legacy.note_text, legacy.is_shared, legacy.sort_order, legacy.created_at, legacy.updated_at
                FROM (
                    SELECT
                        id AS map_asset_id,
                        private_note AS note_text,
                        FALSE AS is_shared,
                        0 AS sort_order,
                        COALESCE(notes_updated_at, NOW()) AS created_at,
                        COALESCE(notes_updated_at, NOW()) AS updated_at
                    FROM my_map_assets
                    WHERE private_note IS NOT NULL AND BTRIM(private_note) <> ''
                    UNION ALL
                    SELECT
                        id AS map_asset_id,
                        handoff_note AS note_text,
                        TRUE AS is_shared,
                        1 AS sort_order,
                        COALESCE(notes_updated_at, NOW()) AS created_at,
                        COALESCE(notes_updated_at, NOW()) AS updated_at
                    FROM my_map_assets
                    WHERE handoff_note IS NOT NULL AND BTRIM(handoff_note) <> ''
                ) AS legacy
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM my_map_asset_notes existing
                    WHERE existing.map_asset_id = legacy.map_asset_id
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
            await db.execute(sql`ALTER TABLE soft_asset_parents ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP`);
            await db.execute(sql`ALTER TABLE soft_asset_parents ADD COLUMN IF NOT EXISTS last_verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE soft_asset_parents ADD COLUMN IF NOT EXISTS source_type VARCHAR(80)`);
            await db.execute(sql`ALTER TABLE soft_asset_parents ADD COLUMN IF NOT EXISTS verification_status VARCHAR(40) NOT NULL DEFAULT 'unverified'`);
            await db.execute(sql`ALTER TABLE soft_asset_parents ADD COLUMN IF NOT EXISTS verification_confidence VARCHAR(40)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS bucket VARCHAR(20)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS overridden_fields JSONB NOT NULL DEFAULT '[]'::jsonb`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS whatsapp_contact VARCHAR(255)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS cta_label VARCHAR(255)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS cta_url TEXT`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS venue_note TEXT`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS availability_enabled BOOLEAN NOT NULL DEFAULT FALSE`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS availability_count INTEGER NOT NULL DEFAULT 0`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS availability_unit TEXT`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS last_verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS source_type VARCHAR(80)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS verification_status VARCHAR(40) NOT NULL DEFAULT 'unverified'`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS verification_confidence VARCHAR(40)`);
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
                CREATE TABLE IF NOT EXISTS user_consent_records (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    consent_type VARCHAR(80) NOT NULL,
                    consent_version VARCHAR(40) NOT NULL,
                    status VARCHAR(40) NOT NULL DEFAULT 'accepted',
                    source_surface VARCHAR(120),
                    accepted_at TIMESTAMP,
                    withdrawn_at TIMESTAMP,
                    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS notification_preferences (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    channel VARCHAR(40) NOT NULL,
                    category VARCHAR(80) NOT NULL DEFAULT 'general',
                    enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    delivery_allowed BOOLEAN NOT NULL DEFAULT FALSE,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS user_opt_out_records (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    opt_out_type VARCHAR(80) NOT NULL,
                    reason TEXT,
                    active BOOLEAN NOT NULL DEFAULT TRUE,
                    source_surface VARCHAR(120),
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    revoked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    revoked_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS retention_records (
                    id SERIAL PRIMARY KEY,
                    entity_type VARCHAR(80) NOT NULL,
                    entity_id INTEGER NOT NULL,
                    retention_category VARCHAR(80) NOT NULL,
                    retain_until TIMESTAMP,
                    deletion_eligible BOOLEAN NOT NULL DEFAULT FALSE,
                    deletion_status VARCHAR(40) NOT NULL DEFAULT 'active',
                    reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    deleted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    reviewed_at TIMESTAMP,
                    deleted_at TIMESTAMP,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS partner_organizations (
                    id SERIAL PRIMARY KEY,
                    legacy_partner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    governance_status VARCHAR(40) NOT NULL DEFAULT 'active',
                    data_contact_name VARCHAR(255),
                    data_contact_email VARCHAR(255),
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS description TEXT`);
            await db.execute(sql`ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS governance_status VARCHAR(40) NOT NULL DEFAULT 'active'`);
            await db.execute(sql`ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS data_contact_name VARCHAR(255)`);
            await db.execute(sql`ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS data_contact_email VARCHAR(255)`);
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
                CREATE TABLE IF NOT EXISTS organization_access_memberships (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    access_role VARCHAR(40) NOT NULL DEFAULT 'staff',
                    revoked_at TIMESTAMP,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS organization_agreements (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
                    agreement_reference VARCHAR(160) NOT NULL,
                    agreement_type VARCHAR(80) NOT NULL DEFAULT 'data_sharing',
                    file_url TEXT,
                    file_name TEXT,
                    status VARCHAR(40) NOT NULL DEFAULT 'draft',
                    effective_at TIMESTAMP,
                    expires_at TIMESTAMP,
                    allowed_uses JSONB NOT NULL DEFAULT '{}'::jsonb,
                    reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    reviewed_at TIMESTAMP,
                    approved_at TIMESTAMP,
                    revoked_at TIMESTAMP,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS organization_resource_links (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
                    resource_type VARCHAR(20) NOT NULL,
                    resource_id INTEGER NOT NULL,
                    link_status VARCHAR(40) NOT NULL DEFAULT 'active',
                    agreement_coverage_status VARCHAR(40) NOT NULL DEFAULT 'unknown',
                    linked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    unlinked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    unlinked_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`ALTER TABLE organization_resource_links ADD COLUMN IF NOT EXISTS agreement_coverage_status VARCHAR(40) NOT NULL DEFAULT 'unknown'`);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS governance_groups (
                    id SERIAL PRIMARY KEY,
                    group_type VARCHAR(20) NOT NULL,
                    organization_id INTEGER REFERENCES partner_organizations(id) ON DELETE CASCADE,
                    subregion_id INTEGER REFERENCES subregions(id) ON DELETE SET NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    coordination_status VARCHAR(40) NOT NULL DEFAULT 'active',
                    public_label VARCHAR(255),
                    public_summary TEXT,
                    archived_at TIMESTAMP,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS governance_group_memberships (
                    id SERIAL PRIMARY KEY,
                    group_id INTEGER NOT NULL REFERENCES governance_groups(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    group_role VARCHAR(40) NOT NULL DEFAULT 'staff',
                    revoked_at TIMESTAMP,
                    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS governance_group_organizations (
                    id SERIAL PRIMARY KEY,
                    group_id INTEGER NOT NULL REFERENCES governance_groups(id) ON DELETE CASCADE,
                    organization_id INTEGER NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
                    link_status VARCHAR(40) NOT NULL DEFAULT 'active',
                    unlinked_at TIMESTAMP,
                    linked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    unlinked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS governance_group_resource_links (
                    id SERIAL PRIMARY KEY,
                    group_id INTEGER NOT NULL REFERENCES governance_groups(id) ON DELETE CASCADE,
                    resource_type VARCHAR(20) NOT NULL,
                    resource_id INTEGER NOT NULL,
                    link_status VARCHAR(40) NOT NULL DEFAULT 'active',
                    unlinked_at TIMESTAMP,
                    linked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    unlinked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS sensitive_audit_logs (
                    id SERIAL PRIMARY KEY,
                    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    action_type VARCHAR(120) NOT NULL,
                    entity_type VARCHAR(80),
                    entity_id INTEGER,
                    resource_type VARCHAR(20),
                    resource_id INTEGER,
                    organization_id INTEGER REFERENCES partner_organizations(id) ON DELETE SET NULL,
                    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
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
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS soft_asset_group_members (
                    id SERIAL PRIMARY KEY,
                    group_soft_asset_id INTEGER NOT NULL REFERENCES soft_assets(id) ON DELETE CASCADE,
                    member_resource_type VARCHAR(20) NOT NULL,
                    member_resource_id INTEGER NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    added_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    added_at TIMESTAMP DEFAULT NOW(),
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
            await db.execute(sql`CREATE INDEX IF NOT EXISTS my_map_asset_notes_map_asset_idx ON my_map_asset_notes (map_asset_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS my_map_asset_notes_map_asset_sort_idx ON my_map_asset_notes (map_asset_id, sort_order)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS my_map_share_snapshots_map_unique ON my_map_share_snapshots (map_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS my_map_share_snapshots_share_token_idx ON my_map_share_snapshots (share_token)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS recommendation_review_records_user_idx ON recommendation_review_records (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS recommendation_review_records_reviewer_idx ON recommendation_review_records (reviewer_user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS recommendation_review_records_resource_idx ON recommendation_review_records (resource_type, resource_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS recommendation_review_records_status_idx ON recommendation_review_records (status)`);
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
            await db.execute(sql`CREATE INDEX IF NOT EXISTS user_consent_records_user_idx ON user_consent_records (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS user_consent_records_user_type_version_idx ON user_consent_records (user_id, consent_type, consent_version)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS user_consent_records_status_idx ON user_consent_records (status)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_user_channel_category_unique ON notification_preferences (user_id, channel, category)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS notification_preferences_user_idx ON notification_preferences (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS notification_preferences_channel_idx ON notification_preferences (channel)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS user_opt_out_records_active_user_type_unique ON user_opt_out_records (user_id, opt_out_type) WHERE active = TRUE AND revoked_at IS NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS user_opt_out_records_user_idx ON user_opt_out_records (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS user_opt_out_records_type_idx ON user_opt_out_records (opt_out_type)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS retention_records_entity_category_unique ON retention_records (entity_type, entity_id, retention_category)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS retention_records_status_idx ON retention_records (deletion_status)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS retention_records_retain_until_idx ON retention_records (retain_until)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS partner_organizations_legacy_partner_unique ON partner_organizations (legacy_partner_user_id) WHERE legacy_partner_user_id IS NOT NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_organizations_legacy_partner_idx ON partner_organizations (legacy_partner_user_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS partner_staff_memberships_active_user_unique ON partner_staff_memberships (organization_id, user_id) WHERE revoked_at IS NULL`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS partner_staff_memberships_active_owner_unique ON partner_staff_memberships (organization_id) WHERE revoked_at IS NULL AND staff_role = 'owner'`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_staff_memberships_organization_idx ON partner_staff_memberships (organization_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_staff_memberships_user_idx ON partner_staff_memberships (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_staff_events_organization_idx ON partner_staff_events (organization_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_staff_events_actor_idx ON partner_staff_events (actor_user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS partner_staff_events_target_idx ON partner_staff_events (target_user_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS organization_access_memberships_active_user_unique ON organization_access_memberships (organization_id, user_id) WHERE revoked_at IS NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS organization_access_memberships_organization_idx ON organization_access_memberships (organization_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS organization_access_memberships_user_idx ON organization_access_memberships (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS organization_access_memberships_role_idx ON organization_access_memberships (access_role)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS organization_agreements_organization_idx ON organization_agreements (organization_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS organization_agreements_status_idx ON organization_agreements (status)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS organization_agreements_expires_idx ON organization_agreements (expires_at)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS organization_resource_links_active_resource_unique ON organization_resource_links (organization_id, resource_type, resource_id) WHERE unlinked_at IS NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS organization_resource_links_organization_idx ON organization_resource_links (organization_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS organization_resource_links_resource_idx ON organization_resource_links (resource_type, resource_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS organization_resource_links_status_idx ON organization_resource_links (link_status)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS organization_resource_links_coverage_status_idx ON organization_resource_links (agreement_coverage_status)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_groups_type_idx ON governance_groups (group_type)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_groups_organization_idx ON governance_groups (organization_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_groups_subregion_idx ON governance_groups (subregion_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_groups_status_idx ON governance_groups (coordination_status)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS governance_group_memberships_active_user_unique ON governance_group_memberships (group_id, user_id) WHERE revoked_at IS NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_memberships_group_idx ON governance_group_memberships (group_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_memberships_user_idx ON governance_group_memberships (user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_memberships_role_idx ON governance_group_memberships (group_role)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS governance_group_organizations_active_unique ON governance_group_organizations (group_id, organization_id) WHERE unlinked_at IS NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_organizations_group_idx ON governance_group_organizations (group_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_organizations_organization_idx ON governance_group_organizations (organization_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS governance_group_resource_links_active_resource_unique ON governance_group_resource_links (group_id, resource_type, resource_id) WHERE unlinked_at IS NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_resource_links_group_idx ON governance_group_resource_links (group_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS governance_group_resource_links_resource_idx ON governance_group_resource_links (resource_type, resource_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS sensitive_audit_logs_actor_idx ON sensitive_audit_logs (actor_user_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS sensitive_audit_logs_action_idx ON sensitive_audit_logs (action_type)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS sensitive_audit_logs_entity_idx ON sensitive_audit_logs (entity_type, entity_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS sensitive_audit_logs_organization_idx ON sensitive_audit_logs (organization_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS sensitive_audit_logs_resource_idx ON sensitive_audit_logs (resource_type, resource_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS sensitive_audit_logs_created_idx ON sensitive_audit_logs (created_at)`);
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
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS soft_asset_group_members_unique_member_idx ON soft_asset_group_members (group_soft_asset_id, member_resource_type, member_resource_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_group_members_group_idx ON soft_asset_group_members (group_soft_asset_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_group_members_member_idx ON soft_asset_group_members (member_resource_type, member_resource_id)`);
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
    ensureGroupAssetSchemaPromise = null;
    ensureUserPreferenceColumnsPromise = null;
}

export async function ensureUserPreferenceColumns(db, envVars = {}) {
    if (!shouldRunRuntimeSchemaBootstrap(envVars)) {
        return;
    }

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
