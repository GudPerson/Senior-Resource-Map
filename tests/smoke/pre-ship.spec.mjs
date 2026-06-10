import { expect, test } from 'playwright/test';

const DEFAULT_POSTAL_CODE = '680153';
const DEFAULT_POSTAL_KEYWORD = 'active ageing';
const CAREAROUND_API_BASE = 'https://api.carearound.sg/api';
const CLOUDFLARE_FALLBACK_API_BASE = 'https://senior-resource-map-api.joshuachua79.workers.dev/api';
const PARTNER_LOGIN_ATTEMPTS = 5;
const PARTNER_LOGIN_RETRY_DELAY_MS = 1_500;
const PARTNER_LOGIN_RESPONSE_TIMEOUT_MS = 20_000;
const SETUP_API_ATTEMPTS = 5;
const SETUP_API_TIMEOUT_MS = 90_000;
const FAVORITES_UI_TIMEOUT_MS = 90_000;

test.describe.configure({ retries: 1 });

let partnerStorageState = null;

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function normalizeBase(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

function resolveConfiguredValue(name, fallback = '') {
    return normalizeBase(process.env[name] || fallback);
}

function resolveApiBase(baseURL) {
    const explicit = resolveConfiguredValue('SMOKE_API_BASE');
    if (explicit) return explicit;

    const url = new URL(baseURL);
    if (url.hostname === 'app.carearound.sg') {
        return CAREAROUND_API_BASE;
    }
    if (url.hostname.endsWith('.pages.dev')) {
        return CLOUDFLARE_FALLBACK_API_BASE;
    }
    return `${url.origin}/api`;
}

function ensureSmokeCredentials() {
    const username = String(process.env.SMOKE_PARTNER_USERNAME || '').trim();
    const password = String(process.env.SMOKE_PARTNER_PASSWORD || '').trim();

    if (!username || !password) {
        throw new Error(
            'Smoke credentials are missing. Set SMOKE_PARTNER_USERNAME and SMOKE_PARTNER_PASSWORD before running npm run test:smoke.'
        );
    }

    return { username, password };
}

function isTransientLoginStatus(status) {
    return status === 408 || status === 429 || status >= 500;
}

function isTransientApiStatus(status) {
    return status === 408 || status === 429 || status >= 500;
}

async function expectAuthenticatedSession(page) {
    await expect.poll(async () => {
        const apiBase = resolveApiBase(page.url());
        const cookieUrl = new URL(apiBase);
        const cookies = await page.context().cookies(`${cookieUrl.protocol}//${cookieUrl.hostname}`);
        return cookies.some((cookie) => cookie.name === 'sc_token') ? 'session-cookie' : null;
    }, {
        message: 'partner login should store the API session cookie before smoke continues',
        timeout: 30_000,
        intervals: [250, 500, 1000],
    }).toBe('session-cookie');
    await expect(page.getByRole('button', { name: 'Logout' }).first()).toBeVisible({ timeout: 30_000 });
}

async function waitForPartnerLoginResponse(page) {
    const isLoginRequest = (request) => (
        request.url().includes('/auth/login') && request.method() === 'POST'
    );
    const responsePromise = page.waitForResponse((response) => (
        isLoginRequest(response.request())
    ), { timeout: PARTNER_LOGIN_RESPONSE_TIMEOUT_MS }).then((response) => ({ response }));
    const failedPromise = page.waitForEvent('requestfailed', {
        predicate: isLoginRequest,
        timeout: PARTNER_LOGIN_RESPONSE_TIMEOUT_MS,
    }).then((request) => ({ failure: request.failure()?.errorText || 'Login request failed' }));

    return Promise.race([responsePromise, failedPromise]);
}

async function cachePartnerSession(page) {
    partnerStorageState = await page.context().storageState();
}

async function waitBeforeLoginRetry(attempt) {
    if (attempt < PARTNER_LOGIN_ATTEMPTS) {
        await sleep(PARTNER_LOGIN_RETRY_DELAY_MS * attempt);
    }
}

async function restorePartnerSession(page) {
    if (!partnerStorageState?.cookies?.length) return false;

    try {
        await page.context().addCookies(partnerStorageState.cookies);
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await expectAuthenticatedSession(page);
        return true;
    } catch {
        return false;
    }
}

async function loginAsPartner(page, { forceUi = false } = {}) {
    if (!forceUi && await restorePartnerSession(page)) {
        return;
    }

    const { username, password } = ensureSmokeCredentials();
    let lastLoginError = null;

    for (let attempt = 1; attempt <= PARTNER_LOGIN_ATTEMPTS; attempt += 1) {
        await page.goto('/partner-login', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('#auth-login-id')).toBeVisible();
        await page.locator('#auth-login-id').fill(username);
        await page.locator('#auth-password').fill(password);

        await page.locator('#auth-submit').click();

        let loginOutcome = null;
        try {
            loginOutcome = await waitForPartnerLoginResponse(page);
        } catch (err) {
            lastLoginError = err;
            await waitBeforeLoginRetry(attempt);
            continue;
        }

        if (loginOutcome.failure) {
            lastLoginError = new Error(loginOutcome.failure);
            await waitBeforeLoginRetry(attempt);
            continue;
        }

        const loginResponse = loginOutcome.response;

        if (!loginResponse.ok()) {
            if (!isTransientLoginStatus(loginResponse.status())) {
                throw new Error(`Partner login failed with status ${loginResponse.status()}. Check the smoke account credentials.`);
            }
            lastLoginError = new Error(`Partner login transiently failed with status ${loginResponse.status()}.`);
            await waitBeforeLoginRetry(attempt);
            continue;
        }

        await page.waitForURL(/\/dashboard(?:$|\/)/, { timeout: 30_000 });

        try {
            await expectAuthenticatedSession(page);
            await cachePartnerSession(page);
            return;
        } catch (err) {
            lastLoginError = err;
        }

        await waitBeforeLoginRetry(attempt);
    }

    throw lastLoginError || new Error('Partner login did not establish a session.');
}

function savedResourceDetailLink(page) {
    return page.getByRole('link', { name: /View (details|place)/i }).first();
}

async function requestSetupJson(page, path, { method = 'GET', data = undefined } = {}) {
    const apiBase = resolveApiBase(process.env.SMOKE_BASE_URL || page.url() || 'http://127.0.0.1:5173');
    let lastError = null;

    for (let attempt = 1; attempt <= SETUP_API_ATTEMPTS; attempt += 1) {
        try {
            const response = await page.context().request.fetch(`${apiBase}${path}`, {
                method,
                ...(data !== undefined ? { data } : {}),
                timeout: SETUP_API_TIMEOUT_MS,
            });
            if (response.ok()) {
                return await response.json();
            }
            if (!isTransientApiStatus(response.status())) {
                throw new Error(`Setup API ${method} ${path} failed with status ${response.status()}.`);
            }
            lastError = new Error(`Setup API ${method} ${path} transiently failed with status ${response.status()}.`);
        } catch (err) {
            lastError = err;
        }

        if (attempt < SETUP_API_ATTEMPTS) {
            await sleep(2_000 * attempt);
        }
    }

    throw lastError || new Error(`Setup API ${method} ${path} did not complete.`);
}

function pickSeedResource(cacheRows) {
    if (!Array.isArray(cacheRows)) return null;
    return cacheRows.find((item) => {
        const type = String(item?.asset_type || '').trim().toLowerCase();
        const id = Number.parseInt(String(item?.id ?? ''), 10);
        return (type === 'hard' || type === 'soft') && Number.isInteger(id) && id > 0;
    }) || null;
}

async function ensureSavedAsset(page) {
    const existing = await requestSetupJson(page, '/favorites');
    if (Array.isArray(existing) && existing.length > 0) {
        return;
    }

    const cacheRows = await requestSetupJson(page, '/public/discovery-cache/all');
    const seedResource = pickSeedResource(cacheRows);
    if (!seedResource) {
        throw new Error('Smoke setup could not find a public resource to save.');
    }
    const resourceId = Number.parseInt(String(seedResource.id), 10);
    const result = await requestSetupJson(page, '/favorites/toggle', {
        method: 'POST',
        data: {
            resourceType: seedResource.asset_type,
            resourceId,
        },
    });
    expect(result?.saved, 'smoke setup should seed at least one saved asset').toBeTruthy();
}

async function openPostalImportWizard(page) {
    await page.goto('/dashboard/resources', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'New Place' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'New Place' }).click();
    await page.getByText('Import with Google').click();
    await expect(page.getByText('Import Place with Google')).toBeVisible();
}

test('public app loads and redirects to discover', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/discover$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Find care and support near you' }).first()).toBeVisible({ timeout: 30_000 });
});

test('partner login succeeds and dashboard resources loads', async ({ page }) => {
    await loginAsPartner(page, { forceUi: true });
    await page.goto('/dashboard/resources', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'New Place' })).toBeVisible({ timeout: 30_000 });
});

test('postal import wizard can search and open a draft without losing the queue', async ({ page }) => {
    await loginAsPartner(page);
    await openPostalImportWizard(page);

    await page.locator('#google-place-postal-code').fill(process.env.SMOKE_POSTAL_CODE || DEFAULT_POSTAL_CODE);
    await page.locator('#google-place-keyword-query').fill(process.env.SMOKE_POSTAL_KEYWORD || DEFAULT_POSTAL_KEYWORD);
    await page.getByTestId('postal-import-search').click();

    await expect(page.getByText('Resolved postal anchor')).toBeVisible({ timeout: 45_000 });

    const addressDraftAddButton = page.getByTestId('postal-address-draft-add');
    if (await addressDraftAddButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await page.getByTestId('postal-address-draft-add').click();
        await page.getByTestId('postal-address-draft-review').click();
    } else {
        await page.locator('[data-testid^="postal-candidate-add-"]').first().click();
        await page.locator('[data-testid^="postal-draft-review-"]').first().click();
    }

    await expect(page.getByText('Draft review')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Resolved postal anchor')).toBeVisible({ timeout: 15_000 });
});

test('create-map flow can select saved assets and submit the modal path', async ({ page }, testInfo) => {
    await loginAsPartner(page);
    await ensureSavedAsset(page);

    const savedAssetsReloadPromise = page.waitForResponse((response) => (
        response.url().includes('/favorites') && response.request().method() === 'GET'
    ), { timeout: FAVORITES_UI_TIMEOUT_MS });
    await page.goto('/my-directory?section=my-maps', { waitUntil: 'domcontentloaded' });
    const savedAssetsReload = await savedAssetsReloadPromise;
    expect(savedAssetsReload.ok(), 'saved assets should reload before opening the create-map modal').toBeTruthy();
    await page.getByRole('button', { name: 'Create map' }).first().click();

    const smokeMapName = `Smoke Map ${Date.now()}`;
    await page.locator('#create-map-name').fill(smokeMapName);

    const firstSelectableAsset = page.locator('[data-testid^="create-map-asset-"]').first();
    await expect(firstSelectableAsset).toBeVisible({ timeout: 15_000 });
    await firstSelectableAsset.check();
    await expect(page.getByText(/1 (asset|resource) selected/i)).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('create-map-submit').click();
    await page.waitForURL(/\/my-directory\/maps\/\d+$/, { timeout: 30_000 });

    const mapIdMatch = page.url().match(/\/my-directory\/maps\/(\d+)$/);
    expect(mapIdMatch?.[1]).toBeTruthy();

    const mapId = mapIdMatch[1];
    const apiBase = resolveApiBase(String(testInfo.project.use.baseURL));
    const deleteResponse = await page.context().request.delete(`${apiBase}/my-maps/${mapId}`);
    expect(deleteResponse.ok(), 'created smoke map should be removable during cleanup').toBeTruthy();
});

test('saved resource detail still opens from the discover side of the product', async ({ page }) => {
    await loginAsPartner(page);
    await ensureSavedAsset(page);

    await page.goto('/my-directory', { waitUntil: 'domcontentloaded' });
    const detailLink = savedResourceDetailLink(page);
    await expect(detailLink).toBeVisible({ timeout: FAVORITES_UI_TIMEOUT_MS });
    await Promise.all([
        page.waitForURL(/\/resource\/(hard|soft)\/\d+$/, { timeout: 30_000, waitUntil: 'domcontentloaded' }),
        detailLink.click(),
    ]);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });
});
