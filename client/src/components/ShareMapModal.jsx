import { useMemo, useState } from 'react';
import { Copy, Globe2, LockKeyhole, Link2, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';

function buildShareUrl(sharePath) {
    if (!sharePath) return '';
    if (typeof window === 'undefined') return sharePath;
    return new URL(sharePath, window.location.origin).toString();
}

export default function ShareMapModal({
    isOpen,
    map,
    submitting = false,
    error = '',
    onClose,
    onPublish,
    onUnpublish,
}) {
    const { t } = useLocale();
    const [copyFeedback, setCopyFeedback] = useState('');
    const shareUrl = useMemo(() => buildShareUrl(map?.share?.sharePath || map?.sharePath), [map?.share?.sharePath, map?.sharePath]);

    if (!isOpen || !map) return null;

    const isShared = Boolean(map?.share?.isShared ?? map?.isShared);

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

    return (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white shadow-2xl">
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
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                        <div className="flex items-center gap-3">
                            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${isShared ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
                                {isShared ? <Globe2 size={20} /> : <LockKeyhole size={20} />}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">
                                    {isShared ? t('sharedLinkIsLive') : t('privateMap')}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                    {isShared
                                        ? t('sharedLinkDescription')
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
                                <button type="button" onClick={handleCopyLink} className="btn-primary justify-center">
                                    <Copy size={16} />
                                    {t('copyLink')}
                                </button>
                            </div>
                            {copyFeedback ? (
                                <p className="mt-2 text-sm font-medium text-brand-700">{copyFeedback}</p>
                            ) : null}
                        </div>
                    ) : null}

                    {error ? (
                        <p className="text-sm font-medium text-red-600">{error}</p>
                    ) : null}

                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="btn-ghost justify-center">
                            {t('close')}
                        </button>
                        {isShared ? (
                            <button
                                type="button"
                                onClick={onUnpublish}
                                disabled={submitting}
                                className="btn-ghost justify-center border border-red-200 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? t('unpublishing') : t('unpublish')}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={onPublish}
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
