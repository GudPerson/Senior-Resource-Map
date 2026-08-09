import { useEffect, useState } from 'react';
import { Clock, Globe2, Phone } from 'lucide-react';

import { useLocale } from '../contexts/LocaleContext.jsx';
import { buildEmbedResourcePreviewDetails } from '../lib/embedMapPresentation.js';
import {
    PRINT_MAP_LABEL_DETAIL_FULL,
    PRINT_MAP_LABEL_DETAIL_LOGOS,
    PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES,
    PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS,
    normalizePrintMapLabelDetail,
} from '../lib/printMapState.js';
import { getSocialLinkEntries } from '../lib/socialLinks.js';

const SOCIAL_ICON_BUTTON_CLASSES = {
    facebook: 'border-[#1877f2] bg-[#1877f2] text-white hover:border-[#145dbd] hover:bg-[#145dbd]',
    instagram: 'border-transparent bg-[radial-gradient(circle_at_30%_110%,#ffdc80_0%,#fcaf45_24%,#f77737_42%,#e1306c_62%,#833ab4_100%)] text-white hover:brightness-95',
    tiktok: 'border-slate-900 bg-slate-950 text-white hover:bg-slate-800',
    youtube: 'border-[#ff0000] bg-[#ff0000] text-white hover:border-[#cc0000] hover:bg-[#cc0000]',
    linkedin: 'border-[#0a66c2] bg-[#0a66c2] text-white hover:border-[#084d93] hover:bg-[#084d93]',
};

export const COMPACT_RESOURCE_DETAIL_ACTION_CLASSNAME = 'ml-auto inline-flex min-h-11 items-center gap-1 text-xs font-bold text-brand-700 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2';

function normalizeContactHref(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:\/\//i.test(text)) return '';
    const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    try {
        const url = new URL(candidate);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
            ? url.toString()
            : '';
    } catch {
        return '';
    }
}

function normalizeContactPhone(value) {
    const label = String(value || '').replace(/\s+/g, ' ').trim();
    if (!label || !/\d/.test(label)) return null;
    const dialValue = label.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    return dialValue.replace(/\D/g, '').length >= 3
        ? { label, href: `tel:${dialValue}` }
        : null;
}

function EmbedSocialPlatformIcon({ platform, size = 19 }) {
    const commonProps = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'currentColor',
        'aria-hidden': 'true',
        focusable: 'false',
        className: 'shrink-0',
    };

    switch (platform) {
        case 'facebook':
            return <svg {...commonProps}><path d="M14.1 8.8h2.3V5.3c-.4-.1-1.7-.2-3.2-.2-3.2 0-5.3 1.9-5.3 5.5v3.1H4.5v3.9h3.4V24h4.1v-6.4h3.4l.5-3.9H12v-2.7c0-1.1.3-2.1 2.1-2.1Z" /></svg>;
        case 'instagram':
            return <svg {...commonProps}><path d="M7.1 2.2h9.8c2.7 0 4.9 2.2 4.9 4.9v9.8c0 2.7-2.2 4.9-4.9 4.9H7.1c-2.7 0-4.9-2.2-4.9-4.9V7.1c0-2.7 2.2-4.9 4.9-4.9Zm0 1.9c-1.7 0-3 1.3-3 3v9.8c0 1.7 1.3 3 3 3h9.8c1.7 0 3-1.3 3-3V7.1c0-1.7-1.3-3-3-3H7.1Zm4.9 3.3a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Zm0 1.9a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Zm5.1-2.6a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z" /></svg>;
        case 'tiktok':
            return <svg {...commonProps}><path d="M15.4 2.5c.3 2.5 1.7 4.1 4.1 4.3v3.4c-1.4.1-2.7-.3-4-1.1v6.3c0 3.2-2.1 5.6-5.3 5.6-3 0-5.4-2.1-5.4-5.1 0-3.5 3.4-6.1 6.8-5.1v3.5c-1.5-.5-3.3.3-3.3 1.9 0 1.1.9 1.8 1.9 1.8 1.2 0 1.9-.7 1.9-2.2V2.5h3.3Z" /></svg>;
        case 'youtube':
            return <svg {...commonProps}><path d="M21.6 7.1a3 3 0 0 0-2.1-2.1C17.7 4.5 12 4.5 12 4.5s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C1.9 9 1.9 12 1.9 12s0 3 .5 4.9a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-4.9.5-4.9s0-3-.5-4.9ZM10 15.3V8.7l5.8 3.3L10 15.3Z" /></svg>;
        case 'linkedin':
            return <svg {...commonProps}><path d="M5.1 8.7h3.8v12.1H5.1V8.7Zm1.9-5.9a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4Zm4.2 5.9h3.6v1.7h.1c.5-.9 1.7-2 3.6-2 3.9 0 4.6 2.5 4.6 5.8v6.6h-3.8v-5.9c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1v6h-3.8V8.7Z" /></svg>;
        default:
            return <Globe2 size={size} aria-hidden="true" className="shrink-0" />;
    }
}

function WebsiteIconMark() {
    return (
        <span aria-hidden="true" className="inline-flex items-center gap-0.5 leading-none">
            <Globe2 size={16} strokeWidth={2.1} className="shrink-0" />
            <span className="text-[7px] font-black tracking-[0.03em]">WWW</span>
        </span>
    );
}

function ResourcePreviewLogo({ row }) {
    const imageUrls = [row?.logoUrl, row?.mapCategoryIconUrl, row?.categoryIconUrl]
        .map((value) => String(value || '').trim())
        .filter((value, index, values) => value && values.indexOf(value) === index);
    const imageSignature = imageUrls.join('|');
    const [failedImageCount, setFailedImageCount] = useState(0);

    useEffect(() => {
        setFailedImageCount(0);
    }, [imageSignature]);

    const imageUrl = imageUrls[failedImageCount] || '';
    const fallbackLabel = String(row?.name || '').trim().slice(0, 1).toUpperCase() || 'C';

    return (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-base font-extrabold text-slate-500 shadow-sm sm:h-14 sm:w-14 sm:rounded-2xl">
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain p-1"
                    onError={() => setFailedImageCount((current) => current + 1)}
                />
            ) : fallbackLabel}
        </span>
    );
}

function ResourceContactLinks({ row, detailAction = null }) {
    const { t } = useLocale();
    const websiteHref = normalizeContactHref(row?.website);
    const contactPhone = normalizeContactPhone(row?.contactPhone);
    const socialEntries = getSocialLinkEntries(row?.socialLinks)
        .map((entry) => ({ ...entry, url: normalizeContactHref(entry.url) }))
        .filter((entry) => entry.url);

    if (!websiteHref && !contactPhone && socialEntries.length === 0 && !detailAction) return null;

    return (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {websiteHref ? (
                <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('website')}
                    title={t('website')}
                    className="inline-flex h-11 w-[52px] items-center justify-center rounded-full border border-brand-200 bg-brand-50 px-1 text-brand-700 transition hover:border-brand-300 hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2"
                >
                    <WebsiteIconMark />
                    <span className="sr-only">{t('website')}</span>
                </a>
            ) : null}
            {contactPhone ? (
                <a
                    href={contactPhone.href}
                    aria-label={`${t('contact')}: ${contactPhone.label}`}
                    className="inline-flex min-h-11 items-center gap-1.5 px-1 text-xs font-bold text-brand-700 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2"
                >
                    <Phone size={14} /> {contactPhone.label}
                </a>
            ) : null}
            {socialEntries.map((entry) => (
                <a
                    key={entry.key}
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${t('openExternalLink')} ${entry.label}`}
                    title={entry.label}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 ${SOCIAL_ICON_BUTTON_CLASSES[entry.key] || 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700'}`}
                >
                    <EmbedSocialPlatformIcon platform={entry.key} />
                    <span className="sr-only">{entry.label}</span>
                </a>
            ))}
            {detailAction}
        </div>
    );
}

export default function CompactResourcePreviewCard({
    group,
    row,
    detailAction = null,
    trailingAction = null,
    framed = false,
    reserveCloseSpace = false,
    labelDetail = PRINT_MAP_LABEL_DETAIL_FULL,
    className = '',
    ...articleProps
}) {
    const { t } = useLocale();
    const preview = buildEmbedResourcePreviewDetails(group, row);
    const normalizedLabelDetail = normalizePrintMapLabelDetail(labelDetail);
    const showLogo = normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_LOGOS
        || normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const showAddress = normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES
        || normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const showDescription = normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS
        || normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const showFullDetails = normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;

    return (
        <article
            {...articleProps}
            className={`text-sm ${framed ? 'rounded-2xl border border-slate-200 p-2 sm:p-3' : ''} ${className}`.trim()}
        >
            <div className={`flex items-start gap-2 sm:gap-3 ${reserveCloseSpace ? 'pr-10 sm:pr-11' : ''}`}>
                {showLogo ? <ResourcePreviewLogo row={row} /> : null}
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold leading-4 text-slate-950 sm:leading-5">{preview.name}</p>
                    {showAddress && preview.address ? (
                        <p className="mt-0.5 break-words text-xs leading-4 text-slate-500 sm:mt-1 sm:leading-5">{preview.address}</p>
                    ) : null}
                </div>
                {trailingAction ? <div className="shrink-0">{trailingAction}</div> : null}
            </div>

            {showFullDetails && preview.openProgrammeServiceCount > 0 ? (
                <span className="mt-1.5 inline-flex rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800 sm:mt-2">
                    {t('embedMapOpenProgrammeServiceCount', {
                        count: preview.openProgrammeServiceCount,
                    })}
                </span>
            ) : null}

            {showDescription && preview.scheduleText && row?.status !== 'unavailable' ? (
                <div className="mt-1.5 flex min-h-9 items-center gap-2 rounded-xl bg-slate-50 p-2 sm:mt-2 sm:items-start">
                    <Clock size={17} aria-hidden="true" className="shrink-0 text-brand-700 sm:mt-0.5" />
                    <div className="min-w-0">
                        <p className="hidden text-[10px] font-extrabold uppercase tracking-wide text-slate-500 sm:block">
                            {t(preview.scheduleLabelKey)}
                        </p>
                        <p className="whitespace-pre-line break-words text-xs leading-4 text-slate-700 sm:mt-0.5 sm:leading-5">
                            {preview.scheduleText}
                        </p>
                    </div>
                </div>
            ) : null}

            {showFullDetails && row?.status !== 'unavailable' ? (
                <div className="mt-1 sm:mt-1.5">
                    <ResourceContactLinks row={row} detailAction={detailAction} />
                </div>
            ) : null}
        </article>
    );
}
