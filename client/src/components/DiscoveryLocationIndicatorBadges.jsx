import { useLocale } from '../contexts/LocaleContext.jsx';
import { getDiscoveryLocationIndicatorPresentation } from '../features/discover/locationIndicators.js';

function FlatAudienceStarIcon({ compact = false }) {
    return (
        <span
            aria-hidden="true"
            className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${compact ? 'h-6 w-6' : 'h-7 w-7'}`}
            style={{
                backgroundColor: 'var(--color-brand)',
            }}
        >
            <svg
                aria-hidden="true"
                className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
                viewBox="0 0 24 24"
            >
                <path
                    fill="#fff"
                    d="M12 3.35a1 1 0 0 1 .9.56l2.55 5.16 5.69.82a1 1 0 0 1 .55 1.71l-4.12 4.01.97 5.67a1 1 0 0 1-1.45 1.05L12 19.65l-5.09 2.68a1 1 0 0 1-1.45-1.05l.97-5.67-4.12-4.01a1 1 0 0 1 .55-1.71l5.69-.82 2.55-5.16a1 1 0 0 1 .9-.56Z"
                />
            </svg>
        </span>
    );
}

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
                    className="inline-flex shrink-0 items-center justify-center"
                >
                    <FlatAudienceStarIcon compact={compact} />
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
