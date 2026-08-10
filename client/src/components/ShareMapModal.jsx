import { useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Copy, ExternalLink, Globe2, Link2, LockKeyhole, Plus, Trash2, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { hasSharedMapUpdates } from '../lib/shareMapStatus.js';

function buildShareUrl(sharePath) {
    if (!sharePath) return '';
    if (typeof window === 'undefined') return sharePath;
    return new URL(sharePath, window.location.origin).toString();
}

function normalizeWebsiteOrigin(value) {
    const raw = String(value || '').trim();
    const url = new URL(raw);
    const isLocalHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
        raw.includes('*')
        || (url.protocol !== 'https:' && !isLocalHttp)
        || url.username
        || url.password
        || (url.pathname && url.pathname !== '/')
        || url.search
        || url.hash
        || !url.hostname
        || url.hostname.startsWith('.')
        || url.hostname.endsWith('.')
    ) {
        throw new Error('invalid-origin');
    }
    return url.origin;
}

function buildEmbedUrl(embedPath) {
    if (!embedPath) return '';
    if (typeof window === 'undefined') return embedPath;
    return new URL(embedPath, window.location.origin).toString();
}

function escapeHtmlAttribute(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function buildEmbedCode(embedUrl, mapName) {
    if (!embedUrl) return '';
    return `<iframe src="${escapeHtmlAttribute(embedUrl)}" title="${escapeHtmlAttribute(`${mapName || 'CareAround SG'} interactive resource map`)}" width="100%" height="520" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="border:0;border-radius:16px;min-width:400px"></iframe>`;
}

function buildEmbedPreviewUrl(embedUrl, revision) {
    if (!embedUrl || !revision) return embedUrl;
    const separator = embedUrl.includes('?') ? '&' : '?';
    return `${embedUrl}${separator}snapshot=${encodeURIComponent(revision)}`;
}

export default function ShareMapModal({
    isOpen,
    map,
    submitting = false,
    error = '',
    onClose,
    onPublish,
    onUnpublish,
    onUpdateEmbed,
    annotations = [],
    annotationsReady = true,
}) {
    const { t } = useLocale();
    const [copyFeedback, setCopyFeedback] = useState('');
    const [embedCopyFeedback, setEmbedCopyFeedback] = useState('');
    const [embedFeedback, setEmbedFeedback] = useState('');
    const [originDraft, setOriginDraft] = useState('');
    const [originError, setOriginError] = useState('');
    const [embedEnabled, setEmbedEnabled] = useState(false);
    const [embedOrigins, setEmbedOrigins] = useState([]);
    const [embedPreviewRevision, setEmbedPreviewRevision] = useState(0);
    const [includeAnnotationsSelection, setIncludeAnnotationsSelection] = useState(null);
    const includeAnnotationsRef = useRef(null);
    const shareUrl = useMemo(() => buildShareUrl(map?.share?.sharePath || map?.sharePath), [map?.share?.sharePath, map?.sharePath]);
    const embedUrl = useMemo(() => buildEmbedUrl(map?.share?.embedPath || map?.embedPath), [map?.share?.embedPath, map?.embedPath]);
    const embedPreviewUrl = useMemo(
        () => buildEmbedPreviewUrl(embedUrl, embedPreviewRevision),
        [embedPreviewRevision, embedUrl],
    );
    const embedCode = useMemo(() => buildEmbedCode(embedUrl, map?.name), [embedUrl, map?.name]);
    const persistedEmbedEnabled = Boolean(map?.share?.embedEnabled ?? map?.embedEnabled);
    const persistedEmbedOrigins = map?.share?.embedAllowedOrigins || map?.embedAllowedOrigins || [];

    useEffect(() => {
        if (!isOpen) return;
        setEmbedEnabled(persistedEmbedEnabled);
        setEmbedOrigins(Array.isArray(persistedEmbedOrigins) ? persistedEmbedOrigins : []);
        setOriginDraft('');
        setOriginError('');
        setEmbedFeedback('');
        setEmbedCopyFeedback('');
        setEmbedPreviewRevision(0);
        setIncludeAnnotationsSelection(null);
    }, [isOpen, map?.id, persistedEmbedEnabled, JSON.stringify(persistedEmbedOrigins)]);

    const isShared = Boolean(map?.share?.isShared ?? map?.isShared);
    const annotationCount = Array.isArray(annotations) ? annotations.length : 0;
    const persistedSharedAnnotationCount = Array.isArray(annotations)
        ? annotations.filter((annotation) => Boolean(annotation?.isShared)).length
        : 0;
    const sharedAnnotationCount = includeAnnotationsSelection === true
        ? annotationCount
        : includeAnnotationsSelection === false
            ? 0
            : persistedSharedAnnotationCount;
    const includesAllAnnotations = annotationCount > 0 && sharedAnnotationCount === annotationCount;
    const includesSomeAnnotations = sharedAnnotationCount > 0 && !includesAllAnnotations;
    const hasPendingShareUpdates = hasSharedMapUpdates(map) || includeAnnotationsSelection !== null;
    const sharedStatusTitle = hasPendingShareUpdates ? t('shareLinkNeedsUpdateTitle') : t('sharedLinkIsLive');
    const sharedStatusDescription = hasPendingShareUpdates ? t('shareLinkNeedsUpdateDescription') : t('sharedLinkDescription');

    useEffect(() => {
        if (!includeAnnotationsRef.current) return;
        includeAnnotationsRef.current.indeterminate = includesSomeAnnotations;
    }, [includesSomeAnnotations]);

    if (!isOpen || !map) return null;

    async function handleCopyLink() {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopyFeedback(t('shareLinkCopied'));
            window.setTimeout(() => setCopyFeedback(''), 1800);
        } catch (err) {
            console.error(err);
            setCopyFeedback(t('copyFailed'));
        }
    }

    async function handlePublishClick() {
        const published = await onPublish?.({ includeAnnotations: includeAnnotationsSelection });
        if (!published) return;
        setIncludeAnnotationsSelection(null);
        setEmbedPreviewRevision((current) => current + 1);
    }

    function handleIncludeAnnotationsChange(event) {
        setIncludeAnnotationsSelection(event.target.checked);
    }

    function handleAddOrigin() {
        try {
            const normalized = normalizeWebsiteOrigin(originDraft);
            setEmbedOrigins((current) => (
                current.includes(normalized) ? current : [...current, normalized].slice(0, 10)
            ));
            setOriginDraft('');
            setOriginError('');
            setEmbedFeedback('');
        } catch {
            setOriginError(t('embedInvalidOrigin'));
        }
    }

    async function handleSaveEmbedSettings() {
        if (embedEnabled && embedOrigins.length === 0) {
            setOriginError(t('embedRequiresOrigin'));
            return;
        }
        setOriginError('');
        setEmbedFeedback('');
        const saved = await onUpdateEmbed?.({
            enabled: embedEnabled,
            allowedOrigins: embedOrigins,
        });
        if (saved !== false) setEmbedFeedback(t('embedSettingsSaved'));
    }

    async function handleCopyEmbedCode() {
        if (!persistedEmbedEnabled || !embedCode) return;
        try {
            await navigator.clipboard.writeText(embedCode);
            setEmbedCopyFeedback(t('embedCodeCopied'));
            window.setTimeout(() => setEmbedCopyFeedback(''), 1800);
        } catch (err) {
            console.error(err);
            setEmbedCopyFeedback(t('copyFailed'));
        }
    }

    return (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{t('shareDirectory')}</p>
                        <h2 className="mt-2 text-2xl font-bold text-slate-900">
                            {isShared ? t('shareLinkLiveTitle') : t('sharePrivateTitle')}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label={t('close')}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-5 px-5 py-5 sm:px-6">
                    <div className={`rounded-[24px] border p-5 ${
                        hasPendingShareUpdates
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-slate-200 bg-slate-50'
                    }`}>
                        <div className="flex items-center gap-3">
                            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
                                hasPendingShareUpdates
                                    ? 'bg-white text-amber-600 shadow-sm'
                                    : isShared ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                                {isShared ? <Globe2 size={20} /> : <LockKeyhole size={20} />}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">
                                    {isShared ? sharedStatusTitle : t('privateMap')}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                    {isShared
                                        ? sharedStatusDescription
                                        : t('privateMapDescription')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {isShared ? (
                        <div>
                            <label htmlFor="share-map-link" className="block text-sm font-semibold text-slate-700">
                                {t('shareLink')}
                            </label>
                            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                                <div className="relative flex-1">
                                    <Link2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        id="share-map-link"
                                        readOnly
                                        value={shareUrl}
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCopyLink}
                                    className={`${hasPendingShareUpdates ? 'btn-ghost border border-slate-200' : 'btn-primary'} justify-center`}
                                >
                                    <Copy size={16} />
                                    {hasPendingShareUpdates ? t('copyExistingLink') : t('copyLink')}
                                </button>
                            </div>
                            {copyFeedback ? (
                                <p className="mt-2 text-sm font-medium text-brand-700">{copyFeedback}</p>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="rounded-[22px] border border-brand-100 bg-brand-50/60 p-4">
                        <p className="text-sm font-bold text-brand-900">{t('sharedMapSnapshotTitle')}</p>
                        <p className="mt-1 text-sm leading-6 text-brand-800">{t('sharedMapSnapshotDescription')}</p>
                    </div>

                    {isShared ? (
                        <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
                            <div className="flex items-start gap-3">
                                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                                    <Code2 size={20} />
                                </span>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base font-extrabold text-slate-950">{t('websiteEmbed')}</h3>
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${persistedEmbedEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {persistedEmbedEnabled ? t('websiteEmbedOn') : t('websiteEmbedOff')}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">{t('websiteEmbedDescription')}</p>
                                </div>
                            </div>

                            <div className="mt-5">
                                <label htmlFor="embed-approved-origin" className="block text-sm font-bold text-slate-800">
                                    {t('approvedWebsites')}
                                </label>
                                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                    <input
                                        id="embed-approved-origin"
                                        value={originDraft}
                                        onChange={(event) => {
                                            setOriginDraft(event.target.value);
                                            setOriginError('');
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key !== 'Enter') return;
                                            event.preventDefault();
                                            handleAddOrigin();
                                        }}
                                        placeholder={t('websiteOriginPlaceholder')}
                                        className="min-h-11 flex-1 rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddOrigin}
                                        disabled={!originDraft.trim() || embedOrigins.length >= 10}
                                        className="btn-ghost min-h-11 justify-center border border-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Plus size={16} /> {t('addWebsite')}
                                    </button>
                                </div>
                                {originError ? <p className="mt-2 text-sm font-medium text-red-600">{originError}</p> : null}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {embedOrigins.map((origin) => (
                                        <span key={origin} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs font-semibold text-slate-700">
                                            {origin}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEmbedOrigins((current) => current.filter((value) => value !== origin));
                                                    setEmbedFeedback('');
                                                }}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white"
                                                aria-label={`${t('remove')} ${origin}`}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <input
                                    type="checkbox"
                                    checked={embedEnabled}
                                    onChange={(event) => {
                                        setEmbedEnabled(event.target.checked);
                                        setEmbedFeedback('');
                                    }}
                                    className="mt-1 h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                                />
                                <span>
                                    <span className="block text-sm font-bold text-slate-900">{t('enableWebsiteEmbed')}</span>
                                    <span className="mt-1 block text-xs leading-5 text-slate-500">{t('embedEnableHelp')}</span>
                                </span>
                            </label>

                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleSaveEmbedSettings}
                                    disabled={submitting}
                                    className="btn-primary min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {submitting ? t('saving') : t('saveEmbedSettings')}
                                </button>
                                {embedFeedback ? <p className="text-sm font-semibold text-brand-700">{embedFeedback}</p> : null}
                            </div>

                            <div className="mt-5 border-t border-slate-100 pt-5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{t('embedCode')}</p>
                                        <p className="mt-1 text-xs text-slate-500">{t('embedRecommendedSize')}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleCopyEmbedCode}
                                        disabled={!persistedEmbedEnabled}
                                        className="btn-ghost min-h-11 justify-center border border-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Copy size={16} /> {t('copyEmbedCode')}
                                    </button>
                                </div>
                                {persistedEmbedEnabled ? (
                                    <>
                                        <textarea
                                            readOnly
                                            value={embedCode}
                                            rows={4}
                                            className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-700"
                                            aria-label={t('embedCode')}
                                        />
                                        {embedCopyFeedback ? <p className="mt-2 text-sm font-semibold text-brand-700">{embedCopyFeedback}</p> : null}
                                        <div className="mt-4 flex items-center justify-between gap-3">
                                            <p className="text-sm font-bold text-slate-900">{t('embedPreview')}</p>
                                            <a href={embedUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-700">
                                                {t('openFullMap')} <ExternalLink size={15} />
                                            </a>
                                        </div>
                                        <div className={`mt-2 rounded-2xl border px-4 py-3 ${
                                            hasPendingShareUpdates
                                                ? 'border-amber-200 bg-amber-50 text-amber-900'
                                                : 'border-brand-100 bg-brand-50/70 text-brand-900'
                                        }`}>
                                            <p className="text-sm font-bold">{t('embedPreviewSnapshotTitle')}</p>
                                            <p className="mt-1 text-xs leading-5">{t('embedPreviewSnapshotDescription')}</p>
                                        </div>
                                        <iframe
                                            key={embedPreviewUrl}
                                            src={embedPreviewUrl}
                                            title={`${map.name} ${t('embedPreview')}`}
                                            loading="lazy"
                                            className="mt-2 h-[440px] w-full rounded-2xl border border-slate-200 sm:h-[520px]"
                                        />
                                    </>
                                ) : (
                                    <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{t('embedNotEnabled')}</p>
                                )}
                            </div>
                        </section>
                    ) : null}

                    {isShared ? (
                        <label className={`flex min-h-11 items-start gap-3 rounded-[22px] border p-4 ${
                            annotationCount > 0 && annotationsReady
                                ? 'cursor-pointer border-brand-200 bg-brand-50/60'
                                : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
                        }`}>
                            <input
                                ref={includeAnnotationsRef}
                                type="checkbox"
                                checked={includesAllAnnotations}
                                onChange={handleIncludeAnnotationsChange}
                                disabled={!annotationCount || !annotationsReady || submitting}
                                className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                            />
                            <span>
                                <span className="block text-sm font-bold text-slate-900">{t('includeAnnotationsInShare')}</span>
                                <span className="mt-1 block text-xs leading-5 text-slate-600">
                                    {annotationCount > 0
                                        ? t('includeAnnotationsInShareHelp', {
                                            sharedCount: sharedAnnotationCount,
                                            count: annotationCount,
                                        })
                                        : t('noAnnotationsToShare')}
                                </span>
                            </span>
                        </label>
                    ) : null}

                    {error ? (
                        <p className="text-sm font-medium text-red-600">{error}</p>
                    ) : null}

                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="btn-ghost justify-center">
                            {t('close')}
                        </button>
                        {isShared ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handlePublishClick}
                                    disabled={submitting}
                                    className={`${hasPendingShareUpdates ? 'btn-primary' : 'btn-ghost border border-brand-200 text-brand-700 hover:bg-brand-50'} justify-center disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    {submitting ? t('saving') : t('updateSharedLink')}
                                </button>
                                <button
                                    type="button"
                                    onClick={onUnpublish}
                                    disabled={submitting}
                                    className="btn-ghost justify-center border border-red-200 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {submitting ? t('unpublishing') : t('unpublish')}
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={handlePublishClick}
                                disabled={submitting}
                                className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? t('publishing') : t('publishShareLink')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
