function joinClasses(...parts) {
    return parts.filter(Boolean).join(' ');
}

export function DiscoveryModeToggle({
    activeMode = 'browse',
    mapCount = 0,
    mapDisabled = false,
    onChangeMode,
}) {
    const options = [
        { value: 'browse', label: 'Browse' },
        { value: 'map', label: mapCount > 0 ? `Map (${mapCount})` : 'Map' },
    ];

    return (
        <div
            className="grid grid-cols-2 gap-1 rounded-2xl border p-1"
            style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'rgba(255,255,255,0.92)',
            }}
        >
            {options.map((option) => {
                const active = activeMode === option.value;
                const disabled = option.value === 'map' && mapDisabled;

                return (
                    <button
                        key={option.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                            if (!disabled) {
                                onChangeMode?.(option.value);
                            }
                        }}
                        className={joinClasses(
                            'min-h-[42px] rounded-xl px-3 py-2 text-[15px] font-bold leading-none whitespace-nowrap transition-all',
                            disabled ? 'cursor-not-allowed opacity-45' : '',
                            active ? 'shadow-sm' : ''
                        )}
                        style={{
                            background: active
                                ? 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)'
                                : 'transparent',
                            color: active ? '#ffffff' : 'var(--color-text-secondary)',
                        }}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export default DiscoveryModeToggle;
