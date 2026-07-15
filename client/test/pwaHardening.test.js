import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    canRegisterServiceWorker,
    registerCareAroundPwa,
} from '../src/lib/pwaRegistration.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../public/site.webmanifest', import.meta.url), 'utf8'));
const serviceWorkerSource = fs.readFileSync(new URL('../public/pwa/carearound-sw.js', import.meta.url), 'utf8');
const offlineSource = fs.readFileSync(new URL('../public/offline.html', import.meta.url), 'utf8');
const headersSource = fs.readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('PWA manifest keeps CareAround installable metadata scoped to the app', () => {
    assert.equal(manifest.name, 'CareAround SG');
    assert.equal(manifest.start_url, '/discover');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.id, '/');
    assert.equal(manifest.lang, 'en-SG');
    assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.src === '/icon-192.png'));
    assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.src === '/icon-512.png'));
    assert.ok(manifest.shortcuts.some((shortcut) => shortcut.url === '/discover'));
    assert.ok(manifest.shortcuts.some((shortcut) => shortcut.url === '/my-directory'));
});

test('service worker registration is production-only and requires a secure context', () => {
    assert.equal(canRegisterServiceWorker({
        env: { PROD: false },
        navigatorLike: { serviceWorker: {} },
        locationLike: { protocol: 'https:', hostname: 'app.carearound.sg' },
    }), false);

    assert.equal(canRegisterServiceWorker({
        env: { PROD: true },
        navigatorLike: { serviceWorker: {} },
        locationLike: { protocol: 'http:', hostname: 'app.carearound.sg' },
    }), false);

    assert.equal(canRegisterServiceWorker({
        env: { PROD: true },
        navigatorLike: { serviceWorker: {} },
        locationLike: { protocol: 'https:', hostname: 'app.carearound.sg' },
    }), true);
});

test('service worker registration wires the CareAround worker without touching app routes', async () => {
    const calls = [];
    const registration = {
        addEventListener: (eventName) => calls.push(['registration-listener', eventName]),
        update: async () => calls.push(['update']),
    };
    const win = {
        navigator: {
            serviceWorker: {
                controller: {},
                register: async (...args) => {
                    calls.push(['register', ...args]);
                    return registration;
                },
                addEventListener: (eventName) => calls.push(['service-worker-listener', eventName]),
            },
        },
        location: {
            protocol: 'https:',
            hostname: 'app.carearound.sg',
            reload: () => calls.push(['reload']),
        },
        addEventListener: (eventName) => calls.push(['window-listener', eventName]),
        setInterval: (callback, delay) => {
            calls.push(['interval', delay]);
            return 1;
        },
    };

    const result = await registerCareAroundPwa(win, { PROD: true });

    assert.equal(result, registration);
    assert.deepEqual(calls[0], ['register', '/pwa/carearound-sw.js', { scope: '/' }]);
    assert.ok(calls.some(([kind, value]) => kind === 'registration-listener' && value === 'updatefound'));
    assert.ok(calls.some(([kind, value]) => kind === 'service-worker-listener' && value === 'controllerchange'));
    assert.ok(calls.some(([kind, value]) => kind === 'window-listener' && value === 'carearound:pwa-activate-update'));
});

test('service worker keeps API/auth traffic network-owned and uses offline fallback for navigation only', () => {
    assert.match(serviceWorkerSource, /url\.pathname === '\/api'/);
    assert.match(serviceWorkerSource, /url\.pathname\.startsWith\('\/api\/'\)/);
    assert.match(serviceWorkerSource, /if \(isApiRequest\(url\)\) return;/);
    assert.match(serviceWorkerSource, /event\.request\.mode === 'navigate'/);
    assert.match(serviceWorkerSource, /caches\.match\(OFFLINE_URL\)/);
    assert.match(serviceWorkerSource, /new Response\('CareAround SG is offline/);
    assert.doesNotMatch(serviceWorkerSource, /\/auth\/me/);
});

test('offline and delivery files are present and service worker updates are not cached by Cloudflare Pages', () => {
    assert.match(offlineSource, /You are offline/);
    assert.match(offlineSource, /CareAround SG needs a connection/);
    assert.match(headersSource, /\/pwa\/carearound-sw\.js[\s\S]*Cache-Control: no-cache/);
    assert.match(headersSource, /\/pwa\/carearound-sw\.js[\s\S]*Service-Worker-Allowed: \//);
    assert.match(headersSource, /\/site\.webmanifest[\s\S]*Cache-Control: no-cache/);
    assert.match(headersSource, /\/offline\.html[\s\S]*Cache-Control: no-cache/);
    assert.match(mainSource, /registerCareAroundPwa\(\)/);
});
