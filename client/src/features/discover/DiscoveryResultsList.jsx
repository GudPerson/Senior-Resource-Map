import { Search } from 'lucide-react';
import { AssetCard } from '../../components/AssetCard.jsx';
import { buildSavedAssetKey } from '../../lib/savedAssets.js';
import DiscoveryMobileBrowseCard from './DiscoveryMobileBrowseCard.jsx';

export function DiscoveryResultsList({
    filtered,
    isDesktop = false,
    loading,
    mobileCardDensity = 'comfortable',
    onCategoryClick,
    onFocusAssetOnMap,
    onTagClick,
    savedMapAssetKeys = new Set(),
    selectedAsset,
    subCatColors,
}) {
    const isCompactMobile = !isDesktop && mobileCardDensity === 'compact';

    return (
        <div
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
                            {isDesktop ? (
                                <AssetCard
                                    asset={resource}
                                    type={resource._type}
                                    isSelected={selectedAsset?.id === resource.id && selectedAsset?._type === resource._type}
                                    onLocationClick={savedMapAssetKeys.has(buildSavedAssetKey(resource._type, resource.id))
                                        ? () => onFocusAssetOnMap(resource)
                                        : undefined}
                                    subCatColors={subCatColors}
                                    onTagClick={onTagClick}
                                    onCategoryClick={onCategoryClick}
                                />
                                ) : (
                                    <DiscoveryMobileBrowseCard
                                        asset={resource}
                                        isCompact={isCompactMobile}
                                        type={resource._type}
                                        onCategoryClick={onCategoryClick}
                                        subCatColors={subCatColors}
                                    />
                                )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
