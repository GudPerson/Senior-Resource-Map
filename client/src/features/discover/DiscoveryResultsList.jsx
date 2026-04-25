import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { AssetCard } from '../../components/AssetCard.jsx';
import { buildSavedAssetKey } from '../../lib/savedAssets.js';
import DiscoveryMobileBrowseCard from './DiscoveryMobileBrowseCard.jsx';

export function DiscoveryResultsList({
    filtered,
    isDesktop = false,
    loading,
    mobileCardDensity = 'comfortable',
    onCardHoverEnd,
    onCardHoverStart,
    onCardLockOnMap,
    onCategoryClick,
    onFocusAssetOnMap,
    onTagClick,
    savedMapAssetKeys = new Set(),
    scrollContainerRef = null,
    selectedAssetKey = null,
    subCatColors,
    pageSize = 20,
    totalCount = 0,
    onLoadMore,
}) {
    const isCompactMobile = !isDesktop && mobileCardDensity === 'compact';
    const canLoadMore = totalCount > filtered.length;
    const autoLoadPendingRef = useRef(false);
    const AUTO_LOAD_THRESHOLD_PX = 240;

    const requestMoreResults = () => {
        if (loading || !canLoadMore || !onLoadMore || autoLoadPendingRef.current) {
            return;
        }
        autoLoadPendingRef.current = true;
        onLoadMore();
    };

    const handleScroll = (event) => {
        const root = event.currentTarget;
        const remainingScroll = root.scrollHeight - root.scrollTop - root.clientHeight;
        if (remainingScroll <= AUTO_LOAD_THRESHOLD_PX) {
            requestMoreResults();
        }
    };

    useEffect(() => {
        autoLoadPendingRef.current = false;
    }, [filtered.length]);

    return (
        <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className={`relative flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-3 lg:p-5 ${isDesktop ? 'pb-20' : 'pb-28'} scroll-smooth hide-scrollbar`}
            style={{ WebkitOverflowScrolling: 'touch' }}
        >
            {loading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, index) => (
                        <div key={index} className="card animate-pulse h-36" style={{ border: '1px solid var(--color-border)' }} />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                    <Search size={40} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
                    <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>No results found</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Try adjusting your filters or search terms.</p>
                </div>
            ) : (
                <div
                    className={
                        isDesktop
                            ? 'grid grid-cols-1 gap-3 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:gap-4'
                            : isCompactMobile
                                ? 'grid grid-cols-2 gap-2'
                                : 'grid grid-cols-1 gap-3 min-[540px]:grid-cols-2'
                    }
                >
                    {filtered.map((resource, index) => (
                        <div
                            id={`asset-card-${resource._type}-${resource.id}`}
                            key={`${resource._type}-${resource.id}`}
                            className="mobile-card-enter"
                            style={{ animationDelay: `${index * 0.04}s` }}
                        >
                            {(() => {
                                const assetKey = buildSavedAssetKey(resource._type, resource.id);
                                const isMapLinked = savedMapAssetKeys.has(assetKey);

                                return isDesktop ? (
                                    <AssetCard
                                        asset={resource}
                                        type={resource._type}
                                        isSelected={selectedAssetKey === assetKey}
                                        onCardClickAction={isMapLinked ? () => onCardLockOnMap?.(resource) : undefined}
                                        onCardHoverStart={isMapLinked ? () => onCardHoverStart?.(resource) : undefined}
                                        onCardHoverEnd={isMapLinked ? onCardHoverEnd : undefined}
                                        onLocationClick={() => onFocusAssetOnMap?.(resource)}
                                        showDetailsButton={false}
                                        subCatColors={subCatColors}
                                        onTagClick={onTagClick}
                                        onCategoryClick={onCategoryClick}
                                    />
                                ) : (
                                    <DiscoveryMobileBrowseCard
                                        asset={resource}
                                        isCompact={isCompactMobile}
                                        onLocationClick={() => onFocusAssetOnMap?.(resource)}
                                        type={resource._type}
                                        onCategoryClick={onCategoryClick}
                                        subCatColors={subCatColors}
                                    />
                                );
                            })()}
                        </div>
                    ))}
                </div>
            )}

            {!loading && totalCount > pageSize ? (
                <div className="mt-6 border-t border-slate-100 pt-6">
                    <div className="flex flex-col items-center gap-3">
                        <p className="text-sm text-slate-500">
                            Showing {filtered.length} of {totalCount} results
                        </p>
                        {canLoadMore ? (
                            <>
                                <p className="text-xs text-slate-400">
                                    More results load automatically as you reach the end.
                                </p>
                            </>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
