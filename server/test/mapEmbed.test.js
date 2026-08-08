import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MAX_MAP_EMBED_ORIGINS,
    normalizeMapEmbedOrigin,
    normalizeMapEmbedOrigins,
} from '../src/utils/mapEmbed.js';

test('normalizeMapEmbedOrigin keeps exact secure origins and removes a trailing slash', () => {
    assert.equal(
        normalizeMapEmbedOrigin(' https://WWW.Example.org.sg/ '),
        'https://www.example.org.sg',
    );
    assert.equal(
        normalizeMapEmbedOrigin('https://staging.example.org.sg:8443'),
        'https://staging.example.org.sg:8443',
    );
});

test('normalizeMapEmbedOrigin allows HTTP only for local development hosts', () => {
    assert.equal(normalizeMapEmbedOrigin('http://localhost:4173'), 'http://localhost:4173');
    assert.equal(normalizeMapEmbedOrigin('http://127.0.0.1:4173'), 'http://127.0.0.1:4173');
    assert.throws(
        () => normalizeMapEmbedOrigin('http://www.example.org.sg'),
        /must use HTTPS/,
    );
});

test('normalizeMapEmbedOrigin rejects ambiguous or over-broad values', () => {
    const invalidValues = [
        'example.org.sg',
        'https://*.example.org.sg',
        'https://example.org.sg/page',
        'https://example.org.sg?preview=true',
        'https://example.org.sg#map',
        'https://user:password@example.org.sg',
        'javascript:alert(1)',
    ];

    invalidValues.forEach((value) => {
        assert.throws(() => normalizeMapEmbedOrigin(value));
    });
});

test('normalizeMapEmbedOrigins de-duplicates normalized origins and enforces the bound', () => {
    assert.deepEqual(
        normalizeMapEmbedOrigins([
            'https://www.example.org.sg',
            'https://WWW.EXAMPLE.ORG.SG/',
            'https://staging.example.org.sg',
        ]),
        ['https://www.example.org.sg', 'https://staging.example.org.sg'],
    );

    assert.throws(
        () => normalizeMapEmbedOrigins(Array.from(
            { length: MAX_MAP_EMBED_ORIGINS + 1 },
            (_, index) => `https://site-${index}.example.org.sg`,
        )),
        /up to 10 websites/,
    );
});
