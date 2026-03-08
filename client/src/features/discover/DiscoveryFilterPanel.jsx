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
        <div
            className="flex-shrink-0 z-10 sticky top-0"
            style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,252,251,0.92) 100%)',
                borderBottom: '1px solid var(--color-border)',
            }}
        >
            <div className="hidden lg:flex items-start justify-between gap-4 p-5 pb-0">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: 'var(--color-brand)' }}>
                        CareAround SG
                    </p>
                    <h1 className="mt-2 text-[2rem] font-extrabold" style={{ color: 'var(--color-text)' }}>Find care around you</h1>
                    <p className="mt-2 max-w-sm text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                        Search nearby support, services, and programmes without leaving the map.
                    </p>
                </div>
                <button
                    onClick={handleLocateMe}
                    className="flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm min-h-[48px] transition-all"
                    style={{
                        backgroundColor: 'var(--color-brand-light)',
                        color: 'var(--color-brand-strong)',
                        border: '1px solid var(--color-border)',
                        boxShadow: '0 12px 28px rgba(15, 163, 154, 0.08)',
                    }}
                >
                    <LocateFixed size={18} />
                    <span>Locate Me</span>
                </button>
            </div>

            <div className="p-3 lg:p-5 space-y-3">
                <div className="lg:hidden px-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--color-brand)' }}>
                        CareAround SG
                    </p>
                    <h1 className="mt-1 text-2xl font-extrabold" style={{ color: 'var(--color-text)' }}>Find care around you</h1>
                    <p className="mt-1 text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                        Browse nearby care, support, and community programmes.
                    </p>
                </div>

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
                            className="w-full pl-9 pr-3 py-2.5 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 min-h-[44px] transition-all"
                            style={{
                                ...INPUT_RING_STYLE,
                                backgroundColor: 'var(--color-input-bg)',
                                color: 'var(--color-text)',
                                border: '1.5px solid var(--color-border)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
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
                        className="px-4 py-2 rounded-2xl text-white font-bold text-sm min-h-[44px] flex items-center gap-1.5 flex-shrink-0 transition-all hover:shadow-md"
                        style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)' }}
                    >
                        <Search size={15} />
                        Search
                    </button>
                    <button
                        type="button"
                        onClick={handleLocateMe}
                        className="lg:hidden px-3 py-2 rounded-2xl font-bold text-sm min-h-[44px] flex items-center flex-shrink-0 transition-all"
                        style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-strong)', border: '1px solid var(--color-border)' }}
                    >
                        <LocateFixed size={16} />
                    </button>
                </form>

                <div className="flex gap-2">
                    <select
                        value={searchRadius}
                        onChange={(event) => setSearchRadius(parseFloat(event.target.value))}
                        className="px-3 py-2.5 rounded-2xl font-bold focus:outline-none appearance-none cursor-pointer text-xs min-h-[40px] flex-shrink-0"
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
                            className="w-full pl-9 pr-3 py-2.5 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 min-h-[40px] transition-all"
                            style={{
                                ...INPUT_RING_STYLE,
                                backgroundColor: 'var(--color-input-bg)',
                                color: 'var(--color-text)',
                                border: '1.5px solid var(--color-border)',
                            }}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-[20px] p-1" style={{ backgroundColor: 'var(--color-badge-bg)', border: '1px solid var(--color-border)' }}>
                    {['all', 'hard', 'soft'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className="flex-1 py-2 rounded-2xl text-xs font-bold min-h-[38px] whitespace-nowrap transition-all capitalize"
                            style={activeTab === tab
                                ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-brand-strong)', boxShadow: '0 10px 20px rgba(15, 89, 91, 0.08)', border: '1px solid var(--color-border)' }
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
                        style={{ backgroundColor: '#fff1ef', color: '#b84030', border: '1px solid #f7c2b8' }}
                    >
                        {locationNotice.message}
                    </div>
                )}

                {userLocation && (
                    <div className="flex items-center justify-between rounded-2xl border px-3 py-2 text-xs font-bold" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.72)' }}>
                        <span style={{ color: 'var(--color-brand-strong)' }}>
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
