import { defineConfig } from 'playwright/test';

const baseURL = String(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173').trim();

export default defineConfig({
    testDir: './tests/smoke',
    timeout: 90_000,
    expect: {
        timeout: 15_000,
    },
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list']],
    outputDir: 'output/playwright/test-results',
    use: {
        baseURL,
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
    },
});
