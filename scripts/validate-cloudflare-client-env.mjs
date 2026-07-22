const rawApiUrl = String(process.env.VITE_API_URL || '').trim();
const preferredApiUrl = 'https://api.carearound.sg/api';
const preferredTownMapUrl = 'https://maps.carearound.sg/v2/native-scale-20260722/default';
const preferredTownMapGrayUrl = 'https://maps.carearound.sg/v2/native-scale-20260722/gray';
const rollbackTownMapUrls = Object.freeze([
    'https://maps.carearound.sg/v1/islandwide',
    'https://maps.carearound.sg/v1/w01',
]);
const rollbackTownMapGrayUrls = Object.freeze([
    'https://maps.carearound.sg/v1/islandwide/gray',
    'https://maps.carearound.sg/v1/w01/gray',
]);
const allowTownMapRollback = String(process.env.VITE_ALLOW_TOWN_MAP_ROLLBACK || '').trim() === 'true';

function fail(message) {
    console.error(message);
    process.exit(1);
}

function normalizeUrl(value, label) {
    const rawValue = String(value || '').trim();
    if (!rawValue) {
        fail(`Missing ${label}. Production Pages deploys must keep the owner Detailed map enabled.`);
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(rawValue);
    } catch {
        fail(`${label} must be an absolute URL.`);
    }

    if (parsedUrl.protocol !== 'https:') {
        fail(`${label} must use https.`);
    }

    parsedUrl.hash = '';
    parsedUrl.search = '';
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '');
    return parsedUrl.toString().replace(/\/+$/, '');
}

if (!rawApiUrl) {
    fail(
        `Missing VITE_API_URL. Cloudflare Pages deploys should point at the same-site Worker API: ${preferredApiUrl}`
    );
}

let parsed;
try {
    parsed = new URL(rawApiUrl);
} catch {
    fail('VITE_API_URL must be an absolute URL, not a relative path like /api.');
}

if (!['http:', 'https:'].includes(parsed.protocol)) {
    fail('VITE_API_URL must use http or https.');
}

const normalizedPath = parsed.pathname.replace(/\/+$/, '');
if (!normalizedPath.endsWith('/api')) {
    fail('VITE_API_URL must include the /api base path exposed by the Worker.');
}

if (parsed.hostname.endsWith('.workers.dev')) {
    console.warn(
        `VITE_API_URL still points at workers.dev. Production app traffic will prefer ${preferredApiUrl}, but update the Pages environment when the custom domain is live.`
    );
}

if (String(process.env.VITE_TOWN_MAP_PROOF_ENABLED || '').trim() !== 'true') {
    fail('Missing VITE_TOWN_MAP_PROOF_ENABLED=true. Omitting it compiles the owner Detailed map out of the production bundle.');
}

const townMapUrl = normalizeUrl(process.env.VITE_TOWN_MAP_ASSET_BASE_URL, 'VITE_TOWN_MAP_ASSET_BASE_URL');
const townMapGrayUrl = normalizeUrl(process.env.VITE_TOWN_MAP_GRAY_ASSET_BASE_URL, 'VITE_TOWN_MAP_GRAY_ASSET_BASE_URL');
const allowedTownMapUrls = allowTownMapRollback
    ? [preferredTownMapUrl, ...rollbackTownMapUrls]
    : [preferredTownMapUrl];
const allowedTownMapGrayUrls = allowTownMapRollback
    ? [preferredTownMapGrayUrl, ...rollbackTownMapGrayUrls]
    : [preferredTownMapGrayUrl];

if (!allowedTownMapUrls.includes(townMapUrl) || !allowedTownMapGrayUrls.includes(townMapGrayUrl)) {
    fail(
        `Production Pages deploys must use the islandwide Detailed map assets (${preferredTownMapUrl} and ${preferredTownMapGrayUrl}). ` +
        'Set VITE_ALLOW_TOWN_MAP_ROLLBACK=true only for a deliberate rollback to a retained v1 root.'
    );
}
