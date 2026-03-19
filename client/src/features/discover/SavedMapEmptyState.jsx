import { Heart, MapPinned } from 'lucide-react';

export function SavedMapEmptyState({
    hasSavedAssets = false,
    isAuthenticated = false,
    onBrowse,
    unmappableCount = 0,
}) {
    const title = !isAuthenticated
        ? 'Sign in to build your saved map'
        : hasSavedAssets
            ? 'No saved places to map yet'
            : 'Save assets to pin them here';

    const description = !isAuthenticated
        ? 'Once you sign in and save useful resources, your personal discovery map will appear here.'
        : hasSavedAssets
            ? unmappableCount > 0
                ? `${unmappableCount} saved ${unmappableCount === 1 ? 'asset has' : 'assets have'} no usable map location right now. Keep browsing and save places with valid coordinates to see them pinned here.`
                : 'Keep browsing and save places or offerings to see them pinned here.'
            : 'Your discovery map only shows places represented by assets you have saved.';

    return (
        <div className="flex h-full items-center justify-center p-4 sm:p-6">
            <div
                className="w-full max-w-md rounded-[28px] border px-6 py-10 text-center shadow-sm"
                style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(239,250,248,0.94) 100%)',
                    borderColor: 'var(--color-border)',
                }}
            >
                <div
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-strong)' }}
                >
                    {hasSavedAssets ? <MapPinned size={28} /> : <Heart size={28} />}
                </div>
                <h2 className="mt-5 text-xl font-extrabold" style={{ color: 'var(--color-text)' }}>
                    {title}
                </h2>
                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--color-text-secondary)' }}>
                    {description}
                </p>
                {onBrowse ? (
                    <button type="button" onClick={onBrowse} className="btn-primary mt-6 inline-flex justify-center">
                        Browse directory
                    </button>
                ) : null}
            </div>
        </div>
    );
}

export default SavedMapEmptyState;
