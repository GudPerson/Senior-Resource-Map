import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { neonConfig } from '@neondatabase/serverless';

// Test-process-only transport: real controllers -> real Drizzle SQL -> local
// PostgreSQL. No application injection flag, real credentials or network I/O.
export async function createNeonPostgresFixture(t) {
    const pg = new PGlite();
    const previous = { fetchFunction: neonConfig.fetchFunction, fetchEndpoint: neonConfig.fetchEndpoint };
    t.after(async () => {
        neonConfig.fetchFunction = previous.fetchFunction;
        neonConfig.fetchEndpoint = previous.fetchEndpoint;
        await pg.close();
    });
    const journal = JSON.parse(await readFile(new URL('../../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
    for (const { tag } of journal.entries) await pg.exec(await readFile(new URL(`../../drizzle/${tag}.sql`, import.meta.url), 'utf8'));
    // Neon HTTP transports PostgreSQL text, then the real driver applies its
    // parsers. Preserve that boundary rather than reserializing parsed dates/JSON.
    const rawParsers = Object.fromEntries((await pg.query('SELECT oid FROM pg_type')).rows.map(({ oid }) => [oid, (value) => value]));
    const statements = [];
    async function execute({ query, params }, connection = pg) {
        statements.push(query);
        const result = await connection.query(query, params, { rowMode: 'array', parsers: rawParsers });
        return { ...result, rowCount: result.rowCount ?? result.rows.length };
    }
    neonConfig.fetchEndpoint = 'https://carearound-fixture.invalid/sql';
    neonConfig.fetchFunction = async (url, options) => {
        assert.equal(url, 'https://carearound-fixture.invalid/sql');
        assert.equal(options.headers['Neon-Connection-String'], 'postgresql://fixture:fixture@carearound-fixture.invalid/fixture');
        const payload = JSON.parse(options.body);
        try {
            if (Array.isArray(payload.queries)) {
                // Match Neon HTTP's atomic batch, including rollback when a later
                // statement fails. Never emulate a transaction as independent writes.
                const results = await pg.transaction(async (transaction) => {
                    const results = [];
                    for (const query of payload.queries) results.push(await execute(query, transaction));
                    return results;
                });
                return Response.json({ results });
            }
            return Response.json(await execute(payload));
        } catch (error) { return Response.json({ message: error.message, code: error.code }, { status: 400 }); }
    };
    return { pg, statements, env: {
        DATABASE_URL: 'postgresql://fixture:fixture@carearound-fixture.invalid/fixture',
        NODE_ENV: 'production', ALLOW_RUNTIME_SCHEMA_BOOTSTRAP: 'false', SUPPORT_INBOX_ENABLED: 'true',
    } };
}
