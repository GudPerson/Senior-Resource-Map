import { useEffect, useRef, useState } from 'react';
import { Download, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { api } from '../lib/api.js';
import { uploadAnnotationImage } from '../lib/annotationMedia.js';
import { getAnnotationUploadError } from '../lib/annotationMessages.js';
import { getMapNoteImageMessages } from '../lib/mapNoteImageMessages.js';
import { getMapNoteImageRef, loadMapNoteImage, mapNoteImageFilename, normalizeMapNoteImages } from '../lib/mapNoteImages.js';

export default function MapNoteImages({ mapId, row, shareToken = '', readonly = false, onImagesChange }) {
    const { user } = useAuth(), { locale } = useLocale();
    const m = getMapNoteImageMessages(locale), ref = getMapNoteImageRef(row);
    const sharedImages = normalizeMapNoteImages(row?.notes?.images).filter(image => image.isShared);
    const [attempt, setAttempt] = useState(0);
    const [imagePage, setImagePage] = useState(0);
    const key = JSON.stringify([mapId, ref, readonly, shareToken, user?.id, attempt, readonly ? sharedImages : null]);
    const [state, setState] = useState({ key: '', revision: 0, images: [], status: 'loading' });
    const [sources, setSources] = useState({ key: '', values: {} });
    const [busy, setBusy] = useState(''), [error, setError] = useState('');
    const inputRef = useRef(null), uploadRef = useRef(null), activeKey = useRef(key);
    activeKey.current = key;
    const current = state.key === key ? state : { revision: 0, images: [], status: 'loading' };
    const currentPage = Math.min(imagePage, Math.max(0, Math.ceil(current.images.length / 4) - 1));
    const visibleImages = current.images.slice(currentPage * 4, (currentPage + 1) * 4);
    // Sharing changes do not reload decoded images. Four visible images bound
    // the gallery's decode memory on phones; changing pages releases old URLs.
    const imageKey = JSON.stringify([key, visibleImages.map(({ assetId, width, height, mimeType, size }) => ({ assetId, width, height, mimeType, size }))]);
    const currentSources = sources.key === imageKey ? sources.values : {};

    useEffect(() => {
        let stale = false;
        activeKey.current = key; setBusy(''); setError(''); setImagePage(0);
        if (ref && mapId && (!readonly || shareToken)) {
            if (readonly) setState({ key, revision: 0, images: sharedImages, status: 'ready' });
            else api.getMapNoteImages(mapId, ref.resourceType, ref.resourceId).then(value => {
                if (stale) return;
                const images = normalizeMapNoteImages(value?.images);
                if (!Number.isSafeInteger(value?.revision) || value.revision < 0 || !Array.isArray(value.images)
                    || images.length !== value.images.length) throw new Error('Invalid image response.');
                setState({ key, revision: value.revision, images, status: 'ready' });
            }).catch(() => { if (!stale) { setState({ key, revision: 0, images: [], status: 'error' }); setError(m.loadFailed); } });
        }
        return () => { stale = true; if (activeKey.current === key) activeKey.current = null; uploadRef.current?.abort(); };
        // Scope includes account/map/resource/token; typing cannot reset the gallery.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    useEffect(() => {
        const controller = new AbortController(); let stale = false;
        const urls = new Set(), values = {};
        if (current.status !== 'ready') return undefined;
        visibleImages.forEach(image => { values[image.assetId] = { status: 'loading' }; });
        setSources({ key: imageKey, values: { ...values } });
        visibleImages.forEach(async image => {
            try {
                const source = await loadMapNoteImage({ mapId, image, shareToken: readonly ? shareToken : '', signal: controller.signal });
                if (stale) { URL.revokeObjectURL(source.url); return; }
                urls.add(source.url); values[image.assetId] = source;
            } catch (loadError) {
                if (stale || loadError?.name === 'AbortError') return;
                values[image.assetId] = { status: 'error' };
            }
            if (!stale) setSources({ key: imageKey, values: { ...values } });
        });
        return () => { stale = true; controller.abort(); urls.forEach(url => URL.revokeObjectURL(url)); };
        // Metadata and complete request scope are included in imageKey.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageKey, current.status]);

    async function save(images, requestKey) {
        const saved = await api.updateMapNoteImages(mapId, ref.resourceType, ref.resourceId, {
            revision: current.revision, images: images.map(({ assetId, isShared }) => ({ assetId, isShared })),
        });
        const normalized = normalizeMapNoteImages(saved?.images);
        if (!Number.isSafeInteger(saved?.revision) || !Array.isArray(saved?.images) || normalized.length !== saved.images.length) throw new Error('Invalid image response.');
        if (activeKey.current === requestKey) {
            setState({ key: requestKey, revision: saved.revision, images: normalized, status: 'ready' });
            onImagesChange?.(row, normalized, { revision: saved.revision, updatedAt: saved.updatedAt });
        }
    }
    async function change(images) {
        if (busy || readonly || current.status !== 'ready') return;
        setBusy('saving'); setError(''); const requestKey = key;
        try { await save(images, requestKey); }
        catch (err) { if (activeKey.current === requestKey) setError(err?.code === 'map_note_images_conflict' ? m.conflict : m.saveFailed); }
        finally { if (activeKey.current === requestKey) setBusy(''); }
    }
    async function upload(event) {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
        if (!file || busy || readonly || current.status !== 'ready') return;
        const controller = new AbortController(), requestKey = key;
        uploadRef.current?.abort(); uploadRef.current = controller;
        setBusy('uploading'); setError(''); let attaching = false;
        try {
            const image = await uploadAnnotationImage({ mapId, file, signal: controller.signal });
            if (!controller.signal.aborted && activeKey.current === requestKey) {
                attaching = true;
                const next = current.images.some(item => item.assetId === image.assetId)
                    ? current.images : [...current.images, { ...image, isShared: false }];
                await save(next, requestKey);
            }
        } catch (err) {
            if (!controller.signal.aborted && activeKey.current === requestKey) setError(
                err?.code === 'map_note_images_conflict' ? m.conflict : attaching ? m.saveFailed : getAnnotationUploadError(err, locale));
        } finally { if (!controller.signal.aborted && activeKey.current === requestKey) setBusy(''); }
    }

    if (!ref || !mapId || (readonly && (!shareToken || sharedImages.length === 0))) return null;
    const personal = ref.resourceType === 'personal_place';
    return (
        <section className="mt-5 space-y-3 border-t border-slate-200 pt-4" aria-label={m.title} data-map-note-images="true">
            <h3 className="font-bold text-slate-900">{m.title}</h3>
            <p className="text-xs leading-5 text-slate-500">{readonly ? m.sharedHelp : personal ? m.personalHelp : m.sharingHelp}</p>
            {!readonly ? <>
                <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" aria-label={m.add}
                    disabled={busy || current.status !== 'ready' || current.images.length >= 20} onChange={upload} />
                <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-200 px-3 py-2 text-sm font-bold text-brand-800 disabled:opacity-50"
                    onClick={() => inputRef.current?.click()} disabled={busy || current.status !== 'ready' || current.images.length >= 20}>
                    {busy ? <LoaderCircle size={18} className="animate-spin" /> : <ImagePlus size={18} />}{busy ? m[busy] : m.add}
                </button><p className="text-xs leading-5 text-slate-500">{m.help}</p>
            </> : null}
            {current.status === 'loading' ? <p role="status" className="text-sm">{m.loading}</p> : null}
            {error ? <div role="alert" className="space-y-2 text-sm text-red-700"><p>{error}</p><button type="button" disabled={busy} className="min-h-11 underline" onClick={() => setAttempt(value => value + 1)}>{m.retry}</button></div> : null}
            <div className="grid gap-4 sm:grid-cols-2">
                {visibleImages.map((image, visibleIndex) => {
                    const index = currentPage * 4 + visibleIndex;
                    const source = currentSources[image.assetId];
                    return <div key={image.assetId} className="min-w-0 space-y-2" data-note-image-asset={image.assetId}>
                        {source?.status === 'ready' ? <img src={source.url} alt={`${m.photo} ${index + 1}`} decoding="async" className="max-h-60 max-w-full object-contain" />
                            : <p role="status" className="text-sm text-slate-500">{source?.status === 'error' ? m.loadFailed : m.loading}</p>}
                        {source?.status === 'error' ? <button type="button" className="min-h-11 underline" onClick={() => setAttempt(value => value + 1)}>{m.retry}</button> : null}
                        <div className="flex flex-wrap items-center gap-2">
                            {source?.status === 'ready' ? <a href={source.url} download={mapNoteImageFilename(row.name, index, image.mimeType)}
                                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"><Download size={16} />{m.download}</a> : null}
                            {!readonly ? <button type="button" disabled={busy} onClick={() => void change(current.images.filter(item => item.assetId !== image.assetId))}
                                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><Trash2 size={16} />{m.remove}</button> : null}
                        </div>
                        {!readonly && !personal ? <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                            <input type="checkbox" checked={image.isShared} disabled={busy} onChange={event => void change(current.images.map(item => item.assetId === image.assetId ? { ...item, isShared: event.target.checked } : item))} />{m.share}
                        </label> : null}
                        {!readonly ? <p className="text-xs text-slate-500">{image.isShared ? m.shared : m.private}</p> : null}
                    </div>;
                })}
            </div>
            {current.images.length > 4 ? <nav aria-label={m.title} className="flex items-center justify-between gap-2">
                <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" disabled={currentPage === 0}
                    onClick={() => setImagePage(currentPage - 1)}>{m.previous}</button>
                <span className="text-sm">{currentPage + 1} / {Math.ceil(current.images.length / 4)}</span>
                <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" disabled={(currentPage + 1) * 4 >= current.images.length}
                    onClick={() => setImagePage(currentPage + 1)}>{m.next}</button>
            </nav> : null}
        </section>
    );
}
