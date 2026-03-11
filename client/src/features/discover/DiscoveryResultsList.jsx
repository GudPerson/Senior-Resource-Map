import { Search } from 'lucide-react';
import { AssetCard } from '../../components/AssetCard.jsx';

export function DiscoveryResultsList({
    favorites,
    filtered,
    isSearchPanelCollapsed,
    loading,
    onCategoryClick,
    onSelectAsset,
    onTagClick,
    onToggleFavorite,
    selectedAsset,
    subCatColors,
    user,
}) {
    return (
        <div className="flex-1 overflow-y-auto p-3 lg:p-5 pb-20 scroll-smooth relative hide-scrollbar">
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
                <>
                    {!isSearchPanelCollapsed && (
                        <div
                            className="mb-4 rounded-[24px] border px-4 py-3"
                            style={{
                                borderColor: 'var(--color-border)',
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(231,248,244,0.9) 100%)',
                            }}
                        >
                            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-brand)' }}>
                                Discovery Feed
                            </p>
                            <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                                Showing {filtered.length} {filtered.length === 1 ? 'resource' : 'resources'}
                            </p>
                        </div>
                    )}
                    <div className="space-y-3 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:gap-4 lg:space-y-0">
                        {filtered.map((resource, index) => (
                            <div
                                id={`asset-card-${resource._type}-${resource.id}`}
                                key={`${resource._type}-${resource.id}`}
                                className="mobile-card-enter"
                                style={{ animationDelay: `${index * 0.04}s` }}
                            >
                                <AssetCard
                                    asset={resource}
                                    type={resource._type}
                                    isSelected={selectedAsset?.id === resource.id && selectedAsset?._type === resource._type}
                                    onClick={() => onSelectAsset(resource)}
                                    subCatColors={subCatColors}
                                    isFavorite={favorites.some((favorite) => favorite.resourceId === resource.id && favorite.resourceType === resource._type)}
                                    onToggleFavorite={onToggleFavorite}
                                    isLoggedIn={!!user}
                                    onTagClick={onTagClick}
                                    onCategoryClick={onCategoryClick}
                                />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
