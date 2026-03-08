import careAroundMark from '../../assets/carearound-mark.svg';

export default function BrandLockup({
    className = '',
    compact = false,
    showTagline = false,
    textClassName = '',
}) {
    const iconSize = compact ? 'h-10 w-10 sm:h-11 sm:w-11' : 'h-14 w-14';

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <img src={careAroundMark} alt="CareAround SG" className={`${iconSize} shrink-0`} />
            <div className={`min-w-0 ${compact ? 'hidden sm:block' : ''} ${textClassName}`}>
                <div
                    className="truncate text-base font-extrabold sm:text-lg"
                    style={{ color: 'var(--color-brand-strong)', fontFamily: 'var(--font-heading)' }}
                >
                    CareAround SG
                </div>
                {showTagline && (
                    <div
                        className="mt-0.5 text-xs font-semibold sm:text-sm"
                        style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}
                    >
                        Care, closer to home.
                    </div>
                )}
            </div>
        </div>
    );
}
