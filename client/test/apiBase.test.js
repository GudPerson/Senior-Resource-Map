import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getApiBaseCandidatesForEnvironment,
    getSessionApiBaseCandidatesForEnvironment,
} from '../src/lib/apiBase.js';

test('production app host prefers same-site API custom domain over workers.dev env base', () => {
    const candidates = getApiBaseCandidatesForEnvironment({
        hostname: 'app.carearound.sg',
        envApiUrl: 'https://senior-resource-map-api.joshuachua79.workers.dev/api',
    });

    assert.equal(candidates[0], 'https://api.carearound.sg/api');
    assert.equal(candidates.includes('https://senior-resource-map-api.joshuachua79.workers.dev/api'), true);
});

test('production session checks use only the cookie-owning API custom domain', () => {
    const candidates = getSessionApiBaseCandidatesForEnvironment({
        hostname: 'app.carearound.sg',
        envApiUrl: 'https://senior-resource-map-api.joshuachua79.workers.dev/api',
    });

    assert.deepEqual(candidates, ['https://api.carearound.sg/api']);
});

test('preview session checks keep the preview API origin as the cookie owner', () => {
    const candidates = getSessionApiBaseCandidatesForEnvironment({
        hostname: 'preview.senior-resource-map.pages.dev',
        envApiUrl: '',
    });

    assert.deepEqual(candidates, ['https://senior-resource-map-api.joshuachua79.workers.dev/api']);
});

test('Cloudflare Pages previews keep workers.dev fallback for isolated preview auth', () => {
    const candidates = getApiBaseCandidatesForEnvironment({
        hostname: 'preview.senior-resource-map.pages.dev',
        envApiUrl: '',
    });

    assert.deepEqual(candidates, ['https://senior-resource-map-api.joshuachua79.workers.dev/api', '/api']);
});

test('local development keeps relative API base when no explicit API URL is set', () => {
    const candidates = getApiBaseCandidatesForEnvironment({
        hostname: 'localhost',
        envApiUrl: '',
    });

    assert.deepEqual(candidates, ['/api']);
});
