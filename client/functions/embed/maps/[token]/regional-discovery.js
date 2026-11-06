import {buildEmbedContentSecurityPolicy,normalizeFrameAncestorOrigins} from '../[token].js';

function unavailable(status=503) {
    return new Response('<!doctype html><html lang="en"><meta charset="UTF-8"><title>CareAround SG</title><main>This regional directory is unavailable.</main></html>',{status,headers:{
        'Content-Type':'text/html; charset=UTF-8',
        'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
        'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',
        'X-Robots-Tag':'noindex, nofollow','Strict-Transport-Security':'max-age=31536000; includeSubDomains; preload',
    }});
}

export async function buildRegionalDiscoveryResponse(context,fetchImpl=globalThis.fetch) {
    const token=String(context?.params?.token || '').trim();
    if (!token || token.length>128) return unavailable(404);
    const apiBase=String(context.env?.CAREAROUND_EMBED_API_BASE_URL || 'https://api.carearound.sg/api').replace(/\/+$/,'');
    let config;
    try {
        const response=await fetchImpl(`${apiBase}/shared-maps/${encodeURIComponent(token)}/embed/regional-discovery-config`,{
            credentials:'omit',redirect:'manual',cache:'no-store',headers:{Accept:'application/json'},
        });
        if (!response.ok) return unavailable(response.status===404 ? 404 : 503);
        config=await response.json();
    } catch { return unavailable(); }
    const origins=normalizeFrameAncestorOrigins(config?.allowedOrigins);
    if (config?.schemaVersion!==1 || config?.view!=='regional-discovery' || !origins.length || !origins.every(origin=>origin.startsWith('https://'))) return unavailable(404);
    let asset;
    try {asset=await context.env.ASSETS.fetch(new URL('/index.html',context.request.url));}
    catch {return unavailable();}
    if (!asset.ok) return unavailable();
    const headers=new Headers(asset.headers);
    headers.delete('X-Frame-Options');
    headers.set('Content-Type','text/html; charset=UTF-8');
    headers.set('Content-Security-Policy',buildEmbedContentSecurityPolicy(origins));
    headers.set('Cache-Control','no-store');
    headers.set('X-Content-Type-Options','nosniff');
    headers.set('Referrer-Policy','strict-origin-when-cross-origin');
    headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
    headers.set('X-Robots-Tag','noindex, nofollow');
    headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains; preload');
    return new Response(asset.body,{status:asset.status,headers});
}
export async function onRequest(context) {
    if (!['GET','HEAD'].includes(context.request.method)) {
        const response=unavailable(405);response.headers.set('Allow','GET, HEAD');return response;
    }
    const response=await buildRegionalDiscoveryResponse(context);
    return context.request.method==='HEAD' ? new Response(null,response) : response;
}
