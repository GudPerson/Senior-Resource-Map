import { useEffect, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle } from 'lucide-react';

import { useLocale } from '../contexts/LocaleContext.jsx';
import { uploadAnnotationImage } from '../lib/annotationMedia.js';
import { getAnnotationMessages, getAnnotationUploadError } from '../lib/annotationMessages.js';

export default function AnnotationImageUpload({ mapId, onUploaded, disabled = false }) {
    const { locale } = useLocale();
    const messages = getAnnotationMessages(locale);
    const inputRef = useRef(null);
    const controllerRef = useRef(null);
    const activeContextRef = useRef(mapId);
    const onUploadedRef = useRef(onUploaded);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    onUploadedRef.current = onUploaded;

    useEffect(() => {
        activeContextRef.current = mapId;
        setUploading(false);
        setError('');
        return () => {
            activeContextRef.current = null;
            controllerRef.current?.abort();
        };
    }, [mapId]);

    async function handleFile(event) {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file || disabled || uploading || !mapId) return;
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        const requestMapId = mapId;
        setUploading(true);
        setError('');
        try {
            const image = await uploadAnnotationImage({
                mapId: requestMapId,
                file,
                signal: controller.signal,
            });
            if (!controller.signal.aborted && activeContextRef.current === requestMapId) {
                onUploadedRef.current?.(image);
            }
        } catch (uploadError) {
            if (!controller.signal.aborted && activeContextRef.current === requestMapId) {
                setError(getAnnotationUploadError(uploadError, locale));
            }
        } finally {
            if (!controller.signal.aborted && activeContextRef.current === requestMapId) {
                setUploading(false);
            }
        }
    }

    return (
        <div className="mt-3 space-y-2" data-annotation-image-upload="true">
            <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                aria-label={messages.addImage}
                onChange={handleFile}
                disabled={disabled || uploading || !mapId}
            />
            <button
                type="button"
                disabled={disabled || uploading || !mapId}
                onClick={() => inputRef.current?.click()}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-800 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {uploading ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}
                {uploading ? messages.uploadingImage : messages.addImage}
            </button>
            <p className="text-xs leading-4 text-slate-600">{messages.imageLimits}</p>
            {uploading ? <p role="status" className="sr-only">{messages.uploadingImage}</p> : null}
            {error ? <p role="alert" className="text-xs font-semibold text-red-700">{error}</p> : null}
        </div>
    );
}
