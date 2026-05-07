import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import {
    buildGudAuthCanonicalString,
    createGudAuthClient,
    signGudAuthRequest,
} from '../src/utils/gudAuthClient.js';

test('GudAuth HMAC signature uses the confirmed canonical string', async () => {
    const timestamp = '1777777777';
    const rawBody = JSON.stringify({
        phoneNumber: '+6583682962',
        referenceId: 'carearound-phone-link:12',
    });
    const canonical = buildGudAuthCanonicalString({
        timestamp,
        method: 'post',
        pathname: '/api/integrations/challenges',
        rawBody,
    });

    assert.equal(canonical, [
        timestamp,
        'POST',
        '/api/integrations/challenges',
        rawBody,
    ].join('\n'));

    const expected = createHmac('sha256', 'test-secret').update(canonical).digest('hex');
    assert.equal(await signGudAuthRequest('test-secret', canonical), expected);
});

test('GudAuth client signs POST and GET requests without exposing secrets', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
        calls.push({ url, options });
        return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ id: 'challenge-123', status: 'pending' }),
        };
    };
    const env = {
        GUDAUTH_API_BASE_URL: 'https://gudauth.app',
        GUDAUTH_PRODUCT_ID: 'carearound-sg',
        GUDAUTH_REQUEST_SECRET: 'super-secret-value',
    };
    const client = createGudAuthClient(env, {
        fetchImpl,
        nowInSeconds: () => 1777777777,
    });

    await client.createChallenge({
        phoneNumber: '+6583682962',
        referenceId: 'carearound-phone-link:12',
    });
    await client.getChallenge('challenge-123');

    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://gudauth.app/api/integrations/challenges');
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), {
        phoneNumber: '+6583682962',
        referenceId: 'carearound-phone-link:12',
    });
    assert.equal(calls[0].options.headers['X-GudOTP-Product'], 'carearound-sg');
    assert.equal(calls[0].options.headers['X-GudOTP-Timestamp'], '1777777777');
    assert.ok(calls[0].options.headers['X-GudOTP-Signature']);
    assert.doesNotMatch(JSON.stringify(calls[0]), /super-secret-value/);

    assert.equal(calls[1].url, 'https://gudauth.app/api/integrations/challenges/challenge-123');
    assert.equal(calls[1].options.method, 'GET');
    assert.equal(calls[1].options.body, undefined);

    const getCanonical = buildGudAuthCanonicalString({
        timestamp: '1777777777',
        method: 'GET',
        pathname: '/api/integrations/challenges/challenge-123',
        rawBody: '',
    });
    const expectedGetSignature = createHmac('sha256', 'super-secret-value').update(getCanonical).digest('hex');
    assert.equal(calls[1].options.headers['X-GudOTP-Signature'], expectedGetSignature);
});
