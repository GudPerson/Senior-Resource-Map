import { SupportError } from './supportDomain.js';

const CLIENT_ORIGIN = 'https://app.carearound.sg';
const SHA256 = /^[a-f0-9]{64}$/;
const VERSION_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const ENTRY_PATH = /^\/assets\/[a-zA-Z0-9._-]+\.(?:js|css)$/;

export async function readBoundedReleaseBody(response, maximum) {
    if (!response.body || Number(response.headers.get('content-length') || 0) > maximum) {
        await response.body?.cancel();
        throw new Error('Release response exceeds its limit.');
    }
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    try {
        while (true) {
            const next = await reader.read();
            if (next.done) break;
            length += next.value.byteLength;
            if (length > maximum) { await reader.cancel(); throw new Error('Release response exceeds its limit.'); }
            chunks.push(next.value);
        }
    } finally { reader.releaseLock(); }
    const result = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
}

const digest = async (bytes) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');

function validRelease(release, target) {
    return release?.schemaVersion === 1 && release.application === 'carearound-sg'
        && release.target === target && release.sourceClean === true
        && /^[a-f0-9]{40}$/.test(release.sourceRevision || '');
}

async function fetchReleaseBytes(fetcher, path, contentType, maximum) {
    const response = await fetcher(`${CLIENT_ORIGIN}${path}`, {
        headers: { 'Cache-Control': 'no-cache', Accept: contentType, 'Accept-Encoding': 'identity' },
        redirect: 'error', signal: AbortSignal.timeout(10000),
        cf: { cacheTtl: 0, cacheEverything: false },
    });
    const receivedType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    const accepted = contentType === 'application/javascript' ? ['application/javascript', 'text/javascript'] : [contentType];
    if (!response.ok || !accepted.includes(receivedType)) { await response.body?.cancel(); throw new Error('Unavailable'); }
    return readBoundedReleaseBody(response, maximum);
}

async function verifyClient(fetcher) {
    const release = JSON.parse(new TextDecoder().decode(await fetchReleaseBytes(fetcher, '/release.json', 'application/json', 4096)));
    if (!validRelease(release, 'client') || release.provenance !== 'git-build' || !SHA256.test(release.htmlSha256 || '')
        || !Array.isArray(release.entryAssets) || !release.entryAssets.length || release.entryAssets.length > 4) throw new Error('Invalid client release');
    const paths = new Set();
    for (const asset of release.entryAssets) {
        if ((!ENTRY_PATH.test(asset.path || '') && asset.path !== '/app-shell-recovery-20260721-1.js')
            || paths.has(asset.path) || !SHA256.test(asset.sha256 || '') || !Number.isSafeInteger(asset.bytes)
            || asset.bytes < 1 || asset.bytes > 2 * 1024 * 1024) throw new Error('Invalid entry file');
        paths.add(asset.path);
    }
    if (![...paths].some((path) => /^\/assets\/.+\.js$/.test(path))) throw new Error('No app entry file');
    const html = await fetchReleaseBytes(fetcher, '/', 'text/html', 32768);
    if (await digest(html) !== release.htmlSha256) throw new Error('Client shell does not match its release');
    const text = new TextDecoder().decode(html);
    await Promise.all(release.entryAssets.map(async (asset) => {
        if (!text.includes(`src="${asset.path}"`) && !text.includes(`href="${asset.path}"`)) throw new Error('Entry is not in the served shell');
        const bytes = await fetchReleaseBytes(fetcher, asset.path, asset.path.endsWith('.css') ? 'text/css' : 'application/javascript', 2 * 1024 * 1024);
        if (bytes.length !== asset.bytes || await digest(bytes) !== asset.sha256) throw new Error('Entry integrity mismatch');
    }));
    return { sourceRevision: release.sourceRevision, deploymentId: null, healthy: true,
        verificationMethod: 'client-entry-integrity', artifactSha256: release.htmlSha256, checkedAt: new Date().toISOString() };
}

function verifyServer(runtime) {
    // The authenticated request is already running in the API Worker and has
    // read its report/approval from the database. Observe its platform binding;
    // do not fetch the same Worker through its public route or trust client JSON.
    const url = new URL(runtime?.requestUrl || 'about:blank');
    const release = runtime?.release;
    if (url.origin !== 'https://api.carearound.sg' || !validRelease(release, 'server')
        || release.provenance !== 'git-build+worker-version' || !VERSION_ID.test(release.deploymentId || '')
        || !Number.isFinite(Date.parse(release.uploadedAt || ''))) throw new Error('No production runtime evidence');
    return { sourceRevision: release.sourceRevision, deploymentId: release.deploymentId, healthy: true,
        verificationMethod: 'worker-runtime-version', artifactSha256: null, checkedAt: new Date().toISOString() };
}

export async function verifySupportProductionRelease(target, fetcher = fetch, runtime = null) {
    const targets = target === 'both' ? ['client', 'server'] : [target];
    if (targets.some((item) => !['client', 'server'].includes(item))) throw new SupportError('Invalid release target.');
    try {
        return Object.fromEntries(await Promise.all(targets.map(async (item) => [item,
            item === 'client' ? await verifyClient(fetcher) : verifyServer(runtime)])));
    } catch { throw new SupportError('Production release evidence is unavailable. No fix update was sent.', 503); }
}
