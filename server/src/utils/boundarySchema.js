import { sql } from 'drizzle-orm';

let ensureBoundarySchemaPromise = null;

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
            await db.execute(sql`CREATE INDEX IF NOT EXISTS users_manager_user_idx ON users (manager_user_id)`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE hard_assets ADD COLUMN IF NOT EXISTS external_key VARCHAR(160)`);
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
                    tags JSONB DEFAULT '[]'::jsonb,
                    is_deleted BOOLEAN DEFAULT FALSE,
                    updated_at TIMESTAMP DEFAULT NOW(),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS external_key VARCHAR(160)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS audience_mode VARCHAR(40) NOT NULL DEFAULT 'public'`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS asset_mode VARCHAR(20) NOT NULL DEFAULT 'standalone'`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS parent_soft_asset_id INTEGER REFERENCES soft_asset_parents(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS host_hard_asset_id INTEGER REFERENCES hard_assets(id) ON DELETE SET NULL`);
            await db.execute(sql`ALTER TABLE soft_asset_parents ADD COLUMN IF NOT EXISTS external_key VARCHAR(160)`);
            await db.execute(sql`ALTER TABLE soft_asset_parents ADD COLUMN IF NOT EXISTS bucket VARCHAR(20)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS bucket VARCHAR(20)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS overridden_fields JSONB NOT NULL DEFAULT '[]'::jsonb`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS cta_label VARCHAR(255)`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS cta_url TEXT`);
            await db.execute(sql`ALTER TABLE soft_assets ADD COLUMN IF NOT EXISTS venue_note TEXT`);
            await db.execute(sql`ALTER TABLE hard_assets ALTER COLUMN partner_id DROP NOT NULL`);
            await db.execute(sql`ALTER TABLE soft_assets ALTER COLUMN partner_id DROP NOT NULL`);
            await db.execute(sql`UPDATE hard_assets SET created_by_user_id = partner_id WHERE created_by_user_id IS NULL`);
            await db.execute(sql`UPDATE soft_assets SET created_by_user_id = partner_id WHERE created_by_user_id IS NULL`);
            await db.execute(sql`UPDATE soft_assets SET asset_mode = 'standalone' WHERE asset_mode IS NULL OR asset_mode = ''`);
            await db.execute(sql`UPDATE soft_assets SET overridden_fields = '[]'::jsonb WHERE overridden_fields IS NULL`);
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
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS soft_assets_external_key_unique ON soft_assets (external_key) WHERE external_key IS NOT NULL`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS soft_asset_parents_external_key_unique ON soft_asset_parents (external_key) WHERE external_key IS NOT NULL`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS user_favorites_user_resource_unique ON user_favorites (user_id, resource_type, resource_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS my_maps_user_idx ON my_maps (user_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS my_maps_share_token_unique ON my_maps (share_token) WHERE share_token IS NOT NULL`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS my_map_assets_map_idx ON my_map_assets (map_id)`);
            await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS my_map_assets_map_resource_unique ON my_map_assets (map_id, resource_type, resource_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS audience_zone_postal_codes_zone_idx ON audience_zone_postal_codes (audience_zone_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS audience_zone_postal_codes_postal_idx ON audience_zone_postal_codes (postal_code)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_audience_zones_zone_idx ON soft_asset_audience_zones (audience_zone_id)`);
            await db.execute(sql`CREATE INDEX IF NOT EXISTS soft_asset_parent_audience_zones_zone_idx ON soft_asset_parent_audience_zones (audience_zone_id)`);
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
