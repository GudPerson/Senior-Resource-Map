const PRODUCTION_ORIGIN = 'https://app.carearound.sg';
const PROOF_UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

// Only publisher probes on these two documents suppress edge body transforms.
// The asset response stream and all other headers remain untouched.
export async function helpReleaseProofResponse(context, path) {
    const response = await context.next();
    const request = context.request;
    const url = new URL(request.url);
    const markers = url.searchParams.getAll('help_release_check');
    const mime = String(response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!['/', '/offline'].includes(path) || url.pathname !== path
        || url.origin !== PRODUCTION_ORIGIN || !['GET', 'HEAD'].includes(request.method)
        || markers.length !== 1 || markers[0].length !== 36 || !PROOF_UUID.test(markers[0])
        || response.status !== 200 || response.redirected || mime !== 'text/html') {
        return response;
    }
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'private, no-store, no-transform');
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}
