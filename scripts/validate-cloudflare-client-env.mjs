const rawApiUrl = String(process.env.VITE_API_URL || '').trim();

function fail(message) {
    console.error(message);
    process.exit(1);
}

if (!rawApiUrl) {
    fail(
        'Missing VITE_API_URL. Cloudflare Pages deploys must point at the deployed Worker API, for example: https://senior-resource-map-api.<subdomain>.workers.dev/api'
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

