import { expect, test } from 'playwright/test';

const DEFAULT_POSTAL_CODE = '680153';
const DEFAULT_POSTAL_KEYWORD = 'active ageing';
const CAREAROUND_API_BASE = 'https://api.carearound.sg/api';
const CLOUDFLARE_FALLBACK_API_BASE = 'https://senior-resource-map-api.joshuachua79.workers.dev/api';

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

async function loginAsPartner(page) {
    const { username, password } = ensureSmokeCredentials();

    await page.goto('/partner-login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#auth-login-id')).toBeVisible();
    await page.locator('#auth-login-id').fill(username);
    await page.locator('#auth-password').fill(password);
    await page.locator('#auth-submit').click();
    await page.waitForURL(/\/dashboard(?:$|\/)/, { timeout: 30_000 });
}

function savedResourceDetailLink(page) {
    return page.getByRole('link', { name: /View (details|place)/i }).first();
}

async function toggleFirstDiscoverSaveButton(page) {
    const saveButton = page.getByRole('button', { name: 'Save to My Directory' }).first();
    await expect(saveButton).toBeVisible({ timeout: 30_000 });
    const toggleResponsePromise = page.waitForResponse((response) => (
        response.url().includes('/favorites/toggle') && response.request().method() === 'POST'
    ), { timeout: 30_000 });
    await saveButton.click();
    const toggleResponse = await toggleResponsePromise;
    expect(toggleResponse.ok(), 'saved asset toggle request should complete before navigation').toBeTruthy();
    return toggleResponse.json().catch(() => null);
}

async function ensureSavedAsset(page) {
    await page.goto('/my-directory', { waitUntil: 'domcontentloaded' });
    const existingDetailLink = savedResourceDetailLink(page);

    if (await existingDetailLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
        return;
    }

    await page.goto('/discover', { waitUntil: 'domcontentloaded' });
    const firstToggle = await toggleFirstDiscoverSaveButton(page);
    if (firstToggle?.saved !== true) {
        await toggleFirstDiscoverSaveButton(page);
    }

    await page.goto('/my-directory', { waitUntil: 'domcontentloaded' });
    await expect(savedResourceDetailLink(page)).toBeVisible({ timeout: 15_000 });
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
    await loginAsPartner(page);
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

    const candidateAddButton = page.locator('[data-testid^="postal-candidate-add-"]').first();
    if (await candidateAddButton.count()) {
        await candidateAddButton.click();
        await page.locator('[data-testid^="postal-draft-review-"]').first().click();
    } else {
        await page.getByTestId('postal-address-draft-add').click();
        await page.getByTestId('postal-address-draft-review').click();
    }

    await expect(page.getByText('Draft review')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Resolved postal anchor')).toBeVisible({ timeout: 15_000 });
});

test('create-map flow can select saved assets and submit the modal path', async ({ page }, testInfo) => {
    await loginAsPartner(page);
    await ensureSavedAsset(page);

    await page.goto('/my-directory?section=my-maps', { waitUntil: 'domcontentloaded' });
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
    await savedResourceDetailLink(page).click();
    await page.waitForURL(/\/resource\/(hard|soft)\/\d+$/, { timeout: 30_000 });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
});
