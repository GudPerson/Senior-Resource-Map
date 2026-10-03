const PRODUCTION_ORIGIN = 'https://app.carearound.sg';
const PROOF_UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const DOCUMENTS = Object.freeze({ home: '/', offline: '/offline' });

function unavailable(status = 404) {
    return new Response('Help release proof unavailable.', { status, headers: {
        'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'private, no-store',
        ...(status === 405 ? { Allow: 'GET, HEAD' } : {}),
    } });
}

// Read only the two public HTML assets from this Pages deployment. Ordinary
// page visits never invoke this route, and no request credentials are forwarded.
export async function helpReleaseAssetProof(context, document) {
    const request = context.request, url = new URL(request.url);
    const markers = url.searchParams.getAll('help_release_check');
    if (!Object.hasOwn(DOCUMENTS, document) || url.origin !== PRODUCTION_ORIGIN
        || url.pathname !== '/__help-release-proof/' + document
        || markers.length !== 1 || markers[0].length !== 36 || !PROOF_UUID.test(markers[0])) return unavailable();
    if (!['GET', 'HEAD'].includes(request.method)) return unavailable(405);
    let asset;
    try {
        asset = await context.env.ASSETS.fetch(new Request(new URL(DOCUMENTS[document], PRODUCTION_ORIGIN), {
            method: request.method, redirect: 'manual', headers: { Accept: 'text/html', 'Cache-Control': 'no-cache' },
        }));
    } catch { return unavailable(503); }
    const mime = String(asset.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (asset.status !== 200 || asset.redirected || mime !== 'text/html') return unavailable(502);
    const headers = new Headers(asset.headers);
    headers.set('Cache-Control', 'private, no-store, no-transform');
    return new Response(request.method === 'HEAD' ? null : asset.body, {
        status: asset.status, statusText: asset.statusText, headers,
    });
}
