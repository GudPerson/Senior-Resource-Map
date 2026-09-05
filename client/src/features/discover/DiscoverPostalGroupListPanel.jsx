import { Heart, Layers3, X } from 'lucide-react';

import { useLocale } from '../../contexts/LocaleContext.jsx';

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export default function DiscoverPostalGroupListPanel({
    anchorLayout = null,
    group,
    highlightedPinKey = null,
    hoverPreview = false,
    isDesktop = false,
    onHoverPin,
    onHoverPanelEnter,
    onHoverPanelLeave,
    onClose,
    onSelectPin,
}) {
    const { t } = useLocale();

    if (!group?.isPostalGroup) return null;

    const horizontalMargin = isDesktop ? 20 : 12;
    const memberCount = Math.max(1, Number(group?.memberPins?.length || 0));
    const preferredPanelWidth = isDesktop
        ? (memberCount <= 1 ? 420 : memberCount === 2 ? 640 : 700)
        : null;
    const fallbackWidth = preferredPanelWidth;
    const trackedWidth = anchorLayout?.width ?? null;
    const availablePanelWidth = trackedWidth
        ? Math.max(0, trackedWidth - (horizontalMargin * 2))
        : null;
    const panelWidth = availablePanelWidth !== null
        ? (isDesktop ? Math.min(preferredPanelWidth, availablePanelWidth) : availablePanelWidth)
        : fallbackWidth;
    const cardColumnCount = isDesktop && memberCount > 1 && panelWidth >= 620 ? 2 : 1;
    const cardRowCount = Math.ceil(memberCount / cardColumnCount);
    const minVisibleHeight = isDesktop ? 190 : 170;
    const preferredMaxHeight = isDesktop ? 520 : 420;
    const bottomPadding = isDesktop ? 24 : 16;
    const topPadding = isDesktop ? 12 : 16;
    const hoverPreviewPinClearance = hoverPreview && isDesktop ? 88 : 0;
    const verticalGap = hoverPreview && isDesktop ? 16 : 8;
    const belowGap = hoverPreview && isDesktop ? 20 : verticalGap;
    const estimatedCardHeight = cardColumnCount > 1 ? 148 : 128;
    const estimatedPanelHeight = Math.min(
        preferredMaxHeight,
        Math.max(
            minVisibleHeight,
            112 + (cardRowCount * estimatedCardHeight) + (Math.max(0, cardRowCount - 1) * 8),
        ),
    );
    const desiredTop = anchorLayout ? anchorLayout.y + belowGap : null;
    const clampedLeft = (anchorLayout && panelWidth)
        ? clampNumber(anchorLayout.x - (panelWidth / 2), horizontalMargin, anchorLayout.width - horizontalMargin - panelWidth)
        : null;
    const availableAbove = anchorLayout
        ? Math.max(140, anchorLayout.y - topPadding - hoverPreviewPinClearance - verticalGap)
        : preferredMaxHeight;
    const availableBelow = anchorLayout
        ? Math.max(140, anchorLayout.height - anchorLayout.y - bottomPadding - belowGap)
        : preferredMaxHeight;
    const placement = hoverPreview && isDesktop && anchorLayout
        ? (availableAbove >= estimatedPanelHeight
            ? 'above'
            : availableBelow >= estimatedPanelHeight
                ? 'below'
                : availableAbove >= availableBelow ? 'above' : 'below')
        : 'below';
    const panelMaxHeight = Math.min(
        preferredMaxHeight,
        placement === 'above' ? availableAbove : availableBelow,
        estimatedPanelHeight,
    );
    const clampedTop = anchorLayout
        ? (placement === 'above'
            ? Math.max(topPadding, anchorLayout.y - hoverPreviewPinClearance - verticalGap - panelMaxHeight)
            : Math.min(desiredTop, Math.max(topPadding, anchorLayout.height - bottomPadding - panelMaxHeight)))
        : null;
    const anchoredPanelStyle = anchorLayout && panelWidth && clampedLeft !== null && clampedTop !== null
        ? {
            left: `${clampedLeft}px`,
            top: `${clampedTop}px`,
            width: `${panelWidth}px`,
            maxHeight: `${panelMaxHeight}px`,
        }
        : undefined;
    const fallbackPanelStyle = !anchorLayout && fallbackWidth
        ? { width: `${fallbackWidth}px`, maxHeight: `${panelMaxHeight}px` }
        : undefined;
    const panelStyle = anchoredPanelStyle || fallbackPanelStyle;
    const scrollAreaStyle = { maxHeight: `${Math.max(92, panelMaxHeight - 88)}px` };
    const panelPositionClass = anchoredPanelStyle
        ? ''
        : (isDesktop ? 'left-1/2 top-1/2 max-w-[calc(100%-3rem)] -translate-x-1/2' : 'inset-x-3 bottom-5');

    return (
        <div
            className={`pointer-events-auto absolute z-[600] ${panelPositionClass}`}
            style={panelStyle}
            onMouseEnter={() => onHoverPanelEnter?.(group)}
            onMouseLeave={() => onHoverPanelLeave?.(group)}
        >
            <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white/96 shadow-[0_28px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">
                            <Layers3 size={14} />
                            {t('discoverySamePostalCode')}
                        </div>
                        <p className="mt-1 text-base font-bold leading-tight text-slate-900">
                            {t('discoverySavedPlacesAtLocation', {
                                count: group.hardAssetCount,
                                label: group.hardAssetCount === 1 ? t('placesSingular') : t('placesPlural'),
                            })}
                        </p>
                        {group.postalCode ? (
                            <p className="mt-1 text-sm text-slate-500">{t('discoveryPostalCodeValue', { postalCode: group.postalCode })}</p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                        aria-label={t('discoveryCloseGroupedList')}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto overscroll-contain px-3 py-3" style={scrollAreaStyle}>
                    <div className={cardColumnCount > 1 ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2'}>
                        {(group.memberPins || []).map((pin) => {
                            const isHighlighted = highlightedPinKey === pin.pinKey;
                            const offeringCount = pin.totalOfferingsCount || 0;
                            const offeringsLabel = t('discoveryProgrammeServiceCount', {
                                count: offeringCount,
                                label: offeringCount === 1 ? t('discoveryCategoryOfferingFallback') : t('availableOfferings'),
                            });
                            const previewImageUrl = pin.logoUrl
                                || pin.placeAsset?.logoUrl
                                || pin.primarySavedAsset?.liveAsset?.logoUrl
                                || pin.categoryIconUrl
                                || null;

                            return (
                                <button
                                    key={pin.pinKey}
                                    type="button"
                                    onMouseEnter={() => onHoverPin?.(pin, group)}
                                    onClick={() => onSelectPin?.(pin, group)}
                                    className={`flex w-full items-start gap-3 rounded-[22px] border px-3 py-3 text-left transition ${
                                        isHighlighted
                                            ? 'border-brand-300 bg-brand-50/70 shadow-sm'
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                                        {previewImageUrl ? (
                                            <img src={previewImageUrl} alt="" className="h-7 w-7 object-contain" draggable="false" />
                                        ) : (
                                            <Heart size={18} className="fill-[#f35f68] text-[#f35f68]" />
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[15px] font-bold leading-tight text-slate-900">{pin.title}</span>
                                        {pin.address ? (
                                            <span className="mt-1 block text-[12px] leading-5 text-slate-500">{pin.address}</span>
                                        ) : null}
                                        <span className="mt-2 inline-flex max-w-full rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-bold leading-tight text-brand-700">
                                            {offeringsLabel}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
