import { useLocale } from '../contexts/LocaleContext.jsx';
import { getDiscoveryLocationIndicatorPresentation } from '../features/discover/locationIndicators.js';

function GlossyAudienceStarIcon({ compact = false }) {
    return (
        <span
            aria-hidden="true"
            className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${compact ? 'h-6 w-6' : 'h-7 w-7'}`}
            style={{
                background: 'radial-gradient(circle at 34% 26%, color-mix(in srgb, var(--color-brand-light) 74%, white) 0%, var(--color-brand) 50%, var(--color-brand-strong) 100%)',
                boxShadow:
                    'inset -4px -5px 0 rgba(12, 138, 130, 0.34), inset 3px 4px 0 rgba(255, 255, 255, 0.24), 0 1px 3px rgba(15, 23, 42, 0.18)',
            }}
        >
            <span className="absolute -left-1 top-0 h-4/5 w-4/5 rounded-full bg-white/20 blur-[1px]" />
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
                    <GlossyAudienceStarIcon compact={compact} />
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
