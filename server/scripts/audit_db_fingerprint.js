import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

function hash(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function safeUrlFingerprint(rawUrl) {
    const url = new URL(rawUrl);
    return {
        fullHash: hash(rawUrl),
        hostHash: hash(url.hostname),
        databaseHash: hash(url.pathname),
        userHash: hash(url.username),
        hasPassword: Boolean(url.password),
        sslmode: url.searchParams.get('sslmode') || null,
    };
}

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required.');
    }

    const sql = neon(databaseUrl);
    const [counts] = await sql`
        SELECT
            (SELECT count(*)::int FROM users) AS users,
            (SELECT count(*)::int FROM hard_assets) AS hard_assets,
            (SELECT count(*)::int FROM soft_assets) AS soft_assets,
            (SELECT count(*)::int FROM user_phone_identities WHERE revoked_at IS NULL) AS active_phone_identities,
            (SELECT coalesce(max(id), 0)::int FROM users) AS max_user_id,
            (SELECT coalesce(max(id), 0)::int FROM phone_login_attempts) AS max_phone_attempt_id
    `;
    const topHardAssets = await sql`
        SELECT id, name, updated_at
        FROM hard_assets
        WHERE is_deleted = false
        ORDER BY updated_at DESC, id DESC
        LIMIT 3
    `;

    console.log(JSON.stringify({
        database: safeUrlFingerprint(databaseUrl),
        counts,
        topHardAssets: topHardAssets.map((asset) => ({
            id: asset.id,
            name: asset.name,
            updatedAt: asset.updated_at,
        })),
    }, null, 2));
}

main().catch((error) => {
    console.error(`Database fingerprint audit failed: ${error.message}`);
    process.exitCode = 1;
});
