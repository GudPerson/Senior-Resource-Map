import React, { useEffect, useMemo, useState } from 'react';
import { FileText, FileWarning, Image as ImageIcon, Loader2 } from 'lucide-react';

import { api } from '../lib/api.js';

function formatFileSize(bytes) {
    const size = Number(bytes || 0);
    if (!Number.isFinite(size) || size <= 0) return '';
    if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getPreviewKind(mimeType = '') {
    const normalized = String(mimeType || '').toLowerCase();
    if (normalized === 'application/pdf') return 'pdf';
    if (normalized.startsWith('image/')) return 'image';
    return 'unsupported';
}

function getKindLabel(kind, mimeType) {
    if (kind === 'pdf') return 'PDF';
    if (kind === 'image') {
        const subtype = String(mimeType || '').split('/')[1]?.toUpperCase();
        return subtype || 'Image';
    }
    return 'File';
}

export default function PrivateFileViewer({
    resourceType,
    resourceId,
    file,
    actions = null,
    compact = false,
}) {
    const [objectUrl, setObjectUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [imageFailed, setImageFailed] = useState(false);

    const previewKind = useMemo(() => getPreviewKind(file?.mimeType), [file?.mimeType]);
    const canPreview = previewKind === 'image' || previewKind === 'pdf';
    const kindLabel = getKindLabel(previewKind, file?.mimeType);

    useEffect(() => {
        let cancelled = false;
        let url = '';

        async function loadPreview() {
            if (!resourceType || !resourceId || !file?.id || !canPreview) return;

            setLoading(true);
            setError('');
            setImageFailed(false);
            try {
                const result = await api.downloadPrivateResourceFile(resourceType, resourceId, file.id);
                if (cancelled) return;
                url = URL.createObjectURL(result.blob);
                setObjectUrl(url);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Preview could not be loaded.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadPreview();

        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [resourceType, resourceId, file?.id, canPreview]);

    const icon = previewKind === 'image'
        ? <ImageIcon size={18} className="shrink-0 text-amber-700" />
        : <FileText size={18} className="shrink-0 text-amber-700" />;

    return (
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                    {icon}
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{file?.fileName || 'Partner-only file'}</p>
                        <p className="text-xs text-slate-500">
                            {kindLabel}
                            {file?.fileSize ? ` · ${formatFileSize(file.fileSize)}` : ''}
                            {file?.uploadedByName ? ` · Uploaded by ${file.uploadedByName}` : ''}
                        </p>
                    </div>
                </div>
                {actions}
            </div>

            {canPreview ? (
                <div className="border-t border-slate-100 bg-slate-50">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
                            <Loader2 size={17} className="animate-spin" />
                            Loading protected preview...
                        </div>
                    ) : error || imageFailed ? (
                        <div className="flex min-h-32 items-center gap-3 px-4 py-5 text-sm text-amber-800">
                            <FileWarning size={18} className="shrink-0" />
                            <span>{error || 'This image format cannot be previewed in this browser.'}</span>
                        </div>
                    ) : previewKind === 'image' && objectUrl ? (
                        <img
                            src={objectUrl}
                            alt={file?.fileName || 'Partner-only reference'}
                            onError={() => setImageFailed(true)}
                            className={`${compact ? 'max-h-64' : 'max-h-[34rem]'} w-full bg-white object-contain`}
                        />
                    ) : previewKind === 'pdf' && objectUrl ? (
                        <iframe
                            src={`${objectUrl}#toolbar=0&navpanes=0`}
                            title={file?.fileName || 'Partner-only PDF preview'}
                            className={`${compact ? 'h-72' : 'h-[34rem]'} w-full bg-white`}
                        />
                    ) : null}
                </div>
            ) : (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    Preview is not available for this file type.
                </div>
            )}
        </article>
    );
}
