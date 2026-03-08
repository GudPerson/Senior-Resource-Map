import { LocateFixed, MapPin, Search } from 'lucide-react';
import { getSearchLocationLabel } from '../../lib/searchLocation.js';

const INPUT_RING_STYLE = { '--tw-ring-color': 'var(--color-brand)' };

export function DiscoveryFilterPanel({
    activeTab,
    clearLocationSearch,
    handleLocateMe,
    handlePostalSearch,
    isGeocoding,
    locationNotice,
    onSearchChange,
    postalInput,
    search,
    searchOrigin,
    searchRadius,
    setActiveTab,
    setPostalInput,
    setSearchRadius,
    setShowFavoritesOnly,
    showFavoritesOnly,
    user,
    userLocation,
}) {
    return (
        <div className="flex-shrink-0 z-10 sticky top-0" style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
            <div className="hidden lg:flex items-center justify-between p-4 pb-0">
                <h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-text)' }}>Discover Resources</h1>
                <button
                    onClick={handleLocateMe}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-sm min-h-[44px] transition-all"
                    style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)', border: '1px solid var(--color-border)' }}
                >
                    <LocateFixed size={18} />
                    <span>Locate Me</span>
                </button>
            </div>

            <div className="p-3 lg:p-4 space-y-2">
                <form onSubmit={handlePostalSearch} className="flex gap-2">
                    <div className="relative flex-1">
                        <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
                        <input
                            id="postal-input"
                            type="text"
                            inputMode="numeric"
                            pattern="\d*"
                            maxLength={6}
                            placeholder="6-digit Postal Code"
                            value={postalInput}
                            onChange={(event) => setPostalInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 min-h-[40px] transition-all"
                            style={{
                                ...INPUT_RING_STYLE,
                                backgroundColor: 'var(--color-input-bg)',
                                color: 'var(--color-text)',
                                border: '1.5px solid var(--color-border)',
                            }}
                        />
                        {isGeocoding && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-brand)' }} />
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="px-3 py-2 rounded-xl text-white font-bold text-sm min-h-[40px] flex items-center gap-1.5 flex-shrink-0 transition-all hover:shadow-md"
                        style={{ backgroundColor: 'var(--color-brand)' }}
                    >
                        <Search size={15} />
                        Search
                    </button>
                    <button
                        type="button"
                        onClick={handleLocateMe}
                        className="lg:hidden px-3 py-2 rounded-xl font-bold text-sm min-h-[40px] flex items-center flex-shrink-0 transition-all"
                        style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)', border: '1px solid var(--color-border)' }}
                    >
                        <LocateFixed size={16} />
                    </button>
                </form>

                <div className="flex gap-2">
                    <select
                        value={searchRadius}
                        onChange={(event) => setSearchRadius(parseFloat(event.target.value))}
                        className="px-2 py-2 rounded-xl font-bold focus:outline-none appearance-none cursor-pointer text-xs min-h-[36px] flex-shrink-0"
                        style={{ backgroundColor: 'var(--color-input-bg)', color: 'var(--color-text)', border: '1.5px solid var(--color-border)' }}
                    >
                        <option value={0.3}>300m</option>
                        <option value={0.5}>500m</option>
                        <option value={1}>1km</option>
                        <option value={2}>2km</option>
                        <option value={100}>All SG</option>
                    </select>
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
                        <input
                            type="search"
                            placeholder="Search names, tags..."
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 min-h-[36px] transition-all"
                            style={{
                                ...INPUT_RING_STYLE,
                                backgroundColor: 'var(--color-input-bg)',
                                color: 'var(--color-text)',
                                border: '1.5px solid var(--color-border)',
                            }}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1.5 p-0.5 rounded-xl" style={{ backgroundColor: 'var(--color-badge-bg)' }}>
                    {['all', 'hard', 'soft'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className="flex-1 py-1.5 rounded-lg text-xs font-bold min-h-[32px] whitespace-nowrap transition-all capitalize"
                            style={activeTab === tab
                                ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-brand)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--color-border)' }
                                : { color: 'var(--color-text-secondary)' }}
                        >
                            {tab === 'all' ? 'All' : tab === 'hard' ? 'Places' : 'Offerings'}
                        </button>
                    ))}
                </div>

                {user && (
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none" style={{ color: 'var(--color-text-secondary)' }}>
                            <div className="relative inline-block w-9 mr-1 align-middle transition duration-200 ease-in">
                                <input
                                    type="checkbox"
                                    checked={showFavoritesOnly}
                                    onChange={(event) => setShowFavoritesOnly(event.target.checked)}
                                    className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                    style={{ right: showFavoritesOnly ? 0 : '1.125rem', borderColor: showFavoritesOnly ? '#10b981' : '#cbd5e1' }}
                                />
                                <div className="toggle-label block overflow-hidden h-4 rounded-full cursor-pointer" style={{ backgroundColor: showFavoritesOnly ? '#10b981' : 'var(--color-border)' }}></div>
                            </div>
                            Favorites Only
                        </label>
                    </div>
                )}

                {locationNotice && (
                    <div
                        className="rounded-xl px-3 py-2 text-xs font-medium"
                        style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
                    >
                        {locationNotice.message}
                    </div>
                )}

                {userLocation && (
                    <div className="flex items-center justify-between text-xs font-bold px-1">
                        <span style={{ color: 'var(--color-brand)' }}>
                            Using {getSearchLocationLabel(searchOrigin)}
                            {searchRadius < 100 ? ` • Within ${searchRadius < 1 ? `${searchRadius * 1000}m` : `${searchRadius}km`}` : ''}
                        </span>
                        <button onClick={clearLocationSearch} className="underline" style={{ color: 'var(--color-text-muted)' }}>Clear</button>
                    </div>
                )}
            </div>
        </div>
    );
}
