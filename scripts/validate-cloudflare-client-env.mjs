const rawApiUrl = String(process.env.VITE_API_URL || '').trim();
const preferredApiUrl = 'https://api.carearound.sg/api';

function fail(message) {
    console.error(message);
    process.exit(1);
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
