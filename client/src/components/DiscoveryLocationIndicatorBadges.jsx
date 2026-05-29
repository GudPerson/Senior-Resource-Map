import { CircleStar } from 'lucide-react';

import { useLocale } from '../contexts/LocaleContext.jsx';
import { getDiscoveryLocationIndicatorPresentation } from '../features/discover/locationIndicators.js';

export default function DiscoveryLocationIndicatorBadges({
    className = '',
    compact = false,
    indicators = null,
}) {
    const { t } = useLocale();
    const { recommendationKey, showAudienceStar } = getDiscoveryLocationIndicatorPresentation(indicators);

    if (!showAudienceStar && !recommendationKey) return null;

    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
            {showAudienceStar ? (
                <span
                    aria-label={t('discoveryRelevantToYourArea')}
                    title={t('discoveryRelevantToYourArea')}
                    className={`inline-flex shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-600 ${compact ? 'h-6 w-6' : 'h-7 w-7'}`}
                >
                    <CircleStar size={compact ? 14 : 15} strokeWidth={2} />
                </span>
            ) : null}
            {recommendationKey ? (
                <span
                    className={`inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 font-bold leading-tight text-emerald-700 ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}
                >
                    {t(recommendationKey)}
                </span>
            ) : null}
        </div>
    );
}
