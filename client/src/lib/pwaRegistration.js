const SERVICE_WORKER_PATH = '/pwa/carearound-sw';
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

function getRuntimeEnv() {
    return import.meta.env || {};
}

function isLocalhost(hostname = '') {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function canRegisterServiceWorker({ navigatorLike, locationLike, env = {} } = {}) {
    if (!env.PROD) return false;
    if (!navigatorLike?.serviceWorker) return false;
    const protocol = locationLike?.protocol || '';
    const hostname = locationLike?.hostname || '';
    return protocol === 'https:' || isLocalhost(hostname);
}

function dispatchPwaUpdateReady(win, registration) {
    if (!win?.dispatchEvent || typeof win.CustomEvent !== 'function') return;
    win.dispatchEvent(new win.CustomEvent('carearound:pwa-update-ready', {
        detail: { registration },
    }));
}

function wireUpdateLifecycle(win, registration) {
    const serviceWorker = win?.navigator?.serviceWorker;
    if (!serviceWorker || !registration) return;
    let hasReloadedForControllerChange = false;

    if (registration.waiting && serviceWorker.controller) {
        dispatchPwaUpdateReady(win, registration);
    }

    registration.addEventListener?.('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener?.('statechange', () => {
            if (worker.state === 'installed' && serviceWorker.controller) {
                dispatchPwaUpdateReady(win, registration);
            }
        });
    });

    win.addEventListener?.('carearound:pwa-activate-update', () => {
        registration.waiting?.postMessage?.({ type: 'SKIP_WAITING' });
    });

    serviceWorker.addEventListener?.('controllerchange', () => {
        if (hasReloadedForControllerChange) return;
        hasReloadedForControllerChange = true;
        win.location?.reload?.();
    });
}

export async function registerCareAroundPwa(win = globalThis.window, env = getRuntimeEnv()) {
    if (!win || !canRegisterServiceWorker({
        navigatorLike: win.navigator,
        locationLike: win.location,
        env,
    })) {
        return null;
    }

    try {
        const registration = await win.navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
            scope: '/',
        });
        wireUpdateLifecycle(win, registration);
        if (typeof registration.update === 'function') {
            win.setInterval?.(() => {
                registration.update().catch(() => {});
            }, UPDATE_CHECK_INTERVAL_MS);
        }
        return registration;
    } catch (err) {
        console.warn('CareAround PWA service worker registration failed.', err);
        return null;
    }
}
