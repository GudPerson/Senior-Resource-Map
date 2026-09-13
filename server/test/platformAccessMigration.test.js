import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('platform-access migration is additive and enforces the singleton policy contract', async () => {
    const pg = new PGlite();
    try {
        const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
        for (const { tag } of journal.entries) {
            if (tag === '0008_platform_access_settings') break;
            await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
        }

        await pg.exec(`
            INSERT INTO users (id, username, email, password_hash, name)
                VALUES (1, 'existing-owner', 'existing-owner@example.test', 'fixture', 'Existing Owner');
            INSERT INTO my_maps (id, user_id, name) VALUES (1, 1, 'Existing personal map');
        `);
        const personalMapBefore = (await pg.query('SELECT id, user_id, name FROM my_maps')).rows;

        await pg.exec(await readFile(new URL('../drizzle/0008_platform_access_settings.sql', import.meta.url), 'utf8'));
        assert.deepEqual((await pg.query('SELECT id, user_id, name FROM my_maps')).rows, personalMapBefore);

        await pg.exec(`
            INSERT INTO platform_access_settings (
                id,
                public_directory_mode,
                public_registration_mode,
                public_login_mode,
                revision,
                updated_by_user_id
            ) VALUES (1, 'authenticated', 'organization_only', 'organization_only', 1, 1)
        `);

        const invalidStatements = [
            ["INSERT INTO platform_access_settings (id) VALUES (2)", 'platform_access_settings_singleton_check'],
            ["UPDATE platform_access_settings SET public_directory_mode = 'public'", 'platform_access_settings_directory_mode_check'],
            ["UPDATE platform_access_settings SET public_registration_mode = 'invite'", 'platform_access_settings_registration_mode_check'],
            ["UPDATE platform_access_settings SET public_login_mode = 'invite'", 'platform_access_settings_login_mode_check'],
            ['UPDATE platform_access_settings SET revision = 0', 'platform_access_settings_revision_check'],
        ];
        for (const [statement, constraint] of invalidStatements) {
            await assert.rejects(pg.exec(statement), (error) => error.message.includes(constraint));
        }

        await pg.exec('DELETE FROM users WHERE id = 1');
        const [settings] = (await pg.query('SELECT updated_by_user_id FROM platform_access_settings')).rows;
        assert.equal(settings.updated_by_user_id, null);
    } finally {
        await pg.close();
    }
});
