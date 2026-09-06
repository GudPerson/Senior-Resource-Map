import { buildClientReleaseManifest } from '../../../scripts/client-release-plugin.mjs';
import { makeWorkerReleaseManifest } from '../../src/utils/workerRelease.js';

export const releaseRevision = 'a'.repeat(40);
export const releaseVersion = '01234567-89ab-4cde-8123-456789abcdef';
export const releaseMetadata = {
    id: releaseVersion, tag: `git-${releaseRevision}`, timestamp: '2026-09-07T01:00:00.000Z',
};

// Synthetic public build files, never production data or a live deployment.
export async function createReleaseFixture() {
    const files = new Map([
        ['/', { type: 'text/html', body: Buffer.from('<html><head><link rel="stylesheet" href="/assets/app-123.css"></head><body><script type="module" src="/assets/app-123.js"></script><script src="/app-shell-recovery-20260721-1.js"></script></body></html>') }],
        ['/assets/app-123.js', { type: 'application/javascript', body: Buffer.from('export const app = "synthetic fixture";') }],
        ['/assets/app-123.css', { type: 'text/css', body: Buffer.from('body { color: teal; }') }],
        ['/app-shell-recovery-20260721-1.js', { type: 'text/javascript', body: Buffer.from('void "synthetic recovery";') }],
    ]);
    const manifest = await buildClientReleaseManifest({
        html: files.get('/').body,
        source: { sourceRevision: releaseRevision, sourceClean: true },
        readAsset: async (path) => files.get(path).body,
    });
    const requests = [];
    return {
        files, manifest, requests,
        runtime: { requestUrl: 'https://api.carearound.sg/api/support/review/reports/fixture/verify',
            release: makeWorkerReleaseManifest(releaseRevision, releaseMetadata) },
        async fetcher(url, options) {
            requests.push({ url, options });
            const parsed = new URL(url);
            if (parsed.origin !== 'https://app.carearound.sg') throw new Error('Unexpected test origin');
            if (parsed.pathname === '/release.json') return Response.json(manifest);
            const file = files.get(parsed.pathname);
            return file ? new Response(file.body, { headers: { 'Content-Type': file.type } }) : new Response('missing', { status: 404 });
        },
    };
}
