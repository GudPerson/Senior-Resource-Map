import assert from 'node:assert/strict';
import test from 'node:test';

import app from '../src/app.js';
import {
    answerHelpQuestion,
    findHelpEntry,
    isAcceptableAiRewrite,
    redactHelpQuestion,
} from '../src/utils/helpAssistant.js';
import {
    getHelpCapabilities,
    normalizeHelpRouteContext,
} from '../src/utils/helpKnowledge.js';

test('help route context removes resource ids and share tokens', () => {
    assert.equal(normalizeHelpRouteContext('/resource/hard/123?from=map'), 'resource');
    assert.equal(normalizeHelpRouteContext('/shared/maps/private-token-value'), 'shared-map');
    assert.equal(normalizeHelpRouteContext('/my-directory/maps/42'), 'my-map');
});

test('help capabilities follow current role and access assignments', () => {
    const standard = getHelpCapabilities({ id: 1, role: 'standard' });
    assert.equal(standard.directory, true);
    assert.equal(standard.managedResources, false);
    assert.equal(standard.organization, false);

    const resourceStaff = getHelpCapabilities({
        id: 2,
        role: 'standard',
        hardAssetStaffAccess: [{ hardAssetId: 7, staffRole: 'staff' }],
    });
    assert.equal(resourceStaff.managedResources, true);

    const organizationAdmin = getHelpCapabilities({
        id: 3,
        role: 'standard',
        organizationAccess: [{ organizationId: 8, accessRole: 'admin' }],
    });
    assert.equal(organizationAdmin.organization, true);
    assert.equal(organizationAdmin.audit, true);
    assert.equal(organizationAdmin.managedResources, false);
});

test('free-form help matching resolves common navigation language', () => {
    assert.equal(findHelpEntry({
        question: 'How do I save this?',
        routeContext: 'resource',
    })?.entry.id, 'save-resource');
    assert.equal(findHelpEntry({
        question: 'Why cant I edit this resource?',
        routeContext: 'managed-resources',
    })?.entry.id, 'access-permission');
    assert.equal(findHelpEntry({
        question: 'The page says session expired',
        routeContext: 'login',
    })?.entry.id, 'sign-in-problem');
});

test('help redaction removes contact details, links, and secret-like values', () => {
    const redacted = redactHelpQuestion(
        'My email is user@example.com, phone is +65 9123 4567, password=secret and link https://example.com/private',
    );
    assert.doesNotMatch(redacted, /user@example\.com/);
    assert.doesNotMatch(redacted, /9123 4567/);
    assert.doesNotMatch(redacted, /secret/);
    assert.doesNotMatch(redacted, /example\.com/);
});

test('AI rewrite quality gate rejects vague answers that drop verified guidance', () => {
    const verified = 'Check that your device is online, then retry the page. If the app was already open during an update, refresh it once.';
    assert.equal(isAcceptableAiRewrite('I am here to help.', verified), false);
    assert.equal(
        isAcceptableAiRewrite('Check that your device is online, then retry or refresh the page once.', verified),
        true,
    );
});

test('verified help works without Workers AI and filters unavailable routes', async () => {
    const guestResult = await answerHelpQuestion({}, {
        user: { role: 'guest' },
        topicId: 'save-resource',
        pathname: '/resource/hard/4',
    });
    assert.equal(guestResult.source, 'verified');
    assert.match(guestResult.message, /need to sign in/i);
    assert.deepEqual(guestResult.actions, [
        { kind: 'navigate', label: 'Sign in', route: '/login' },
    ]);

    const staffResult = await answerHelpQuestion({}, {
        user: {
            id: 9,
            role: 'standard',
            hardAssetStaffAccess: [{ hardAssetId: 4, staffRole: 'staff' }],
        },
        topicId: 'managed-resources',
        pathname: '/dashboard',
    });
    assert.equal(staffResult.actions[0].route, '/dashboard/resources');
});

test('capability-limited guidance never goes to Workers AI', async () => {
    let callCount = 0;
    const result = await answerHelpQuestion({
        HELP_ASSISTANT_AI_ENABLED: 'true',
        AI: {
            async run() {
                callCount += 1;
                return { response: 'You can save without an account.' };
            },
        },
    }, {
        user: { role: 'guest' },
        question: 'How do I save this resource?',
        pathname: '/discover',
        locale: 'en',
    });

    assert.equal(callCount, 0);
    assert.equal(result.source, 'verified');
    assert.match(result.message, /need to sign in/i);
});

test('vague Workers AI output falls back to the complete verified answer', async () => {
    const result = await answerHelpQuestion({
        HELP_ASSISTANT_AI_ENABLED: 'true',
        HELP_ASSISTANT_AI_DAILY_LIMIT: '5',
        AI: {
            async run() {
                return { response: 'I am here to help.' };
            },
        },
    }, {
        user: { id: 4, role: 'standard' },
        question: 'The page is stuck and failed to load',
        pathname: '/my-directory',
        locale: 'en',
    });

    assert.equal(result.source, 'verified');
    assert.match(result.message, /check that your device is online/i);
});

test('Workers AI only rewrites verified guidance with redacted input', async () => {
    const calls = [];
    const result = await answerHelpQuestion({
        HELP_ASSISTANT_AI_ENABLED: 'true',
        HELP_ASSISTANT_AI_DAILY_LIMIT: '2',
        AI: {
            async run(model, input, options) {
                calls.push({ model, input, options });
                return { response: 'Open Discover, choose the resource, then select Save. It will appear in My Directory.' };
            },
        },
    }, {
        user: { id: 1, role: 'standard' },
        question: 'How do I save this? My email is user@example.com',
        pathname: '/resource/hard/44',
        locale: 'en',
    });

    assert.equal(result.source, 'ai-assisted');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, '@cf/meta/llama-3.2-1b-instruct');
    assert.doesNotMatch(calls[0].input.messages[0].content, /user@example\.com/);
    assert.doesNotMatch(calls[0].input.messages[0].content, /hard\/44/);
    assert.equal(calls[0].options.gateway.collectLog, false);
});

test('public help API returns deterministic guidance without database access', async () => {
    const response = await app.fetch(
        new Request('https://app.carearound.sg/api/help/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'https://app.carearound.sg',
            },
            body: JSON.stringify({
                topicId: 'discover-resources',
                context: { pathname: '/discover', locale: 'en' },
            }),
        }),
        {
            NODE_ENV: 'test',
            HELP_ASSISTANT_AI_ENABLED: 'false',
        },
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.id, 'discover-resources');
    assert.equal(payload.source, 'verified');
    assert.equal(payload.actions[0].route, '/discover');
});
