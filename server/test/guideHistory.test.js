import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createGuideRoutes } from '../src/routes/guide.js';
import { createGuideHistoryRepository, guideHistorySaveSchema, requireGuideHistoryOwner, restoreGuideHistory } from '../src/utils/guideHistory.js';

const member = { id: 1, role: 'standard' };
const other = { id: 2, role: 'standard' };
const admin = { id: 3, role: 'super_admin' };
const saveInput = (overrides = {}) => ({ id: crypto.randomUUID(), requestId: crypto.randomUUID(),
    revision: 0, consent: true, inputs: [{ question: 'How do I bulk unsave?' }, { question: 'Find Havelock' }], ...overrides });

test('Guide history requires real account ownership and reviewed minimal inputs', () => {
    assert.equal(requireGuideHistoryOwner(admin), 3);
    for (const user of [null, {}, { id: 1, role: 'guest' }, { id: -1, role: 'standard' }]) {
        assert.throws(() => requireGuideHistoryOwner(user), { status: 401 });
    }
    assert.throws(() => requireGuideHistoryOwner({ ...admin, isImpersonating: true }), { status: 403 });
    assert.equal(guideHistorySaveSchema.safeParse(saveInput()).success, true);
    for (const input of [saveInput({ consent: false }), saveInput({ inputs: [] }), saveInput({ inputs: Array(21).fill({ topicId: 'save' }) }),
        saveInput({ inputs: [{ question: 'password=private' }] }), saveInput({ inputs: [{ question: 'a', resources: [] }] }),
        saveInput({ inputs: [{ question: 'a', topicId: 'save' }] }), saveInput({ ownerUserId: 2 })]) {
        assert.equal(guideHistorySaveSchema.safeParse(input).success, false);
    }
    const restored = restoreGuideHistory({ id: crypto.randomUUID(), title: 'Saved', revision: 1,
        inputs: [{ question: 'Find Havelock' }, { topicId: 'unsave' }, { topicId: 'retired-topic' }] }, member);
    assert.equal(restored.messages[0].resources, undefined);
    assert.match(restored.messages[0].message, /Run these keywords again/);
    assert.equal(restored.messages[1].actions[0].route, '/my-directory');
    assert.match(restored.messages[1].message, /Care Calendar/);
    assert.equal(restored.messages[2].input, null);
    assert.match(restored.messages[2].message, /Which task did you mean/);
});

test('saved Guide questions use current reviewed facts and avoid stale account lists', () => {
    const inputs = [
        { question: 'How do I import a workbook?' },
        { question: 'How do I edit a Resource Group?' },
        { question: 'Can I import workbook into My Map?' },
        { question: 'What plans do I have?' },
        { question: 'Which Subregions am I assigned to administer?' },
        { question: 'Can I import a workbook to create programmes?' },
        { question: 'Can I delete a Place?' },
        { question: 'Show Programme edits yesterday' },
        { question: 'Can you show me who changed my Place listing yesterday?' },
    ];
    const row = { id: crypto.randomUUID(), title: 'Saved', revision: 1, inputs };
    const staffMessages = restoreGuideHistory(row, member).messages;
    assert.equal(staffMessages[0].topicId, 'asset-workbook-import');
    assert.match(staffMessages[0].message, /Upload Workbook starts the import immediately/);
    assert.equal(staffMessages[1].topicId, 'group-edit');
    assert.match(staffMessages[1].message, /Groups.*Edit/);
    assert.equal(staffMessages[2].topicId, 'unverified-workflow');
    assert.match(staffMessages[2].message, /cannot verify a workbook-upload workflow for Care Maps/);
    assert.equal(staffMessages[3].topicId, 'account-refresh');
    assert.match(staffMessages[3].message, /Ask it again/);
    assert.equal(staffMessages[4].topicId, 'account-refresh');
    assert.match(staffMessages[4].message, /Ask it again/);
    assert.equal(staffMessages[5].topicId, 'composite-guidance');
    assert.match(staffMessages[5].message, /workbook-import screen is not available/);
    assert.match(staffMessages[5].message, /not available to this account/);
    assert.equal(staffMessages[6].topicId, 'lifecycle-access');
    assert.match(staffMessages[6].message, /does not currently have Manage My Resources access/);
    assert.equal(staffMessages[7].topicId, 'account-refresh');
    assert.match(staffMessages[7].message, /Ask it again/);
    assert.equal(staffMessages[8].topicId, 'account-refresh');
    const adminMessages = restoreGuideHistory(row, admin).messages;
    assert.match(adminMessages[5].message, /This account can open Admin/);
    assert.match(adminMessages[6].message, /does not confirm it may delete a particular Place or Offering/);
    assert.doesNotMatch(JSON.stringify(staffMessages), /Staff Future Session|Other Private Session/);
});

test('Guide history PostgreSQL migration, ownership, bounds and retry behaviour', async (t) => {
    const pg = new PGlite();
    t.after(() => pg.close());
    for (const name of ['0000_carearound_current_schema_baseline', '0001_normalized_login_indexes', '0002_gudauth_challenge_verifier_columns', '0003_support_inbox']) {
        await pg.exec(await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), 'utf8'));
    }
    await pg.exec(`INSERT INTO users (id, username, email, password_hash, name, role) VALUES
        (1, 'one', 'one@example.test', 'fixture', 'User one', 'standard'),
        (2, 'two', 'two@example.test', 'fixture', 'User two', 'standard'),
        (3, 'admin', 'admin@example.test', 'fixture', 'Reviewer', 'super_admin');
        INSERT INTO my_maps (id, user_id, name) VALUES (1, 1, 'Existing private map');`);
    await pg.exec(await readFile(new URL('../drizzle/0004_guide_history.sql', import.meta.url), 'utf8'));
    const query = async (sql, params) => (await pg.query(sql, params)).rows;
    const repository = createGuideHistoryRepository(query);
    const input = saveInput();
    let saved;
    await t.test('upgrade preserves existing data and all three CHECK constraints', async () => {
        assert.equal((await query('SELECT name FROM my_maps', []))[0].name, 'Existing private map');
        assert.equal((await query("SELECT count(*)::integer AS count FROM pg_constraint WHERE conrelid = 'guide_conversations'::regclass AND contype = 'c'", []))[0].count, 3);
        saved = await repository.save(input, 1);
        assert.equal(saved.revision, 1);
        for (const sql of ["UPDATE guide_conversations SET slot = 20", "UPDATE guide_conversations SET revision = 0", "UPDATE guide_conversations SET inputs = '[]'::jsonb"]) {
            await assert.rejects(query(sql, []), (error) => error.code === '23514');
        }
    });
    await t.test('snapshot retries do not duplicate or silently overwrite questions', async () => {
        assert.equal((await repository.save(input, 1)).revision, 1);
        await assert.rejects(repository.save({ ...input, inputs: [{ question: 'Changed contents' }] }, 1), { status: 409 });
        assert.equal((await repository.list(1)).length, 1);
        const update = saveInput({ id: input.id, revision: 1, inputs: [...input.inputs, { topicId: 'calendar' }] });
        saved = await repository.save(update, 1);
        assert.equal(saved.revision, 2);
        assert.equal((await repository.save(update, 1)).revision, 2);
        await assert.rejects(repository.save({ ...input, revision: 1, requestId: crypto.randomUUID() }, 1), { status: 409 });
        await assert.rejects(repository.remove(input.id, 1, 1), { status: 409 });
        assert.equal((await query('SELECT count(*)::integer AS count FROM support_conversations', []))[0].count, 0);
    });
    await t.test('account and Super Admin cannot read another owner history', async () => {
        for (const owner of [2, 3]) {
            assert.deepEqual(await repository.list(owner), []);
            await assert.rejects(repository.get(input.id, owner), { status: 404 });
            await assert.rejects(repository.save({ ...input, revision: 2 }, owner), { status: 409 });
            await repository.remove(input.id, owner, 2);
            assert.equal((await repository.get(input.id, 1)).revision, 2);
        }
        assert.deepEqual(Object.keys((await repository.list(1))[0]).sort(), ['id', 'revision', 'title', 'updatedAt']);
    });
    await t.test('account limit is enforced by bounded unique slots, and deletion is owner-scoped', async () => {
        for (let index = 0; index < 19; index += 1) await repository.save(saveInput(), 1);
        await assert.rejects(repository.save(saveInput(), 1), { status: 409 });
        assert.equal((await repository.list(1)).length, 20);
        await repository.remove(input.id, 1, 2);
        await repository.remove(input.id, 1, 2);
        await assert.rejects(repository.get(input.id, 1), { status: 404 });
        assert.equal((await repository.list(1)).length, 19);
        await repository.save(saveInput(), 1);
        assert.equal((await repository.list(1)).length, 20);
    });
    await t.test('HTTP requires explicit consent and uses live account identity, not body roles or guest codes', async () => {
        let user = other;
        const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', user); await next(); },
            historyRepositoryForContext: () => repository });
        const env = { SUPPORT_INBOX_ENABLED: 'true' };
        const request = (path, method = 'GET', body, environment = env) => router.request(path, {
            method, headers: { 'Content-Type': 'application/json', 'X-CareAround-Support-Key': 'a'.repeat(64) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        }, environment);
        const pending = saveInput();
        assert.equal((await request('/history', 'POST', { ...pending, consent: false })).status, 400);
        assert.equal((await request('/history', 'POST', { ...pending, ownerUserId: 1 })).status, 400);
        assert.deepEqual(await repository.list(2), []);
        const created = await request('/history', 'POST', pending);
        assert.equal(created.status, 200);
        assert.equal(created.headers.get('Cache-Control'), 'no-store');
        const response = await created.json();
        assert.equal(response.conversation.id, pending.id);
        assert.equal(response.messages[0].input.question, pending.inputs[0].question);
        assert.equal(response.messages[1].resources, undefined);
        assert.doesNotMatch(JSON.stringify(response), /owner_user_id|last_request_id|slot/);
        user = admin;
        assert.equal((await request(`/history/${pending.id}`)).status, 404);
        user = { ...other, isImpersonating: true };
        assert.equal((await request('/history')).status, 403);
        user = null;
        assert.equal((await request('/history')).status, 401);
        assert.equal((await request('/history', 'GET', undefined, {})).status, 503);
        user = other;
        assert.equal((await request(`/history/${pending.id}`, 'DELETE', { revision: 1 })).status, 200);
        assert.equal((await request(`/history/${pending.id}`)).status, 404);
    });
});
