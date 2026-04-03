export default function MobileActionDock({ actions = [], className = '' }) {
    const visibleActions = actions.filter(Boolean);

    if (!visibleActions.length) {
        return null;
    }

    return (
        <div
            className={`rounded-[26px] border bg-white/96 p-2 shadow-[0_18px_40px_rgba(15,89,91,0.16)] backdrop-blur ${className}`}
            style={{ borderColor: 'var(--color-border)' }}
        >
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${visibleActions.length}, minmax(0, 1fr))` }}>
                {visibleActions.map((action) => {
                    const Icon = action.icon;
                    const active = Boolean(action.active);

                    return (
                        <button
                            key={action.key}
                            type="button"
                            onClick={action.onClick}
                            disabled={action.disabled}
                            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2 text-center transition-all ${
                                action.disabled ? 'cursor-not-allowed opacity-50' : ''
                            }`}
                            style={active
                                ? {
                                    backgroundColor: 'var(--color-brand-light)',
                                    color: 'var(--color-brand-strong)',
                                    border: '1px solid var(--color-border)',
                                }
                                : {
                                    backgroundColor: 'rgba(255,255,255,0.9)',
                                    color: 'var(--color-text-secondary)',
                                    border: '1px solid transparent',
                                }}
                            aria-label={action.label}
                        >
                            {Icon ? <Icon size={18} /> : null}
                            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] leading-none">
                                {action.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
