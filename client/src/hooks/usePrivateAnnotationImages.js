import { useEffect, useMemo, useState } from 'react';
import { loadAnnotationImage, getAnnotationImageRequestDescriptors, getPrivateAnnotationImageReadiness } from '../lib/annotationMedia.js';

export default function usePrivateAnnotationImages({ mapId, annotations = [], enabled = false, ownerKey = '' } = {}) {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState({ key: '', sources: {}, error: '' });
    const images = getAnnotationImageRequestDescriptors(annotations);
    const key = JSON.stringify([enabled, mapId, ownerKey, attempt, images]);
    useEffect(() => {
        const controller = new AbortController();
        let stale = false;
        const sources = {};
        const urls = new Set();
        const update = () => { if (!stale) setState({ key, sources: { ...sources }, error: Object.values(sources).find(item => item.status === 'error')?.error || '' }); };
        if (!enabled || !mapId) { setState({ key, sources: {}, error: '' }); return undefined; }
        images.forEach(image => { sources[image.assetId] = { status: 'loading' }; }); update();
        images.forEach(async image => {
            try {
                const source = await loadAnnotationImage({ mapId, image, signal: controller.signal });
                if (stale) { URL.revokeObjectURL(source.url); return; }
                urls.add(source.url); sources[image.assetId] = source; update();
            } catch (error) {
                if (stale || error?.name === 'AbortError') return;
                sources[image.assetId] = { status: 'error', error: error.message }; update();
            }
        });
        return () => { stale = true; controller.abort(); urls.forEach(url => URL.revokeObjectURL(url)); };
        // The stable key contains all request identity/metadata. Old sources are hidden synchronously.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    const sources = state.key === key && enabled ? state.sources : {};
    const readiness = getPrivateAnnotationImageReadiness(enabled ? annotations : [], sources);
    const retry = useMemo(() => () => setAttempt(value => value + 1), []);
    const statuses = Object.fromEntries(Object.entries(sources).map(([assetId, source]) => [assetId, source.status]));
    return { sources, statuses, status: readiness.status, error: state.key === key ? state.error : '', retry };
}
