import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, Check, Clock, ExternalLink, Globe, Layers3, Mail, MapPin, MessageCircle, Navigation, Phone, Share2 } from 'lucide-react';

import { getDistance } from '../lib/geo.js';
import {
    buildGrabBookingDeepLink,
    buildGrabClipboardDestination,
    buildGrabRideDeepLink,
    hasDismissedGrabGuide,
    setDismissedGrabGuide,
} from '../lib/rideHailingLinks.js';
import {
    SOFT_ASSET_BUCKETS,
    getSoftAssetBucketLabel,
    groupSoftAssetsByBucket,
    summarizeSoftAssetBuckets,
} from '../lib/softAssetBuckets.js';
import { formatAvailabilityLabel, normalizeAvailabilityCount, normalizeAvailabilityUnit } from '../lib/availability.js';
import { OFFERING_ACCESS } from '../lib/eligibility.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import MarkdownLiteText from './MarkdownLiteText.jsx';
import OfferingAccessNotice from './OfferingAccessNotice.jsx';
import PartnerPrivatePanel from './PartnerPrivatePanel.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { localizeResource } from '../lib/localization.js';
import { getSocialLinkEntries, mergeSocialLinks, splitWebsiteAndSocialLinks } from '../lib/socialLinks.js';
import { buildWhatsAppContactHref, formatWhatsAppContactLabel } from '../lib/whatsappContact.js';
import { shareResourceLink } from '../lib/resourceShare.js';
import {
    formatGroupMemberCountLine,
    formatGroupReviewDate,
    getGroupGalleryUrls,
    getGroupVisibilitySummary,
    isGroupAsset,
} from '../lib/groupAssets.js';
import {
    getResourceDetailPhone,
    getResourceHeroPresentation,
    shouldShowMobileGrabAction,
    shouldShowLinkedPlaceDetails,
} from '../lib/resourceDetailPresentation.js';

function TagBadge({ tag }) {
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300">
            #{tag}
        </span>
    );
}

function hasValidCoordinates(value) {
    return Number.isFinite(Number.parseFloat(value?.lat)) && Number.isFinite(Number.parseFloat(value?.lng));
}

function formatDistance(distance, t) {
    if (!Number.isFinite(distance)) return null;
    return distance < 1
        ? t('distanceMetersAway', { distance: Math.round(distance * 1000) })
        : t('distanceKmAway', { distance: distance.toFixed(1) });
}

function getGroupMemberSections(asset = {}) {
    const members = asset.groupMembers || {};
    return [
        { key: 'places', label: 'Places', members: Array.isArray(members.places) ? members.places : [] },
        { key: 'programmes', label: 'Programmes', members: Array.isArray(members.programmes) ? members.programmes : [] },
        { key: 'services', label: 'Services', members: Array.isArray(members.services) ? members.services : [] },
        { key: 'promotions', label: 'Promotions', members: Array.isArray(members.promotions) ? members.promotions : [] },
    ];
}

function normalizeExternalHref(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    try {
        return new URL(candidate).toString();
    } catch {
        return '';
    }
}

function copyTextToClipboard(text) {
    if (!text) return Promise.reject(new Error('Nothing to copy'));
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text);
    }
    if (typeof document === 'undefined') {
        return Promise.reject(new Error('Clipboard is unavailable'));
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        const copied = document.execCommand('copy');
        return copied ? Promise.resolve() : Promise.reject(new Error('Copy failed'));
    } finally {
        document.body.removeChild(textarea);
    }
}

const SOCIAL_ICON_BUTTON_CLASSES = {
    facebook: 'border-[#1877f2] bg-[#1877f2] text-white hover:border-[#145dbd] hover:bg-[#145dbd]',
    instagram: 'border-transparent bg-[radial-gradient(circle_at_30%_110%,#ffdc80_0%,#fcaf45_24%,#f77737_42%,#e1306c_62%,#833ab4_100%)] text-white hover:brightness-95',
    tiktok: 'border-slate-900 bg-slate-950 text-white hover:bg-slate-800',
    youtube: 'border-[#ff0000] bg-[#ff0000] text-white hover:border-[#cc0000] hover:bg-[#cc0000]',
    linkedin: 'border-[#0a66c2] bg-[#0a66c2] text-white hover:border-[#084d93] hover:bg-[#084d93]',
};

function SocialPlatformIcon({ platform, size = 20 }) {
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
            return (
                <svg {...commonProps}>
                    <path d="M14.1 8.8h2.3V5.3c-.4-.1-1.7-.2-3.2-.2-3.2 0-5.3 1.9-5.3 5.5v3.1H4.5v3.9h3.4V24h4.1v-6.4h3.4l.5-3.9H12v-2.7c0-1.1.3-2.1 2.1-2.1Z" />
                </svg>
            );
        case 'instagram':
            return (
                <svg {...commonProps}>
                    <path d="M7.1 2.2h9.8c2.7 0 4.9 2.2 4.9 4.9v9.8c0 2.7-2.2 4.9-4.9 4.9H7.1c-2.7 0-4.9-2.2-4.9-4.9V7.1c0-2.7 2.2-4.9 4.9-4.9Zm0 1.9c-1.7 0-3 1.3-3 3v9.8c0 1.7 1.3 3 3 3h9.8c1.7 0 3-1.3 3-3V7.1c0-1.7-1.3-3-3-3H7.1Zm4.9 3.3a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Zm0 1.9a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Zm5.1-2.6a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z" />
                </svg>
            );
        case 'tiktok':
            return (
                <svg {...commonProps}>
                    <path d="M15.4 2.5c.3 2.5 1.7 4.1 4.1 4.3v3.4c-1.4.1-2.7-.3-4-1.1v6.3c0 3.2-2.1 5.6-5.3 5.6-3 0-5.4-2.1-5.4-5.1 0-3.5 3.4-6.1 6.8-5.1v3.5c-1.5-.5-3.3.3-3.3 1.9 0 1.1.9 1.8 1.9 1.8 1.2 0 1.9-.7 1.9-2.2V2.5h3.3Z" />
                </svg>
            );
        case 'youtube':
            return (
                <svg {...commonProps}>
                    <path d="M21.6 7.1a3 3 0 0 0-2.1-2.1C17.7 4.5 12 4.5 12 4.5s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C1.9 9 1.9 12 1.9 12s0 3 .5 4.9a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-4.9.5-4.9s0-3-.5-4.9ZM10 15.3V8.7l5.8 3.3L10 15.3Z" />
                </svg>
            );
        case 'linkedin':
            return (
                <svg {...commonProps}>
                    <path d="M5.1 8.7h3.8v12.1H5.1V8.7Zm1.9-5.9a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4Zm4.2 5.9h3.6v1.7h.1c.5-.9 1.7-2 3.6-2 3.9 0 4.6 2.5 4.6 5.8v6.6h-3.8v-5.9c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1v6h-3.8V8.7Z" />
                </svg>
            );
        default:
            return <Globe size={size} aria-hidden="true" className="shrink-0" />;
    }
}

function SocialLinksStrip({ socialLinks, t }) {
    const entries = getSocialLinkEntries(socialLinks);
    if (entries.length === 0) return null;

    return (
        <div className="sm:col-span-2">
            <div className="flex items-start gap-3">
                <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><Globe size={22} /></div>
                <div className="min-w-0">
                    <p className="font-bold text-slate-900 mb-2">{t('socialChannels')}</p>
                    <div className="flex flex-wrap gap-2">
                        {entries.map((entry) => (
                            <a
                                key={entry.key}
                                href={entry.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${t('openExternalLink')} ${entry.label}`}
                                title={entry.label}
                                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 ${SOCIAL_ICON_BUTTON_CLASSES[entry.key] || 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700'}`}
                                onClick={(event) => event.stopPropagation()}
                            >
                                <SocialPlatformIcon platform={entry.key} />
                                <span className="sr-only">{entry.label}</span>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ResourceDetailContent({
    asset: rawAsset,
    className = '',
    containerWidth = null,
    layoutMode = 'page',
    onNavigateToResource,
    sortOrigin = null,
    subCatColors = {},
    type,
}) {
    const [activeSoftBucket, setActiveSoftBucket] = useState('Programmes');
    const [shareStatus, setShareStatus] = useState('idle');
    const [grabStatus, setGrabStatus] = useState('idle');
    const [grabGuideOpen, setGrabGuideOpen] = useState(false);
    const [skipGrabGuide, setSkipGrabGuide] = useState(false);
    const isPhone = useMediaQuery('(max-width: 639px)');
    const { locale, t } = useLocale();
    const asset = useMemo(() => localizeResource(rawAsset, locale), [rawAsset, locale]);

    if (!asset) return null;

    const isHard = type === 'hard';
    const isGroup = !isHard && isGroupAsset(asset);
    const isEmbeddedPane = layoutMode === 'pane';
    const isCompact = isEmbeddedPane ? (containerWidth ?? 0) <= 560 : isPhone;
    const rootSpacingClass = isCompact ? 'space-y-5' : 'space-y-6';
    const heroPresentation = getResourceHeroPresentation({
        hasBanner: Boolean(asset.bannerUrl),
        isCompact,
    });
    const detailCardClass = isCompact ? 'rounded-[24px] border p-5 shadow-sm' : 'rounded-[28px] border p-6 shadow-sm sm:p-8';
    const introLayoutClass = isCompact ? 'flex flex-col items-start gap-3 mb-4' : 'flex flex-col sm:flex-row items-start gap-4 mb-4';
    const introTitleClass = isCompact ? 'text-[2rem] font-bold text-slate-900 leading-tight' : 'text-3xl font-bold text-slate-900 leading-tight';
    const copyClass = isCompact ? 'space-y-4 text-slate-600 text-base leading-relaxed mt-5' : 'space-y-4 text-slate-600 text-lg leading-relaxed mt-6';
    const infoGridClass = isCompact ? 'grid grid-cols-1 gap-5 mt-7 pt-5 border-t border-slate-200' : 'grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-200';
    const directionsButtonClass = isCompact
        ? 'w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-bold transition shadow-sm text-base'
        : 'w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold transition shadow-sm text-lg';
    const secondaryActionButtonClass = isCompact
        ? 'w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 font-bold transition shadow-sm text-base hover:border-brand-200 hover:text-brand-700'
        : 'w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-800 font-bold transition shadow-sm text-lg hover:border-brand-200 hover:text-brand-700';
    const relatedCardClass = isCompact
        ? 'rounded-[24px] border p-4 shadow-sm'
        : 'rounded-[28px] border p-4 shadow-sm sm:p-6';
    const relatedHeaderClass = isCompact
        ? 'flex flex-col gap-4'
        : 'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between';
    const bucketGridClass = isCompact
        ? 'grid w-full grid-cols-1 gap-2'
        : 'grid w-full grid-cols-3 gap-2 sm:min-w-[320px] sm:w-auto';
    const bucketButtonClass = isCompact
        ? 'rounded-2xl border px-3 py-3 text-left transition-colors'
        : 'rounded-2xl border px-2.5 py-2 text-left transition-colors sm:px-3';
    const relatedItemClass = isCompact
        ? 'flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand-500 hover:shadow-md cursor-pointer'
        : 'flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand-500 hover:shadow-md sm:gap-4 sm:p-4 cursor-pointer';

    const softLocations = useMemo(() => {
        if (isHard || isGroup) return [];

        const locations = Array.isArray(asset.locations) && asset.locations.length > 0
            ? asset.locations
            : (asset.location ? [asset.location] : []);

        if (!sortOrigin) {
            return locations;
        }

        return [...locations]
            .map((location) => ({
                ...location,
                _distance: hasValidCoordinates(location)
                    ? getDistance(
                        sortOrigin.lat,
                        sortOrigin.lng,
                        Number.parseFloat(location.lat),
                        Number.parseFloat(location.lng),
                    )
                    : null,
            }))
            .sort((left, right) => {
                if (left._distance === null) return 1;
                if (right._distance === null) return -1;
                return left._distance - right._distance;
            });
    }, [asset, isGroup, isHard, sortOrigin]);

    const primaryLocation = isHard ? asset : (isGroup ? null : (softLocations[0] || asset.location || null));
    const primaryAddress = isHard ? asset?.address : primaryLocation?.address;
    const phone = getResourceDetailPhone({ asset, primaryLocation, isHard });
    const whatsappContact = String(asset?.whatsappContact || primaryLocation?.whatsappContact || '').trim();
    const whatsappHref = buildWhatsAppContactHref(whatsappContact);
    const whatsappLabel = formatWhatsAppContactLabel(whatsappContact);
    const websiteParts = isHard ? splitWebsiteAndSocialLinks(asset?.website) : { website: '', socialLinks: {} };
    const websiteHref = isHard ? normalizeExternalHref(websiteParts.website) : '';
    const visibleSocialLinks = isHard ? mergeSocialLinks(asset?.socialLinks, websiteParts.socialLinks) : {};
    const contactEmail = !isHard ? String(asset?.contactEmail || '').trim() : '';
    const externalCtaLabel = !isHard ? String(asset?.ctaLabel || '').trim() || t('openLink') : '';
    const externalCtaHref = !isHard ? normalizeExternalHref(asset?.ctaUrl) : '';
    const availablePlaceCount = isHard ? 0 : softLocations.length;
    const hasLinkedPlaceDetails = shouldShowLinkedPlaceDetails({ isHard, softLocations });
    const availabilityEnabled = !isHard && !isGroup && Boolean(asset.availabilityEnabled);
    const availabilityCount = normalizeAvailabilityCount(asset.availabilityCount);
    const availabilityUnit = normalizeAvailabilityUnit(asset.availabilityUnit);
    const access = !isHard && !isGroup ? (asset.access || OFFERING_ACCESS.GRANTED) : null;
    const relatedSoftAssetGroups = useMemo(() => (
        isHard ? groupSoftAssetsByBucket(asset?.softAssets || []) : { Programmes: [], Services: [], Promotions: [] }
    ), [asset?.softAssets, isHard]);
    const relatedSoftAssetCounts = useMemo(() => (
        isHard ? summarizeSoftAssetBuckets(asset?.softAssets || []) : { Programmes: 0, Services: 0, Promotions: 0 }
    ), [asset?.softAssets, isHard]);
    const activeSoftBucketLabel = getSoftAssetBucketLabel(t, activeSoftBucket);
    const hasDirectionsTarget = isHard
        ? Boolean(asset && (asset.address || hasValidCoordinates(asset)))
        : Boolean(!isGroup && primaryLocation && (primaryLocation.address || hasValidCoordinates(primaryLocation)));
    const groupMemberSections = isGroup ? getGroupMemberSections(asset) : [];
    const groupVisibilitySummary = isGroup ? getGroupVisibilitySummary(asset) : null;
    const groupReviewDate = isGroup ? formatGroupReviewDate(asset.lastReviewedAt || asset.last_reviewed_at, locale) : '';
    const groupGalleryUrls = isGroup ? getGroupGalleryUrls(asset, isCompact ? 4 : 6) : [];
    const grabAddress = String(primaryAddress || '').trim();
    const grabPlaceName = String(((isHard ? asset?.name : primaryLocation?.name) || asset?.name || '')).trim();
    const grabClipboardText = buildGrabClipboardDestination({
        name: grabPlaceName,
        address: primaryAddress,
    });
    const grabBookingHref = buildGrabBookingDeepLink();
    const grabRideHref = hasDirectionsTarget
        ? (grabAddress ? grabBookingHref : buildGrabRideDeepLink({
            name: (isHard ? asset?.name : primaryLocation?.name) || asset?.name,
            address: primaryAddress,
            lat: isHard ? asset?.lat : primaryLocation?.lat,
            lng: isHard ? asset?.lng : primaryLocation?.lng,
        }))
        : '';
    const showGrabAction = shouldShowMobileGrabAction({ isPhone, grabRideHref });

    useEffect(() => {
        if (!isHard) return;
        const nextBucket = SOFT_ASSET_BUCKETS.find((bucket) => relatedSoftAssetCounts[bucket] > 0) || 'Programmes';
        setActiveSoftBucket(nextBucket);
    }, [isHard, relatedSoftAssetCounts]);

    useEffect(() => {
        if (!showGrabAction && grabGuideOpen) {
            setGrabGuideOpen(false);
        }
    }, [grabGuideOpen, showGrabAction]);

    const handleDirections = useCallback((customLocation = null) => {
        const target = customLocation || (isHard ? asset : primaryLocation);
        if (!target) return;

        const lat = Number.parseFloat(target.lat);
        const lng = Number.parseFloat(target.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank', 'noopener,noreferrer');
        } else if (target.address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target.address)}`, '_blank', 'noopener,noreferrer');
        }
    }, [asset, isHard, primaryLocation]);

    const handleShareResource = useCallback(async () => {
        try {
            const result = await shareResourceLink({
                type,
                id: asset.id,
                title: asset.name,
            });
            setShareStatus(result.mode === 'native' ? 'shared' : 'copied');
            window.setTimeout(() => setShareStatus('idle'), 1800);
        } catch {
            setShareStatus('failed');
            window.setTimeout(() => setShareStatus('idle'), 2200);
        }
    }, [asset.id, asset.name, type]);

    const handleGrabAddressAction = useCallback(async () => {
        if (!grabClipboardText || !grabBookingHref) return;

        const copyPromise = copyTextToClipboard(grabClipboardText);
        if (hasDismissedGrabGuide()) {
            window.open(grabBookingHref, '_blank', 'noopener,noreferrer');
        } else {
            setSkipGrabGuide(false);
            setGrabGuideOpen(true);
        }

        try {
            await copyPromise;
            setGrabStatus('copied');
            window.setTimeout(() => setGrabStatus('idle'), 2200);
        } catch {
            setGrabStatus('failed');
            window.setTimeout(() => setGrabStatus('idle'), 2600);
        }
    }, [grabBookingHref, grabClipboardText]);

    const handleOpenGrabFromGuide = useCallback(() => {
        if (skipGrabGuide) {
            setDismissedGrabGuide(true);
        }
        setGrabGuideOpen(false);
        window.open(grabBookingHref, '_blank', 'noopener,noreferrer');
    }, [grabBookingHref, skipGrabGuide]);

    return (
        <div className={`${rootSpacingClass} ${className}`}>
            {grabGuideOpen ? (
                <div
                    className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 px-4 py-4 sm:items-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="grab-guide-title"
                >
                    <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Grab</p>
                                <h2 id="grab-guide-title" className="mt-1 text-xl font-bold text-slate-950">
                                    {t('grabGuideTitle')}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setGrabGuideOpen(false)}
                                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
                            >
                                {t('close')}
                            </button>
                        </div>

                        {grabPlaceName ? (
                            <p className="mt-3 text-base font-bold leading-relaxed text-slate-950">
                                {grabPlaceName}
                            </p>
                        ) : null}

                        <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-800">
                                {t('grabGuideCopiedLabel')}
                            </p>
                            <p className="mt-2 whitespace-pre-line break-words text-base font-bold leading-relaxed text-slate-950">
                                {grabClipboardText}
                            </p>
                        </div>

                        <div className="mt-4 grid gap-3">
                            <div className="flex gap-3">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">1</span>
                                <p className="pt-0.5 text-sm font-semibold leading-relaxed text-slate-700">
                                    {t('grabGuideStepWhereTo')}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">2</span>
                                <p className="pt-0.5 text-sm font-semibold leading-relaxed text-slate-700">
                                    {t('grabGuideStepPaste')}
                                </p>
                            </div>
                        </div>

                        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                            <input
                                type="checkbox"
                                checked={skipGrabGuide}
                                onChange={(event) => setSkipGrabGuide(event.target.checked)}
                                className="mt-1 h-4 w-4 accent-brand-600"
                            />
                            <span>{t('grabGuideSkipLabel')}</span>
                        </label>

                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={handleOpenGrabFromGuide}
                                className="btn-primary justify-center"
                            >
                                <Navigation size={18} />
                                {t('grabGuideOpenGrab')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setGrabGuideOpen(false)}
                                className="btn-secondary justify-center"
                            >
                                {t('cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {(asset.bannerUrl || asset.logoUrl) && (
                <div
                    className={`w-full ${heroPresentation.frameClass} ${isCompact ? 'rounded-[24px]' : 'rounded-[28px]'} border overflow-hidden flex items-center justify-center shadow-sm relative`}
                    style={{ backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'var(--color-border)' }}
                >
                    {asset.bannerUrl ? (
                        <img src={asset.bannerUrl} alt={t('bannerImageAlt')} className={heroPresentation.imageClass} />
                    ) : (
                        <img src={asset.logoUrl} alt={t('logoImageAlt')} className={heroPresentation.imageClass} />
                    )}
                </div>
            )}

            <div
                className={detailCardClass}
                style={{ backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'var(--color-border)' }}
            >
                <div className={introLayoutClass}>
                    {asset.logoUrl && asset.bannerUrl ? (
                        <img
                            src={asset.logoUrl}
                            alt={t('logoImageAlt')}
                            className="w-20 h-20 rounded-2xl border object-contain bg-white flex-shrink-0"
                            style={{ borderColor: 'var(--color-border)' }}
                        />
                    ) : null}
                    <div>
                        <div
                            className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 rounded-full bg-white text-sm font-bold border shadow-sm"
                            style={{ color: subCatColors[asset.subCategory] || '#334155', borderColor: 'var(--color-border)' }}
                        >
                            {isHard ? <Building2 size={16} /> : isGroup ? <Layers3 size={16} /> : <CalendarDays size={16} />}
                            {isGroup ? 'Group' : (asset.subCategory || (isHard ? t('place') : t('offering')))}
                        </div>
                        <h1 className={introTitleClass}>{asset.name}</h1>
                        {!isHard ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {isGroup ? (
                                    <span
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border"
                                        style={{
                                            backgroundColor: 'var(--color-brand-light)',
                                            color: 'var(--color-brand-strong)',
                                            borderColor: 'var(--color-border)',
                                        }}
                                    >
                                        <Layers3 size={15} />
                                        {formatGroupMemberCountLine(asset)}
                                    </span>
                                ) : null}
                                {isGroup && groupVisibilitySummary ? (
                                    <span
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-sm font-bold text-slate-700 border border-slate-200"
                                    >
                                        <Globe size={15} />
                                        {groupVisibilitySummary.label}
                                    </span>
                                ) : null}
                                {isGroup && groupReviewDate ? (
                                    <span
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-sm font-bold text-slate-700 border border-slate-200"
                                    >
                                        <Check size={15} />
                                        Last reviewed {groupReviewDate}
                                    </span>
                                ) : null}
                                {hasLinkedPlaceDetails ? (
                                    <span
                                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border"
                                        style={{
                                            backgroundColor: 'var(--color-brand-light)',
                                            color: 'var(--color-brand-strong)',
                                            borderColor: 'var(--color-border)',
                                        }}
                                    >
                                        {t('availableIn')} {availablePlaceCount} {availablePlaceCount === 1 ? t('placesSingular') : t('placesPlural')}
                                    </span>
                                ) : null}
                                {availabilityEnabled ? (
                                    <span
                                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border"
                                        style={{
                                            backgroundColor: 'color-mix(in srgb, var(--color-brand-light) 60%, white)',
                                            color: 'var(--color-brand-strong)',
                                            borderColor: 'var(--color-border)',
                                        }}
                                    >
                                        {formatAvailabilityLabel(availabilityCount, availabilityUnit)}
                                    </span>
                                ) : null}
                            </div>
                        ) : null}

                        {!isHard && !isGroup ? (
                            <OfferingAccessNotice
                                access={access}
                                missingProfileFields={asset.missingProfileFields}
                                className="mt-4"
                            />
                        ) : null}
                    </div>
                </div>

                <div className={copyClass}>
                    {asset.description ? (
                        <MarkdownLiteText text={asset.description} />
                    ) : (
                        <p className="italic text-slate-400">{t('noDescription')}</p>
                    )}
                </div>

                <div className={infoGridClass}>
                    {isHard && primaryAddress ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><MapPin size={22} /></div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">{t('address')}</p>
                                <p className="text-slate-700">{primaryAddress}</p>
                            </div>
                        </div>
                    ) : null}

                    {hasLinkedPlaceDetails ? (
                        softLocations.map((location, index) => (
                            <div key={location.id || index} className="flex items-start gap-3">
                                <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><MapPin size={22} /></div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <p className="font-bold text-slate-900">{t('placeLabel')}: {location.name}</p>
                                        {location._distance !== undefined && location._distance !== null ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                                                {formatDistance(location._distance, t)}
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="text-slate-700">{location.address}</p>
                                    <div className="flex items-center gap-4 mt-2 border-t border-slate-100 pt-2">
                                        {Number.isInteger(location.id) ? (
                                            <button
                                                type="button"
                                                onClick={() => onNavigateToResource?.('hard', location.id)}
                                                className="text-brand-600 text-sm font-bold hover:underline block"
                                            >
                                                {t('viewDetails')}
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={() => handleDirections(location)}
                                            className="text-brand-600 text-sm font-bold hover:underline flex items-center gap-1"
                                        >
                                            <Navigation size={14} />
                                            {t('directions')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : null}

                    {isGroup && groupVisibilitySummary ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><Globe size={22} /></div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Collection visibility</p>
                                <p className="text-slate-700">{groupVisibilitySummary.label}</p>
                                <p className="text-sm text-slate-500">{groupVisibilitySummary.detail}</p>
                            </div>
                        </div>
                    ) : null}

                    {isGroup && groupReviewDate ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><Check size={22} /></div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Last reviewed</p>
                                <p className="text-slate-700">{groupReviewDate}</p>
                            </div>
                        </div>
                    ) : null}

                    {(asset.schedule || asset.hours) ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><Clock size={22} /></div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">{isHard ? t('operatingHours') : t('schedule')}</p>
                                <p className="whitespace-pre-line text-slate-700">{asset.schedule || asset.hours}</p>
                            </div>
                        </div>
                    ) : null}

                    {websiteHref ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><Globe size={22} /></div>
                            <div className="min-w-0">
                                <p className="font-bold text-slate-900 mb-1">{t('website')}</p>
                                <a
                                    href={websiteHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex max-w-full items-center gap-1 break-all text-brand-700 hover:underline"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <span className="min-w-0 break-all">{asset.website || websiteHref}</span>
                                    <ExternalLink size={15} className="flex-shrink-0" />
                                </a>
                            </div>
                        </div>
                    ) : null}

                    {contactEmail ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><Mail size={22} /></div>
                            <div className="min-w-0">
                                <p className="font-bold text-slate-900 mb-1">{t('email')}</p>
                                <a
                                    href={`mailto:${contactEmail}`}
                                    className="break-all text-brand-700 hover:underline"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    {contactEmail}
                                </a>
                            </div>
                        </div>
                    ) : null}

                    {externalCtaHref ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><ExternalLink size={22} /></div>
                            <div className="min-w-0">
                                <p className="font-bold text-slate-900 mb-1">{t('link')}</p>
                                <a
                                    href={externalCtaHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex max-w-full items-center gap-1 break-all text-brand-700 hover:underline"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <span className="min-w-0 break-all">{externalCtaLabel}</span>
                                    <ExternalLink size={15} className="flex-shrink-0" />
                                </a>
                            </div>
                        </div>
                    ) : null}

                    {phone ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><Phone size={22} /></div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">{t('contact')}</p>
                                <p className="text-slate-700">{phone}</p>
                            </div>
                        </div>
                    ) : null}

                    {whatsappHref ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><MessageCircle size={22} /></div>
                            <div className="min-w-0">
                                <p className="font-bold text-slate-900 mb-1">{t('whatsappContact')}</p>
                                <a
                                    href={whatsappHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex max-w-full items-center gap-1 break-all text-brand-700 hover:underline"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <span>{whatsappLabel}</span>
                                    <ExternalLink size={15} className="flex-shrink-0" />
                                </a>
                            </div>
                        </div>
                    ) : null}

                    {isHard ? <SocialLinksStrip socialLinks={visibleSocialLinks} t={t} /> : null}
                </div>

                {groupGalleryUrls.length > 0 ? (
                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <h3 className="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">Gallery</h3>
                        <div className={isCompact ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-3 sm:grid-cols-3'}>
                            {groupGalleryUrls.map((url, index) => (
                                <div key={`${url}-${index}`} className="aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                                    <img
                                        src={url}
                                        alt={`${asset.name || 'Group'} gallery image ${index + 1}`}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {asset.tags && asset.tags.length > 0 ? (
                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <h3 className="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">{t('tags')}</h3>
                        <div className="flex flex-wrap gap-2">
                            {asset.tags.map((tag) => <TagBadge key={tag} tag={tag} />)}
                        </div>
                    </div>
                ) : null}

                <div className={isCompact ? 'mt-8 grid grid-cols-1 gap-3' : 'mt-8 flex flex-col gap-3 sm:flex-row'}>
                    {hasDirectionsTarget ? (
                        <button
                            type="button"
                            onClick={() => handleDirections()}
                            className={directionsButtonClass}
                            style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)' }}
                        >
                            <Navigation size={20} />
                            {isHard ? t('getDirections') : t('getDirectionsNearest')}
                        </button>
                    ) : null}
                    {showGrabAction ? (
                        grabAddress ? (
                            <button
                                type="button"
                                onClick={handleGrabAddressAction}
                                className={secondaryActionButtonClass}
                            >
                                {grabStatus === 'copied' ? <Check size={20} /> : <Navigation size={20} />}
                                {grabStatus === 'copied'
                                    ? t('addressCopiedForGrab')
                                    : grabStatus === 'failed'
                                        ? t('copyFailed')
                                        : t('copyAddressForGrab')}
                            </button>
                        ) : (
                            <a
                                href={grabRideHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className={secondaryActionButtonClass}
                            >
                                <Navigation size={20} />
                                {t('openInGrab')}
                            </a>
                        )
                    ) : null}
                    <button
                        type="button"
                        onClick={handleShareResource}
                        className={secondaryActionButtonClass}
                    >
                        {shareStatus === 'copied' || shareStatus === 'shared' ? <Check size={20} /> : <Share2 size={20} />}
                        {shareStatus === 'copied'
                            ? t('resourceLinkCopied')
                            : shareStatus === 'shared'
                                ? t('resourceLinkShared')
                                : shareStatus === 'failed'
                                    ? t('copyFailed')
                                    : t('shareResource')}
                    </button>
                </div>

                <PartnerPrivatePanel
                    resourceType={type}
                    resourceId={asset.id}
                    compact={isCompact}
                />
            </div>

            {isGroup ? (
                <div
                    className={relatedCardClass}
                    style={{ backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'var(--color-border)' }}
                >
                    <div className={relatedHeaderClass}>
                        <div>
                            <h2 className={isCompact ? 'text-2xl font-bold text-slate-900 leading-tight' : 'text-xl font-bold text-slate-900 sm:text-2xl'}>Included resources</h2>
                            <p className="mt-1 text-sm text-slate-500">{formatGroupMemberCountLine(asset)}</p>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-5">
                        {groupMemberSections.map((section) => (
                            section.members.length > 0 ? (
                                <section key={section.key} className="grid gap-3">
                                    <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{section.label}</h3>
                                    <div className="grid gap-3">
                                        {section.members.map((member) => (
                                            <button
                                                key={`${member.resourceType}-${member.id}`}
                                                type="button"
                                                onClick={() => onNavigateToResource?.(member.resourceType, member.id)}
                                                className={relatedItemClass}
                                            >
                                                {member.logoUrl ? (
                                                    <div className={isCompact ? 'flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1' : 'flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1 sm:h-14 sm:w-14'}>
                                                        <img src={member.logoUrl} alt={t('logoImageAlt')} className="max-w-full max-h-full object-contain" />
                                                    </div>
                                                ) : (
                                                    <div className={isCompact ? 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600' : 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600 sm:h-14 sm:w-14'}>
                                                        {member.resourceType === 'hard' ? <Building2 size={24} /> : <CalendarDays size={24} />}
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1 text-left">
                                                    <h4 className={isCompact ? 'line-clamp-3 text-lg font-bold leading-tight text-slate-900' : 'line-clamp-2 text-base font-bold leading-tight text-slate-900 sm:text-lg'}>{member.name}</h4>
                                                    {member.subCategory ? (
                                                        <p className="mt-1 text-sm font-semibold text-slate-500">{member.subCategory}</p>
                                                    ) : null}
                                                    {member.description ? (
                                                        <MarkdownLiteText
                                                            text={member.description}
                                                            compact
                                                            className={isCompact ? 'mt-2 line-clamp-3 text-sm text-slate-600' : 'mt-2 line-clamp-2 text-xs text-slate-600 sm:text-sm'}
                                                        />
                                                    ) : null}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            ) : null
                        ))}
                    </div>
                </div>
            ) : null}

            {isHard && asset.softAssets && asset.softAssets.length > 0 ? (
                <div
                    className={relatedCardClass}
                    style={{ backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'var(--color-border)' }}
                >
                    <div className={relatedHeaderClass}>
                        <div>
                            <h2 className={isCompact ? 'text-2xl font-bold text-slate-900 leading-tight' : 'text-xl font-bold text-slate-900 sm:text-2xl'}>{t('availableOfferings')}</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {t('browseByBucket')}
                            </p>
                        </div>
                        <div className={bucketGridClass}>
                            {SOFT_ASSET_BUCKETS.map((bucket) => (
                                <button
                                    key={bucket}
                                    type="button"
                                    onClick={() => setActiveSoftBucket(bucket)}
                                    className={bucketButtonClass}
                                    style={{
                                        borderColor: activeSoftBucket === bucket ? 'var(--color-brand)' : 'var(--color-border)',
                                        backgroundColor: activeSoftBucket === bucket ? 'color-mix(in srgb, var(--color-brand-light) 45%, white)' : 'white',
                                    }}
                                >
                                    <div className={isCompact ? 'text-2xl font-extrabold leading-none' : 'text-base font-extrabold leading-none sm:text-lg'} style={{ color: 'var(--color-text)' }}>
                                        {relatedSoftAssetCounts[bucket]}
                                    </div>
                                    <div
                                        className={isCompact ? 'mt-1 text-xs font-bold uppercase tracking-[0.12em]' : 'mt-1 text-[10px] font-bold uppercase tracking-[0.1em] sm:text-xs sm:tracking-[0.12em]'}
                                        style={{ color: activeSoftBucket === bucket ? 'var(--color-brand)' : 'var(--color-text-muted)' }}
                                    >
                                        {getSoftAssetBucketLabel(t, bucket)}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4">
                        {relatedSoftAssetGroups[activeSoftBucket].length > 0 ? relatedSoftAssetGroups[activeSoftBucket].map((softAsset) => (
                            <div
                                key={softAsset.id}
                                onClick={() => onNavigateToResource?.('soft', softAsset.id)}
                                className={relatedItemClass}
                            >
                                {softAsset.logoUrl ? (
                                    <div className={isCompact ? 'flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1' : 'flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1 sm:h-14 sm:w-14'}>
                                        <img src={softAsset.logoUrl} alt={t('logoImageAlt')} className="max-w-full max-h-full object-contain" />
                                    </div>
                                ) : (
                                    <div className={isCompact ? 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600' : 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600 sm:h-14 sm:w-14'}>
                                        <CalendarDays size={24} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h3 className={isCompact ? 'line-clamp-3 text-lg font-bold leading-tight text-slate-900' : 'line-clamp-2 text-base font-bold leading-tight text-slate-900 sm:text-lg'}>{softAsset.name}</h3>
                                    {softAsset.schedule ? (
                                        <p className={isCompact ? 'mt-1 flex items-start gap-1 text-sm text-slate-500' : 'mt-1 flex items-start gap-1 text-xs text-slate-500 sm:text-sm'}>
                                            <Clock size={14} className="mt-0.5 flex-shrink-0" />
                                            <span className="whitespace-pre-line">{softAsset.schedule}</span>
                                        </p>
                                    ) : null}
                                    {softAsset.description ? (
                                        <MarkdownLiteText
                                            text={softAsset.description}
                                            compact
                                            className={isCompact ? 'mt-2 line-clamp-3 text-sm text-slate-600' : 'mt-2 line-clamp-2 text-xs text-slate-600 sm:text-sm'}
                                        />
                                    ) : null}
                                </div>
                            </div>
                        )) : (
                            <div
                                className="rounded-2xl border border-dashed px-5 py-8 text-center"
                                style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(248,252,251,0.82)' }}
                            >
                                <p className="text-base font-bold text-slate-900">{t('noBucketItems', { bucket: activeSoftBucketLabel.toLocaleLowerCase() })}</p>
                                <p className="mt-1 text-sm text-slate-500">
                                    {t('switchTabs')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
