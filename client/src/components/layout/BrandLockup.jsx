import careAroundMark from '../../assets/carearound-mark.png';

export default function BrandLockup({
    className = '',
    compact = false,
    showTagline = false,
    textClassName = '',
}) {
    const iconSize = compact ? 'h-10 sm:h-11' : 'h-14';

    return (
        <div className={`brand-lockup flex items-center gap-3 ${className}`}>
            <img
                src={careAroundMark}
                alt="CareAround SG"
                className={`brand-lockup-mark ${iconSize} w-auto object-contain shrink-0`}
            />
            <div className={`min-w-0 ${textClassName}`}>
                <div className="brand-lockup-title-row flex items-center gap-2">
                    <div
                        className={`brand-lockup-name truncate text-base font-extrabold sm:text-lg ${compact ? 'hidden sm:block' : ''}`}
                        style={{ color: 'var(--color-brand-strong)', fontFamily: 'var(--font-heading)' }}
                    >
                        CareAround SG
                    </div>
                    <span
                        className="brand-lockup-beta inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700"
                        title="CareAround SG is currently in beta testing"
                        aria-label="CareAround SG is currently in beta testing"
                    >
                        Beta
                    </span>
                </div>
                {showTagline && (
                    <div
                        className={`brand-lockup-tagline mt-0.5 text-xs font-semibold sm:text-sm ${compact ? 'hidden sm:block' : ''}`}
                        style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}
                    >
                        Care, closer to home.
                    </div>
                )}
            </div>
        </div>
    );
}
