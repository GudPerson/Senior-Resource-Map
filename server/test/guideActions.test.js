import test from 'node:test';
import assert from 'node:assert/strict';
import { sign } from 'hono/jwt';
import { createGuideActionRoutes } from '../src/routes/guideActions.js';
import { guideProgrammeDraftSchema, fingerprintGuideDraft } from '../src/utils/guideActionDomain.js';
import { draftGuideProgramme } from '../src/utils/guideActionDrafting.js';
import { GUIDE_AI_MODEL } from '../src/utils/guideAiRuntime.js';
import { createNeonPostgresFixture } from './fixtures/neonPostgresFixture.mjs';

const requestId = '19a84d0b-fb42-40fd-8ab6-8798111a8d98';
const plan = {
    enabled: true,
    notes: '',
    entries: [
        {
            key: 'session-1',
            type: 'weekly',
            startsAt: '2026-09-29T02:00:00.000Z',
            endsAt: '2026-09-29T03:00:00.000Z',
            weekdays: [2],
            repeatUntil: null,
            timezone: 'Asia/Singapore',
            status: 'active',
            note: '',
        },
    ],
};
const baseDraft = {
    name: 'Fictional exercise',
    description: 'Synthetic test programme',
    schedule: 'Tuesdays 10am',
    contactPhone: '',
    contactEmail: '',
    locationId: 100,
    visibility: 'hidden',
    schedulePlan: plan,
};
const env = { GUIDE_ACTIONS_ENABLED: 'true', JWT_SECRET: 'fictional-guide-test-secret-only' };
function post(router, path, data, runtime = env) {
    return router.request(
        `/programmes/${path}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
        runtime,
    );
}
function routerFor(actor, options = {}) {
    return createGuideActionRoutes({
        authenticate: async (c, next) => {
            c.set('user', actor);
            await next();
        },
        ...options,
    });
}

test('Guide action schemas reject privilege injection and validate canonical weekly schedules', () => {
    assert.equal(guideProgrammeDraftSchema.safeParse({ ...baseDraft, partnerId: 999 }).success, false);
    assert.equal(
        guideProgrammeDraftSchema.safeParse({
            ...baseDraft,
            schedulePlan: { ...plan, entries: [{ ...plan.entries[0], startsAt: '2026-09-30T02:00:00Z' }] },
        }).success,
        false,
    );
    assert.equal(guideProgrammeDraftSchema.parse({}).visibility, 'hidden');
});

test('Guide blocks guests, impersonation, non-operators, unsupported and unreviewed actions', async () => {
    for (const [actor, status] of [
        [null, 401],
        [{ id: 1, role: 'guest' }, 401],
        [{ id: 1, role: 'super_admin', isImpersonating: true }, 403],
        [{ id: 1, role: 'standard' }, 403],
    ]) {
        const response = await post(routerFor(actor), 'draft', { message: 'Create a programme' });
        assert.equal(response.status, status);
        assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    const router = routerFor({ id: 1, role: 'super_admin' });
    assert.equal((await post(router, 'create', { draft: baseDraft, requestId })).status, 400);
    assert.equal((await post(router, 'delete', { draft: baseDraft })).status, 404);
    assert.equal((await post(router, 'draft', { message: 'Create' }, {})).status, 503);
});

test('Guide save action accepts an explicit resource choice for a member and blocks unsafe requests', async () => {
    const calls = [];
    const resource = { resourceType: 'hard', resourceId: 29 };
    const router = routerFor({ id: 7, role: 'standard' }, {
        saveResource: async (c, type, id) => {
            calls.push({ userId: c.get('user').id, type, id });
            return { success: true, saved: true, alreadySaved: calls.length > 1,
                resourceType: type, resourceId: id };
        },
    });
    const postSave = (target, body, runtime = env) => target.request('/saved-resources', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }, runtime);

    assert.equal((await postSave(router, { ...resource, visibility: 'public' })).status, 400);
    assert.equal((await postSave(router, { resourceType: 'hard', resourceId: -1 })).status, 400);
    const first = await postSave(router, resource);
    const retry = await postSave(router, resource);
    assert.equal(first.status, 200);
    assert.equal((await first.json()).alreadySaved, false);
    assert.equal((await retry.json()).alreadySaved, true);
    assert.deepEqual(calls, [{ userId: 7, type: 'hard', id: 29 }, { userId: 7, type: 'hard', id: 29 }]);
    assert.equal((await postSave(routerFor({ id: 8, role: 'guest' }), resource)).status, 401);
    assert.equal((await postSave(routerFor({ id: 8, role: 'standard', isImpersonating: true }), resource)).status, 403);
    assert.equal((await postSave(router, resource, {})).status, 503);
});

test('AI draft only proposes allowlisted text and keeps model output away from action authority', async () => {
    const draft = guideProgrammeDraftSchema.parse({
        ...baseDraft,
        contactPhone: '61234567',
        contactEmail: 'hello@example.test',
    });
    let seen;
    const runtime = { NODE_ENV: 'production', GUIDE_CHAT_ENABLED: 'true', GUIDE_AI_GATEWAY_ID: 'guide-oracle',
        AI: { run: async (...args) => {
            seen = args;
            return { response: JSON.stringify({ name: 'Updated name', description: '', schedule: 'Wednesday 10am' }) };
        } } };
    const result = await draftGuideProgramme(
        { message: 'Change it to Wednesday', draft, useAi: true }, runtime,
    );
    assert.equal(result.aiAvailable, true);
    assert.equal(result.draft.name, 'Updated name');
    assert.equal(result.draft.visibility, 'hidden');
    assert.equal(result.draft.locationId, 100);
    assert.equal(result.draft.contactPhone, '61234567');
    assert.equal(result.draft.contactEmail, 'hello@example.test');
    assert.equal(result.draft.schedulePlan.enabled, false);
    assert.equal(seen[0], GUIDE_AI_MODEL);
    assert.deepEqual(seen[2], { gateway: { id: 'guide-oracle', skipCache: true, collectLog: false } });
    assert.doesNotMatch(
        JSON.stringify(seen[1]),
        /locationId|visibility|partnerId|contactPhone|contactEmail|61234567|hello@example/,
    );
    const injected = await draftGuideProgramme(
        { message: 'Create', draft, useAi: true },
        { ...runtime, AI: { run: async () => ({ response: JSON.stringify({
            name: 'X', description: '', schedule: '', contactPhone: '', contactEmail: '', visibility: 'public',
        }) }) } },
    );
    assert.equal(injected.aiAvailable, false);
    assert.equal(injected.draft.visibility, 'hidden');
    const inventedSchedule = await draftGuideProgramme(
        { message: 'Rename it Fictional Service', draft, useAi: true },
        { ...runtime, AI: { run: async () => ({ response: JSON.stringify({
            name: 'Fictional Service', description: draft.description, schedule: 'Every Monday at 9am',
        }) }) } },
    );
    assert.equal(inventedSchedule.aiAvailable, true);
    assert.equal(inventedSchedule.draft.schedule, draft.schedule);
    assert.equal(inventedSchedule.draft.schedulePlan.enabled, true);
    const everydayAudience = await draftGuideProgramme(
        { message: 'Make the description welcoming to every older adult', draft, useAi: true },
        { ...runtime, AI: { run: async () => ({ response: JSON.stringify({
            name: draft.name, description: 'Welcoming to every older adult', schedule: 'Every Monday at 9am',
        }) }) } },
    );
    assert.equal(everydayAudience.draft.schedule, draft.schedule);
    assert.equal(everydayAudience.draft.schedulePlan.enabled, true);
    const manual = await draftGuideProgramme({ message: 'Create', draft }, runtime);
    assert.match(manual.message, /Cloudflare AI is off/);
    const noGateway = await draftGuideProgramme({ message: 'Create', draft, useAi: true },
        { ...runtime, GUIDE_AI_GATEWAY_ID: '' });
    assert.equal(noGateway.aiAvailable, false);
});

test('Programme drafting requires explicit Cloudflare opt-in and limits model calls per actor', async () => {
    let calls = 0;
    const runtime = { ...env, NODE_ENV: 'production', GUIDE_CHAT_ENABLED: 'true', GUIDE_AI_GATEWAY_ID: 'guide-oracle',
        AI: { run: async () => {
            calls++;
            return { response: JSON.stringify({ name: 'Fixture class', description: 'Synthetic class', schedule: '' }) };
        } } };
    const router = routerFor({ id: 987, role: 'super_admin' });
    const manual = await (await post(router, 'draft', { message: 'Create a class' }, runtime)).json();
    assert.equal(manual.aiAvailable, false);
    assert.equal(calls, 0);
    for (let index = 0; index < 5; index++) {
        const proposed = await (await post(router, 'draft', { message: 'Create a class', useAi: true }, runtime)).json();
        assert.equal(proposed.aiAvailable, true);
        assert.equal(proposed.draft.name, 'Fixture class');
    }
    const limited = await (await post(router, 'draft', { message: 'Create a class', useAi: true }, runtime)).json();
    assert.equal(limited.aiAvailable, false);
    assert.match(limited.message, /at its limit/);
    assert.equal(calls, 5);
});

test('server review binds exact draft, identity and request ID and does not execute writes', async () => {
    let writes = 0;
    const actor = { id: 1, role: 'super_admin' };
    const router = routerFor(actor, {
        validatePlace: async () => ({ id: 100, name: 'Fictional Centre', address: '' }),
        create: async (c) => {
            writes++;
            return c.json({ id: 50, name: 'Fictional exercise' }, 201);
        },
    });
    const review = await post(router, 'review', { draft: baseDraft, requestId });
    assert.equal(review.status, 200);
    const result = await review.json();
    assert.equal(writes, 0);
    for (const payload of [
        { draft: { ...result.draft, visibility: 'public' }, requestId },
        { draft: result.draft, requestId: '29a84d0b-fb42-40fd-8ab6-8798111a8d98' },
    ]) {
        assert.equal(
            (await post(router, 'create', { ...payload, reviewToken: result.reviewToken })).status,
            409,
        );
    }
    actor.id = 2;
    assert.equal(
        (await post(router, 'create', { draft: result.draft, requestId, reviewToken: result.reviewToken }))
            .status,
        409,
    );
    actor.id = 1;
    const saved = await post(router, 'create', {
        draft: result.draft,
        requestId,
        reviewToken: result.reviewToken,
    });
    assert.equal(saved.status, 201);
    assert.equal(writes, 1);
});

test('real controller and Neon atomic SQL save one canonical programme, replay safely, reject stale access and rollback', async (t) => {
    const { pg, env: databaseEnv } = await createNeonPostgresFixture(t);
    Object.assign(databaseEnv, env);
    await pg.exec(`INSERT INTO users (id,username,email,password_hash,name,role) VALUES (1,'guide-staff','staff@example.test','fixture','Guide Staff','standard');
      INSERT INTO subregions (id,name) VALUES (10,'Fictional Region');
      INSERT INTO hard_assets (id,name,lat,lng,address,country,subregion_id) VALUES (100,'Fictional Centre',1.29,103.82,'Test address','SG',10),(101,'Other Centre',1.29,103.82,'Other address','SG',10);
      INSERT INTO hard_asset_staff_memberships (hard_asset_id,user_id,staff_role) VALUES (100,1,'staff');`);
    const actor = {
        id: 1,
        role: 'standard',
        subregionIds: [10],
        hardAssetStaffAccess: [{ hardAssetId: 100, staffRole: 'staff', subregionId: 10 }],
    };
    const router = routerFor(actor);
    const options = await router.request('/programmes/places', {}, databaseEnv);
    assert.equal(options.status, 200);
    assert.deepEqual(
        (await options.json()).places.map((p) => p.id),
        [100],
    );
    assert.equal(
        (await post(router, 'review', { draft: { ...baseDraft, locationId: 101 }, requestId }, databaseEnv))
            .status,
        403,
    );
    const review = await post(router, 'review', { draft: baseDraft, requestId }, databaseEnv);
    assert.equal(review.status, 200);
    const checked = await review.json();
    const payload = { draft: checked.draft, requestId, reviewToken: checked.reviewToken };
    const saved = await post(router, 'create', payload, databaseEnv);
    assert.equal(saved.status, 201, await saved.clone().text());
    const created = await saved.json();
    const repeat = await post(router, 'create', payload, databaseEnv);
    assert.equal(repeat.status, 200, await repeat.clone().text());
    assert.equal((await repeat.json()).resource.id, created.resource.id);
    const row = (
        await pg.query(
            'SELECT name, is_hidden, calendar_enabled, calendar_entries, schedule FROM soft_assets',
        )
    ).rows[0];
    assert.equal(row.is_hidden, true);
    assert.equal(row.calendar_enabled, true);
    assert.equal(row.calendar_entries[0].startsAt, plan.entries[0].startsAt);
    assert.match(row.schedule, /Tuesday/);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM soft_asset_locations')).rows[0].n, 1);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM offering_schedule_versions')).rows[0].n, 1);
    assert.equal(
        (
            await pg.query(
                "SELECT count(*)::int AS n FROM sensitive_audit_logs WHERE action_type='resource_created'",
            )
        ).rows[0].n,
        1,
    );
    const expiredToken = await sign(
        {
            purpose: 'guide-programme-v1',
            actorId: 1,
            requestId,
            fingerprint: await fingerprintGuideDraft(checked.draft),
            exp: 1,
        },
        `${env.JWT_SECRET}:guide-review-v1`,
        'HS256',
    );
    assert.equal(
        (await post(router, 'create', { ...payload, reviewToken: expiredToken }, databaseEnv)).status,
        200,
    );
    const nextId = '29a84d0b-fb42-40fd-8ab6-8798111a8d98';
    const nextReview = await (
        await post(router, 'review', { draft: baseDraft, requestId: nextId }, databaseEnv)
    ).json();
    await pg.exec('UPDATE hard_asset_staff_memberships SET revoked_at=NOW() WHERE hard_asset_id=100');
    const denied = await post(
        router,
        'create',
        { draft: nextReview.draft, requestId: nextId, reviewToken: nextReview.reviewToken },
        databaseEnv,
    );
    assert.equal(denied.status, 403, await denied.clone().text());
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM soft_assets')).rows[0].n, 1);
});

test('independent requests share database idempotency and a failed audit rolls back every creation row', async (t) => {
    const { pg, env: databaseEnv } = await createNeonPostgresFixture(t);
    Object.assign(databaseEnv, env);
    await pg.exec(`INSERT INTO users (id,username,email,password_hash,name,role) VALUES (7,'guide-admin','admin@example.test','fixture','Guide Admin','super_admin');
      INSERT INTO subregions (id,name) VALUES (10,'Fictional Region');
      INSERT INTO hard_assets (id,name,lat,lng,address,country,subregion_id) VALUES (100,'Fictional Centre',1.29,103.82,'Test address','SG',10);`);
    const actor = { id: 7, role: 'super_admin' };
    const router = routerFor(actor),
        otherWorker = routerFor({ ...actor });
    const unscheduled = {
        ...baseDraft,
        schedule: '',
        schedulePlan: { enabled: false, notes: '', entries: [] },
        visibility: 'public',
        bucket: 'Services',
    };
    const review = await (
        await post(router, 'review', { draft: unscheduled, requestId }, databaseEnv)
    ).json();
    const payload = { draft: review.draft, requestId, reviewToken: review.reviewToken };
    const responses = await Promise.all([
        post(router, 'create', payload, databaseEnv),
        post(otherWorker, 'create', payload, databaseEnv),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
    const results = await Promise.all(responses.map((r) => r.json()));
    assert.equal(results[0].resource.id, results[1].resource.id);
    assert.equal((await pg.query('SELECT bucket FROM soft_assets')).rows[0].bucket, 'Services');
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM soft_assets')).rows[0].n, 1);
    const differing = await (
        await post(
            router,
            'review',
            { draft: { ...unscheduled, name: 'Different name' }, requestId },
            databaseEnv,
        )
    ).json();
    const mismatch = await post(
        router,
        'create',
        { draft: differing.draft, requestId, reviewToken: differing.reviewToken },
        databaseEnv,
    );
    assert.equal(mismatch.status, 409);
    assert.equal((await mismatch.json()).code, 'GUIDE_ACTION_CONFLICT');
    const failId = '39a84d0b-fb42-40fd-8ab6-8798111a8d98';
    const failureReview = await (
        await post(router, 'review', { draft: baseDraft, requestId: failId }, databaseEnv)
    ).json();
    const failurePayload = {
        draft: failureReview.draft,
        requestId: failId,
        reviewToken: failureReview.reviewToken,
    };
    await pg.exec(
        `ALTER TABLE sensitive_audit_logs ADD CONSTRAINT fictional_guide_audit_failure CHECK (metadata->>'guideRequestId' IS DISTINCT FROM '${failId}');`,
    );
    assert.equal((await post(router, 'create', failurePayload, databaseEnv)).status, 500);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM soft_assets')).rows[0].n, 1);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM soft_asset_locations')).rows[0].n, 1);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM offering_schedule_versions')).rows[0].n, 0);
    await pg.exec('ALTER TABLE sensitive_audit_logs DROP CONSTRAINT fictional_guide_audit_failure');
    assert.equal((await post(router, 'create', failurePayload, databaseEnv)).status, 201);
    await pg.query('UPDATE soft_assets SET name=$1 WHERE id=$2', [
        'Edited afterwards',
        results[0].resource.id,
    ]);
    const edited = await post(router, 'create', payload, databaseEnv);
    assert.equal(edited.status, 409);
    assert.equal((await edited.json()).code, 'GUIDE_ACTION_CONFLICT');
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM soft_assets')).rows[0].n, 2);
    const freshId = '49a84d0b-fb42-40fd-8ab6-8798111a8d98';
    const expiredToken = await sign(
        {
            purpose: 'guide-programme-v1',
            actorId: 7,
            requestId: freshId,
            fingerprint: await fingerprintGuideDraft(review.draft),
            exp: 1,
        },
        `${env.JWT_SECRET}:guide-review-v1`,
        'HS256',
    );
    const expired = await post(
        router,
        'create',
        { draft: review.draft, requestId: freshId, reviewToken: expiredToken },
        databaseEnv,
    );
    assert.equal(expired.status, 409);
    assert.equal((await expired.json()).code, 'GUIDE_REVIEW_REQUIRED');
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM soft_assets')).rows[0].n, 2);
});

test('Guide binds reviewed routing and atomically rejects a moved place while retaining null-region fallback', async (t) => {
    const { pg, env: databaseEnv } = await createNeonPostgresFixture(t);
    Object.assign(databaseEnv, env);
    await pg.exec(`INSERT INTO users (id,username,email,password_hash,name,role) VALUES (8,'guide-partner','partner@example.test','fixture','Guide Partner','partner');
        INSERT INTO subregions (id,name) VALUES (10,'Original Region'), (20,'Moved Region');
        INSERT INTO hard_assets (id,name,lat,lng,address,country,subregion_id) VALUES (100,'Fictional Centre',1.29,103.82,'Test address','SG',10);
        INSERT INTO hard_asset_staff_memberships (hard_asset_id,user_id,staff_role) VALUES (100,8,'staff');`);
    const actor = {
        id: 8,
        role: 'partner',
        subregionIds: [10, 20],
        hardAssetStaffAccess: [{ hardAssetId: 100, staffRole: 'staff', subregionId: 10 }],
    };
    const router = routerFor(actor);
    const review = await (await post(router, 'review', { draft: baseDraft, requestId }, databaseEnv)).json();
    await pg.exec('UPDATE hard_assets SET subregion_id=20 WHERE id=100');
    const changed = await post(
        router,
        'create',
        { draft: review.draft, requestId, reviewToken: review.reviewToken },
        databaseEnv,
    );
    assert.equal(changed.status, 409);
    assert.equal((await changed.json()).code, 'GUIDE_REVIEW_REQUIRED');
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM soft_assets')).rows[0].n, 0);

    // Reproduce a Region move after the controller computed its values: the SQL guard
    // must reject it even if both the signed review and computed values still say 10.
    const { getDb } = await import('../src/db/index.js');
    const { persistGuideProgramme } = await import('../src/utils/guideActionPersistence.js');
    const lateId = '59a84d0b-fb42-40fd-8ab6-8798111a8d98';
    await assert.rejects(
        persistGuideProgramme(
            getDb(databaseEnv),
            actor,
            {
                assetMode: 'standalone',
                partnerId: 8,
                createdByUserId: 8,
                subregionId: 10,
                name: 'Stale routing',
                isHidden: true,
            },
            [100],
            null,
            {
                requestId: lateId,
                fingerprint: 'synthetic-fingerprint',
                externalKey: `guide-programme-8-${lateId}`,
                locationId: 100,
                expired: false,
                routing: { placeSubregionId: 10, effectiveSubregionId: 10, ownerId: 8 },
            },
        ),
        (error) => error.status === 409 && error.code === 'GUIDE_REVIEW_REQUIRED',
    );
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM soft_assets')).rows[0].n, 0);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM soft_asset_locations')).rows[0].n, 0);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM sensitive_audit_logs')).rows[0].n, 0);

    // Existing partner fallback remains valid when the place still has no Region.
    await pg.exec('UPDATE hard_assets SET subregion_id=NULL WHERE id=100');
    const fallbackId = '69a84d0b-fb42-40fd-8ab6-8798111a8d98';
    const fallback = await (
        await post(router, 'review', { draft: baseDraft, requestId: fallbackId }, databaseEnv)
    ).json();
    const fallbackPayload = {
        draft: fallback.draft,
        requestId: fallbackId,
        reviewToken: fallback.reviewToken,
    };
    const saved = await post(router, 'create', fallbackPayload, databaseEnv);
    assert.equal(saved.status, 201, await saved.clone().text());
    assert.equal((await pg.query('SELECT subregion_id FROM soft_assets')).rows[0].subregion_id, 10);
    assert.equal((await post(router, 'create', fallbackPayload, databaseEnv)).status, 200);
});


test('explicitly blank draft timetable defeats model filler and clears a changed structured plan', async () => {
    const empty = guideProgrammeDraftSchema.parse({ name: 'Fictional Welcome', description: 'Find activities.', bucket: 'Services' });
    const scheduled = guideProgrammeDraftSchema.parse({ ...baseDraft, schedulePlan: plan });
    const runtime = { NODE_ENV: 'production', GUIDE_CHAT_ENABLED: 'true', GUIDE_AI_GATEWAY_ID: 'guide-oracle',
        AI: { run: async () => ({ response: JSON.stringify({ name: 'Fictional Welcome', description: 'Find activities.', schedule: 'To be determined' }) }) } };
    for (const message of ['Leave the timetable blank because we have not picked dates.',
        'Keep the schedule empty.', 'Rename it Fictional Welcome, leaving the dates undecided.']) {
        for (const draft of [empty, scheduled]) {
            const answer = await draftGuideProgramme({ message, draft, useAi: true }, runtime);
            assert.equal(answer.aiAvailable, true); assert.equal(answer.draft.schedule, '');
            assert.deepEqual(answer.draft.schedulePlan, { enabled: false, notes: '', entries: [] });
            assert.equal(answer.draft.visibility, draft.visibility); assert.equal(answer.draft.locationId, draft.locationId);
        }
    }
    const preserve = await draftGuideProgramme({ message: 'Rename it Fictional Welcome', draft: scheduled, useAi: true }, runtime);
    assert.equal(preserve.draft.schedule, scheduled.schedule); assert.deepEqual(preserve.draft.schedulePlan, scheduled.schedulePlan);
    const negative = await draftGuideProgramme({ message: 'Do not leave the schedule blank; change it to Monday 10am.', draft: empty, useAi: true },
        { ...runtime, AI: { run: async () => ({ response: JSON.stringify({ name: empty.name, description: empty.description, schedule: 'Monday 10am' }) }) } });
    assert.equal(negative.draft.schedule, 'Monday 10am');
});
