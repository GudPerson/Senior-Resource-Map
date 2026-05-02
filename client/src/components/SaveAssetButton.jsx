import { Heart } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';

const VARIANT_STYLES = {
    card: {
        className: 'p-1.5 -m-1 rounded-full transition-colors flex-shrink-0 hover:bg-slate-100',
        savedStyle: { backgroundColor: '#fff1ef' },
        unsavedStyle: { backgroundColor: 'transparent' },
    },
    inspector: {
        className: 'inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-slate-50',
        savedStyle: { borderColor: 'var(--color-border)', color: '#dc2626' },
        unsavedStyle: { borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' },
    },
    tooltip: {
        className: 'p-1 rounded-full hover:bg-slate-100 transition-colors',
        savedStyle: {},
        unsavedStyle: {},
    },
};

function joinClasses(...parts) {
    return parts.filter(Boolean).join(' ');
}

export function SaveAssetButton({
    resourceId,
    resourceType,
    summary = null,
    variant = 'card',
    iconSize = 18,
    className = '',
    style = {},
    onClick,
}) {
    const { isAuth } = useAuth();
    const { isSaved, isSavedAssetPending, toggleSavedAsset } = useSavedAssets();

    if (!isAuth) return null;

    const resolvedVariant = VARIANT_STYLES[variant] || VARIANT_STYLES.card;
    const saved = isSaved(resourceType, resourceId);
    const pending = isSavedAssetPending(resourceType, resourceId);

    async function handleClick(event) {
        event.stopPropagation();
        onClick?.(event);
        if (event.defaultPrevented || pending) {
            return;
        }

        try {
            await toggleSavedAsset(resourceType, resourceId, summary);
        } catch (err) {
            console.error(err);
        }
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            className={joinClasses(
                resolvedVariant.className,
                pending ? 'cursor-wait opacity-70' : '',
                className
            )}
            style={{
                ...(saved ? resolvedVariant.savedStyle : resolvedVariant.unsavedStyle),
                ...style,
            }}
            aria-label={saved ? 'Remove from My Directory' : 'Save to My Directory'}
            title={saved ? 'Remove from My Directory' : 'Save to My Directory'}
            aria-pressed={saved}
            disabled={pending}
            data-testid={`save-asset-${resourceType}-${resourceId}`}
        >
            <Heart
                size={iconSize}
                className={saved ? 'fill-red-500 text-red-500' : 'text-slate-400'}
                style={!saved ? { color: 'var(--color-text-muted)' } : undefined}
            />
        </button>
    );
}

export default SaveAssetButton;
