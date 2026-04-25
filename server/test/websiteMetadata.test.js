import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchWebsiteMetadata } from '../src/utils/websiteMetadata.js';

function htmlResponse(html, url = 'https://example.org/') {
    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
        },
    });
}

function imageResponse(contentType = 'image/png') {
    return new Response('', {
        status: 200,
        headers: {
            'Content-Type': contentType,
        },
    });
}

test('fetchWebsiteMetadata extracts and validates likely logo image elements', async () => {
    const originalFetch = global.fetch;
    const calls = [];

    global.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.url;
        calls.push({ url, method: init.method || 'GET' });

        if (url === 'https://example.org/') {
            return htmlResponse(`
                <html>
                    <head>
                        <meta name="description" content="Helpful community services.">
                    </head>
                    <body>
                        <img class="site-logo" src="/assets/logo.svg" alt="Example logo">
                    </body>
                </html>
            `);
        }

        if (url === 'https://example.org/assets/logo.svg') {
            return imageResponse('image/svg+xml');
        }

        throw new Error(`Unexpected fetch in test: ${url}`);
    };

    try {
        const metadata = await fetchWebsiteMetadata('https://example.org/');

        assert.equal(metadata.description, 'Helpful community services.');
        assert.equal(metadata.logoUrl, 'https://example.org/assets/logo.svg');
        assert.deepEqual(metadata.warnings, []);
        assert.equal(calls.some((call) => call.url === 'https://example.org/assets/logo.svg'), true);
    } finally {
        global.fetch = originalFetch;
    }
});

test('fetchWebsiteMetadata falls back to favicon when page has no logo metadata', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url === 'https://example.org/') {
            return htmlResponse('<html><head><title>No logo</title></head><body>Hello</body></html>');
        }

        if (url === 'https://example.org/favicon.ico') {
            return imageResponse('image/x-icon');
        }

        throw new Error(`Unexpected fetch in test: ${url}`);
    };

    try {
        const metadata = await fetchWebsiteMetadata('https://example.org/');

        assert.equal(metadata.logoUrl, 'https://example.org/favicon.ico');
    } finally {
        global.fetch = originalFetch;
    }
});

test('fetchWebsiteMetadata skips invalid image candidates before using fallback', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input.url;

        if (url === 'https://example.org/') {
            return htmlResponse(`
                <html>
                    <head>
                        <meta property="og:image" content="/not-an-image">
                    </head>
                    <body></body>
                </html>
            `);
        }

        if (url === 'https://example.org/not-an-image') {
            return new Response('<html>not image</html>', {
                status: 200,
                headers: { 'Content-Type': 'text/html' },
            });
        }

        if (url === 'https://example.org/favicon.ico') {
            return imageResponse('image/x-icon');
        }

        throw new Error(`Unexpected fetch in test: ${url}`);
    };

    try {
        const metadata = await fetchWebsiteMetadata('https://example.org/');

        assert.equal(metadata.logoUrl, 'https://example.org/favicon.ico');
    } finally {
        global.fetch = originalFetch;
    }
});
