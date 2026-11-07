import { normalizeContextLocation } from './discoveryLocationContext.js';

/**
 * Internal result: {status:'resolved',postalCode,location:{lat,lng}} OR
 * {status:'postal-unresolved',postalCode?,reason}. Never serialize location to a guest DTO.
 * Same OneMap exact-postal endpoint as singaporePostalFallback; no profile, DB writes, caching or logging.
 * Timeout covers fetch AND body parsing, capped at 5s. Caller cancellation rejects stale results.
 */
export async function resolveRegionalDiscoveryPostal(postalCode, {fetchImpl=fetch,signal,timeoutMs=5000} = {}) {
    const unresolved = reason => ({status:'postal-unresolved',...(typeof postalCode === 'string' && /^\d{6}$/.test(postalCode) ? {postalCode} : {}),reason});
    if (typeof postalCode !== 'string' || !/^\d{6}$/.test(postalCode)) return unresolved('invalid-format');
    if (signal?.aborted) return unresolved('aborted');
    const controller = new AbortController();
    const duration = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs,5000) : 5000;
    let timer, onAbort;
    const cancellation = new Promise(resolve=>{
        onAbort = () => { resolve(unresolved('aborted')); controller.abort(); };
        signal?.addEventListener('abort',onAbort,{once:true});
        timer = setTimeout(()=>{ resolve(unresolved('timeout')); controller.abort(); },duration);
    });
    const lookup = async () => {
        try {
            const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(postalCode)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
            const response = await fetchImpl(url,{signal:controller.signal});
            if (!response?.ok) return unresolved('lookup-failed');
            const payload = await response.json();
            const results = Array.isArray(payload?.results) ? payload.results : [];
            const candidate = results.find(row=>row?.POSTAL === postalCode);
            if (!candidate) return unresolved('not-found');
            const coordinates = [candidate.LATITUDE,candidate.LONGITUDE];
            if (!coordinates.every(value=>(typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)))) return unresolved('invalid-coordinates');
            const location = normalizeContextLocation({lat:Number(candidate.LATITUDE),lng:Number(candidate.LONGITUDE)});
            if (!location) return unresolved('invalid-coordinates');
            return {status:'resolved',postalCode,location};
        } catch {
            return unresolved('lookup-failed');
        }
    };
    try {
        const result = await Promise.race([cancellation,lookup()]);
        return signal?.aborted ? unresolved('aborted') : result;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort',onAbort);
    }
}
