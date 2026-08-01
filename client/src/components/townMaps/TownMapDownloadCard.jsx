import { useEffect, useRef, useState } from 'react';
import { Download, FileImage, FileText, ImageOff, LoaderCircle } from 'lucide-react';

import { useLocale } from '../../contexts/LocaleContext.jsx';
import { getIntlLocale } from '../../lib/i18n.js';
import {
    formatDownloadBytes,
    resolveTownMapAssetUrl,
} from '../../lib/townMapDownloads.js';

function LazyTownMapThumbnail({ catalogueUrl, map }) {
    const { t } = useLocale();
    const containerRef = useRef(null);
    const [visible, setVisible] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const element = containerRef.current;
        if (!element || visible) return undefined;
        if (typeof IntersectionObserver !== 'function') {
            setVisible(true);
            return undefined;
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '160px 0px' });
        observer.observe(element);
        return () => observer.disconnect();
    }, [visible]);

    return (
        <div
            ref={containerRef}
            className="relative aspect-[10/7] overflow-hidden rounded-2xl bg-slate-100"
        >
            {visible && !failed ? (
                <img
                    src={resolveTownMapAssetUrl(map.thumbnail.url, catalogueUrl)}
                    alt={t('townMapsPreviewAlt', { name: map.name, code: map.code })}
                    width={map.thumbnail.width}
                    height={map.thumbnail.height}
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailed(true)}
                    className="h-full w-full object-cover"
                />
            ) : failed ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center text-slate-500">
                    <ImageOff size={26} aria-hidden="true" />
                    <p className="text-sm font-semibold">{t('townMapsPreviewUnavailable')}</p>
                </div>
            ) : (
                <div className="h-full w-full animate-pulse bg-slate-100" aria-hidden="true" />
            )}
        </div>
    );
}

function DownloadAction({ busy, file, format, icon: Icon, label, onDownload }) {
    const { locale, t } = useLocale();
    const size = formatDownloadBytes(file.bytes, getIntlLocale(locale));
    return (
        <button
            type="button"
            onClick={() => onDownload(file, format)}
            disabled={busy}
            aria-label={t('townMapsDownloadNamed', { format, name: label, size })}
            className="btn-secondary min-h-[46px] flex-1 justify-center px-3 text-sm disabled:cursor-wait disabled:opacity-65"
        >
            {busy ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
            {t('townMapsDownloadFormat', { format })}
        </button>
    );
}

export default function TownMapDownloadCard({
    catalogueUrl,
    downloadingKey,
    map,
    onDownload,
}) {
    const { locale, t } = useLocale();
    const intlLocale = getIntlLocale(locale);
    const pngSize = formatDownloadBytes(map.png.bytes, intlLocale);
    const pdfSize = formatDownloadBytes(map.pdf.bytes, intlLocale);

    return (
        <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <LazyTownMapThumbnail catalogueUrl={catalogueUrl} map={map} />
            <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">{map.code}</p>
                    <h2 className="mt-1 text-xl font-bold leading-snug text-slate-900">{map.name}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                    {t('townMapsDefaultColour')}
                </span>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-500">
                {map.planningAreas.join(' • ')}
            </p>

            <dl className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex items-start gap-2">
                    <FileImage size={17} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
                    <div>
                        <dt className="font-bold">{t('townMapsPngLabel')}</dt>
                        <dd className="mt-0.5 text-slate-500">{t('townMapsPngDetails', { size: pngSize })}</dd>
                    </div>
                </div>
                <div className="flex items-start gap-2">
                    <FileText size={17} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
                    <div>
                        <dt className="font-bold">{t('townMapsPdfLabel')}</dt>
                        <dd className="mt-0.5 text-slate-500">{t('townMapsPdfDetails', { size: pdfSize })}</dd>
                    </div>
                </div>
            </dl>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <DownloadAction
                    busy={downloadingKey === `${map.code}:PNG`}
                    file={map.png}
                    format="PNG"
                    icon={Download}
                    label={map.name}
                    onDownload={onDownload}
                />
                <DownloadAction
                    busy={downloadingKey === `${map.code}:PDF`}
                    file={map.pdf}
                    format="PDF"
                    icon={Download}
                    label={map.name}
                    onDownload={onDownload}
                />
            </div>

            <p className="mt-auto pt-4 text-xs leading-5 text-slate-500">
                {map.attribution}
            </p>
        </article>
    );
}
