import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('boundary-layer migration is additive and keeps operational Subregion routing separate', async () => {
    const pg = new PGlite();
    try {
        const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
        for (const { tag } of journal.entries) {
            if (tag === '0007_boundary_layers') break;
            await pg.exec(await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
        }
        await pg.exec(`
            INSERT INTO subregions (id, subregion_code, name, postal_patterns)
                VALUES (1, 'SR-HOU3', 'Hougang-3', '545610'), (99, 'SIN', 'Singapore', '');
            INSERT INTO subregion_postal_codes (subregion_id, postal_code) VALUES (1, '545610');
            INSERT INTO users (id, username, email, password_hash, name)
                VALUES (1, 'boundary-owner', 'boundary@example.test', 'fixture', 'Boundary Owner');
            INSERT INTO user_subregions (user_id, subregion_id) VALUES (1, 1);
        `);

        const beforeRouting = (await pg.query(`
            SELECT spc.subregion_id, spc.postal_code, s.subregion_code
            FROM subregion_postal_codes spc
            JOIN subregions s ON s.id = spc.subregion_id
            ORDER BY spc.subregion_id, spc.postal_code
        `)).rows;
        await pg.exec(await readFile(new URL('../drizzle/0007_boundary_layers.sql', import.meta.url), 'utf8'));

        await pg.exec(`
            INSERT INTO regions (id, name) VALUES (10, 'Hougang'), (11, 'Serangoon');
            INSERT INTO region_postal_codes (region_id, postal_code) VALUES (10, '545610');
            INSERT INTO region_subregions (region_id, subregion_id) VALUES (10, 1);
            INSERT INTO unmapped_postal_codes (postal_code) VALUES ('000123');
        `);

        assert.deepEqual((await pg.query(`
            SELECT spc.subregion_id, spc.postal_code, s.subregion_code
            FROM subregion_postal_codes spc
            JOIN subregions s ON s.id = spc.subregion_id
            ORDER BY spc.subregion_id, spc.postal_code
        `)).rows, beforeRouting);
        assert.deepEqual((await pg.query('SELECT user_id, subregion_id FROM user_subregions')).rows, [{ user_id: 1, subregion_id: 1 }]);
        assert.deepEqual((await pg.query('SELECT region_id, subregion_id FROM region_subregions')).rows, [{ region_id: 10, subregion_id: 1 }]);
        assert.equal((await pg.query('SELECT count(*)::int AS count FROM region_subregions WHERE subregion_id = 99')).rows[0].count, 0);
        assert.equal((await pg.query('SELECT count(*)::int AS count FROM unmapped_postal_codes')).rows[0].count, 1);

        await assert.rejects(
            pg.exec("INSERT INTO region_postal_codes (region_id, postal_code) VALUES (11, '545610')"),
            /region_postal_codes_postal_code_unique/,
        );
    } finally {
        await pg.close();
    }
});
