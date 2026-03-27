import { useState } from 'react';
import { ChevronDown, Columns2, LocateFixed, MapPin, Rows3, Search, SlidersHorizontal, Menu } from 'lucide-react';
import { Drawer } from 'vaul';

import DiscoveryModeToggle from './DiscoveryModeToggle.jsx';
import { getSearchLocationLabel } from '../../lib/searchLocation.js';

const INPUT_RING_STYLE = { '--tw-ring-color': 'var(--color-brand)' };

function buildSummaryChips({ activeTab, search, searchOrigin, searchRadius, showFavoritesOnly, user, userLocation }) {
    const summaryChips = [];

    if (search.trim()) {
        summaryChips.push({
            key: 'query',
            label: `“${search.trim()}”`,
        });
    }

    if (activeTab !== 'all') {
        summaryChips.push({
            key: 'tab',
            label: activeTab === 'hard' ? 'Places only' : 'Offerings only',
        });
    }

    if (showFavoritesOnly && user) {
        summaryChips.push({
            key: 'favorites',
            label: 'Saved only',
        });
    }

    if (searchRadius < 100) {
        summaryChips.push({
            key: 'radius',
            label: `Within ${searchRadius < 1 ? `${searchRadius * 1000}m` : `${searchRadius}km`}`,
        });
    }

    return summaryChips;
}

function MobileFilterSheet({
    activeTab,
    clearLocationSearch,
    handleLocateMe,
    handlePostalSearch,
    isGeocoding,
    isOpen,
    locationNotice,
    onOpenChange,
    postalInput,
    searchRadius,
    setActiveTab,
    setPostalInput,
    setSearchRadius,
    setShowFavoritesOnly,
    showFavoritesOnly,
    user,
    userLocation,
    searchOrigin,
}) {
    return (
        <Drawer.Root open={isOpen} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[550] bg-slate-950/35" />
                <Drawer.Content
                    className="fixed bottom-0 left-0 right-0 z-[560] rounded-t-[28px] border-t px-4 pb-6 pt-3"
                    style={{
                        backgroundColor: 'var(--color-drawer-bg)',
                        borderColor: 'var(--color-border)',
                        boxShadow: '0 -18px 42px rgba(15, 89, 91, 0.18)',
                        backdropFilter: 'blur(18px)',
                    }}
                >
                    <Drawer.Title className="sr-only">Refine your browse view</Drawer.Title>
                    <Drawer.Description className="sr-only">
                        Filter discover results by postal code, distance, asset type, and saved assets.
                    </Drawer.Description>
                    <div className="mx-auto h-1.5 w-12 rounded-full" style={{ backgroundColor: 'var(--color-border-strong)' }} />
                    <div className="mt-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-brand)' }}>
                                Filters
                            </p>
                            <h2 className="mt-1 text-[20px] font-extrabold leading-tight" style={{ color: 'var(--color-text)' }}>
                                Refine your browse view
                            </h2>
                        </div>
                        <button type="button" onClick={() => onOpenChange(false)} className="btn-ghost px-3 py-2 text-[13px] leading-none whitespace-nowrap">
                            Done
                        </button>
                    </div>

                    <div className="mt-5 space-y-4">
                        <form onSubmit={handlePostalSearch} className="space-y-2">
                            <label htmlFor="mobile-postal-input" className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                                Search by postal code
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                    <input
                                        id="mobile-postal-input"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d*"
                                        maxLength={6}
                                        placeholder="6-digit postal code"
                                        value={postalInput}
                                        onChange={(event) => setPostalInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="w-full rounded-2xl border py-3 pl-10 pr-3 text-[15px] font-medium leading-none focus:outline-none focus:ring-2"
                                        style={{
                                            ...INPUT_RING_STYLE,
                                            backgroundColor: 'var(--color-input-bg)',
                                            color: 'var(--color-text)',
                                            borderColor: 'var(--color-border)',
                                        }}
                                    />
                                    {isGeocoding ? (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-brand)' }} />
                                        </div>
                                    ) : null}
                                </div>
                                <button type="submit" className="btn-primary justify-center px-4 py-3 text-[15px] leading-none whitespace-nowrap">
                                    Search
                                </button>
                            </div>
                        </form>

                        <div className="grid grid-cols-2 gap-3">
                            <label className="space-y-2">
                                <span className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                                    Distance
                                </span>
                                <select
                                    value={searchRadius}
                                    onChange={(event) => setSearchRadius(parseFloat(event.target.value))}
                                    className="w-full rounded-2xl border bg-white px-3 py-3 text-[15px] font-semibold leading-none outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                                >
                                    <option value={0.3}>300m</option>
                                    <option value={0.5}>500m</option>
                                    <option value={1}>1km</option>
                                    <option value={2}>2km</option>
                                    <option value={100}>All SG</option>
                                </select>
                            </label>

                            <label className="space-y-2">
                                <span className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                                    Asset type
                                </span>
                                <select
                                    value={activeTab}
                                    onChange={(event) => setActiveTab(event.target.value)}
                                    className="w-full rounded-2xl border bg-white px-3 py-3 text-[15px] font-semibold leading-none outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                                >
                                    <option value="all">All</option>
                                    <option value="hard">Places</option>
                                    <option value="soft">Offerings</option>
                                </select>
                            </label>
                        </div>

                        <div className="flex items-center justify-between rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.82)' }}>
                            <div>
                                <p className="text-[15px] font-bold leading-tight" style={{ color: 'var(--color-text)' }}>Use current location</p>
                                <p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                    Sort nearby places around your current or searched location.
                                </p>
                            </div>
                            <button type="button" onClick={handleLocateMe} className="btn-ghost px-3 py-2 text-[13px] leading-none whitespace-nowrap">
                                <LocateFixed size={14} />
                                Locate me
                            </button>
                        </div>

                        {user ? (
                            <label className="flex items-center justify-between gap-4 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.82)' }}>
                                <div>
                                    <p className="text-[15px] font-bold leading-tight" style={{ color: 'var(--color-text)' }}>Saved Assets Only</p>
                                    <p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                        Narrow the browse list to items you have already saved.
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={showFavoritesOnly}
                                    onChange={(event) => setShowFavoritesOnly(event.target.checked)}
                                    className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                />
                            </label>
                        ) : null}

                        {locationNotice ? (
                            <div className="rounded-xl border px-3 py-2 text-[14px] font-medium leading-5" style={{ backgroundColor: '#fff1ef', color: '#b84030', borderColor: '#f7c2b8' }}>
                                {locationNotice.message}
                            </div>
                        ) : null}

                        {userLocation ? (
                            <div className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-[14px] font-medium" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.82)' }}>
                                <div className="min-w-0">
                                    <p className="truncate" style={{ color: 'var(--color-brand-strong)' }}>
                                        Using {getSearchLocationLabel(searchOrigin)}
                                    </p>
                                    {searchRadius < 100 ? (
                                        <p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                            Within {searchRadius < 1 ? `${searchRadius * 1000}m` : `${searchRadius}km`}
                                        </p>
                                    ) : null}
                                </div>
                                <button type="button" onClick={clearLocationSearch} className="shrink-0 text-[12px] font-bold underline leading-none whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                                    Clear
                                </button>
                            </div>
                        ) : null}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

function DesktopFilterPanel({
    activeTab,
    clearLocationSearch,
    handleLocateMe,
    handlePostalSearch,
    isGeocoding,
    isCollapsed,
    locationNotice,
    onApplySearch,
    onCollapse,
    onExpand,
    onSearchChange,
    postalInput,
    resultCount,
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
    const summaryChips = buildSummaryChips({ activeTab, search, searchOrigin, searchRadius, showFavoritesOnly, user, userLocation });

    if (isCollapsed) {
        return (
            <div
                className="hidden flex-shrink-0 lg:block"
                style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,252,251,0.92) 100%)',
                    borderBottom: '1px solid var(--color-border)',
                }}
            >
                <div className="p-4">
                    <div
                        className="rounded-[24px] border px-4 py-3"
                        style={{
                            borderColor: 'var(--color-border)',
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(231,248,244,0.94) 100%)',
                            boxShadow: '0 14px 30px rgba(15, 89, 91, 0.08)',
                        }}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--color-brand)' }}>
                                    Search Summary
                                </p>
                                <p className="mt-1 text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                                    Showing {resultCount} {resultCount === 1 ? 'resource' : 'resources'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onExpand}
                                className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold whitespace-nowrap transition-all"
                                style={{
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-brand-strong)',
                                    backgroundColor: 'var(--color-surface)',
                                }}
                            >
                                <SlidersHorizontal size={14} />
                                Edit search
                            </button>
                        </div>

                        {summaryChips.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {summaryChips.map((chip) => (
                                    <span
                                        key={chip.key}
                                        className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold"
                                        style={{
                                            backgroundColor: 'var(--color-surface)',
                                            color: 'var(--color-text-secondary)',
                                            border: '1px solid var(--color-border)',
                                        }}
                                    >
                                        {chip.label}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="hidden flex-shrink-0 lg:block"
            style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,252,251,0.96) 100%)',
                borderBottom: '1px solid var(--color-border)',
            }}
        >
            <div className="relative p-6 pb-2">
                <div className="flex items-start justify-between">
                    <div className="min-w-0 pr-12">
                        <p className="text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: 'var(--color-brand)' }}>
                            CareAround SG
                        </p>
                        <h1 className="mt-2 text-[1.85rem] font-black leading-tight tracking-tight" style={{ color: 'var(--color-text)' }}>
                            Find care around you
                        </h1>
                        <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                            Search nearby support, services, and programmes.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCollapse}
                        className="absolute right-5 top-7 flex h-10 w-10 items-center justify-center rounded-2xl transition-all hover:bg-white hover:shadow-md"
                        style={{
                            color: 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'rgba(255,255,255,0.6)',
                        }}
                        title="Collapse panel"
                    >
                        <ChevronDown size={18} />
                    </button>
                </div>
            </div>

            <div className="space-y-4 p-6 pt-2">
                <form onSubmit={onApplySearch} className="flex flex-col gap-3">
                    <div className="flex gap-2">
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
                                className="w-full rounded-2xl py-2.5 pl-9 pr-12 text-sm font-semibold focus:outline-none focus:ring-2 min-h-[46px] transition-all"
                                style={{
                                    ...INPUT_RING_STYLE,
                                    backgroundColor: 'var(--color-input-bg)',
                                    color: 'var(--color-text)',
                                    border: '1.5px solid var(--color-border)',
                                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleLocateMe}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:bg-white"
                                style={{ color: 'var(--color-brand-strong)' }}
                                title="Use my current location"
                            >
                                <LocateFixed size={18} />
                            </button>
                            {isGeocoding ? (
                                <div className="absolute right-12 top-1/2 -translate-y-1/2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-brand)' }} />
                                </div>
                            ) : null}
                        </div>
                        <div className="relative shrink-0">
                            <select
                                value={searchRadius}
                                onChange={(event) => setSearchRadius(parseFloat(event.target.value))}
                                className="min-h-[46px] cursor-pointer appearance-none rounded-2xl pl-3 pr-8 py-2.5 text-xs font-bold focus:outline-none transition-all"
                                style={{ backgroundColor: 'var(--color-input-bg)', color: 'var(--color-text)', border: '1.5px solid var(--color-border)' }}
                            >
                                <option value={0.3}>300m</option>
                                <option value={0.5}>500m</option>
                                <option value={1}>1km</option>
                                <option value={2}>2km</option>
                                <option value={100}>All SG</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                        </div>
                        <button
                            type="submit"
                            className="flex min-h-[46px] flex-shrink-0 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-extrabold text-white transition-all hover:shadow-lg active:scale-95"
                            style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)' }}
                        >
                            <Search size={16} />
                            Search
                        </button>
                    </div>

                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
                        <input
                            type="search"
                            placeholder="Search names, services, or tags..."
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            className="w-full rounded-2xl py-2.5 pl-9 pr-3 text-sm font-semibold focus:outline-none focus:ring-2 min-h-[46px] transition-all"
                            style={{
                                ...INPUT_RING_STYLE,
                                backgroundColor: 'var(--color-input-bg)',
                                color: 'var(--color-text)',
                                border: '1.5px solid var(--color-border)',
                            }}
                        />
                    </div>
                </form>

                <div className="flex items-center gap-4">
                    <div className="flex flex-1 items-center gap-1 rounded-2xl p-1" style={{ backgroundColor: 'var(--color-badge-bg)', border: '1px solid var(--color-border)' }}>
                        {['all', 'hard', 'soft'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className="min-h-[36px] flex-1 rounded-[14px] py-1.5 text-xs font-extrabold whitespace-nowrap capitalize transition-all"
                                style={activeTab === tab
                                    ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-brand-strong)', boxShadow: '0 4px 12px rgba(15, 89, 91, 0.08)', border: '1px solid var(--color-border)' }
                                    : { color: 'var(--color-text-secondary)' }}
                            >
                                {tab === 'all' ? 'All' : tab === 'hard' ? 'Places' : 'Offerings'}
                            </button>
                        ))}
                    </div>

                    {user ? (
                        <label className="flex shrink-0 cursor-pointer select-none items-center gap-3 rounded-2xl border px-3 py-2 transition-all hover:bg-white" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="relative inline-block w-8 align-middle transition duration-200 ease-in">
                                <input
                                    type="checkbox"
                                    checked={showFavoritesOnly}
                                    onChange={(event) => setShowFavoritesOnly(event.target.checked)}
                                    className="toggle-checkbox absolute block h-4 w-4 appearance-none rounded-full border-2 bg-white cursor-pointer"
                                    style={{ right: showFavoritesOnly ? 0 : '1rem', borderColor: showFavoritesOnly ? '#10b981' : '#cbd5e1' }}
                                />
                                <div className="toggle-label block h-4 cursor-pointer overflow-hidden rounded-full" style={{ backgroundColor: showFavoritesOnly ? '#10b981' : 'var(--color-border)' }} />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                                Saved Only
                            </span>
                        </label>
                    ) : null}
                </div>

                {locationNotice ? (
                    <div
                        className="rounded-xl px-4 py-2.5 text-xs font-bold leading-relaxed border animate-in fade-in slide-in-from-top-1"
                        style={{ backgroundColor: '#fff1ef', color: '#b84030', borderColor: '#f7c2b8' }}
                    >
                        {locationNotice.message}
                    </div>
                ) : null}

                {userLocation ? (
                    <div className="flex items-center justify-between rounded-2xl border px-4 py-2.5 text-xs font-extrabold transition-all" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.72)' }}>
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span style={{ color: 'var(--color-brand-strong)' }}>
                                Using {getSearchLocationLabel(searchOrigin)}
                                {searchRadius < 100 ? ` • Within ${searchRadius < 1 ? `${searchRadius * 1000}m` : `${searchRadius}km`}` : ''}
                            </span>
                        </div>
                        <button onClick={clearLocationSearch} className="font-black underline decoration-2 underline-offset-2 transition-colors hover:text-red-500" style={{ color: 'var(--color-text-muted)' }}>
                            Clear
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export function DiscoveryFilterPanel(props) {
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const {
        activeTab,
        clearLocationSearch,
        handleLocateMe,
        handlePostalSearch,
        isGeocoding,
        isCollapsed,
        locationNotice,
        mobileMode = 'browse',
        mobileCardDensity = 'comfortable',
        onApplySearch,
        onChangeMode,
        onChangeMobileCardDensity,
        onCollapse,
        onExpand,
        onOpenMobileBrowseDrawer,
        onSearchChange,
        pinCount = 0,
        postalInput,
        resultCount,
        savedAssetCount = 0,
        search,
        searchOrigin,
        searchRadius,
        setActiveTab,
        setPostalInput,
        setSearchRadius,
        setShowFavoritesOnly,
        showFavoritesOnly,
        unmappableSavedCount = 0,
        user,
        userLocation,
    } = props;

    const summaryChips = buildSummaryChips({ activeTab, search, searchOrigin, searchRadius, showFavoritesOnly, user, userLocation });
    const mapDisabled = pinCount === 0;

    return (
        <>
            <DesktopFilterPanel {...props} />

            <div
                className="sticky top-0 z-20 border-b lg:hidden"
                style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(246,252,251,0.94) 100%)',
                    borderColor: 'var(--color-border)',
                    backdropFilter: 'blur(16px)',
                }}
            >
                <div className="space-y-3 px-3 py-3">
                    <DiscoveryModeToggle
                        activeMode={mobileMode}
                        mapCount={pinCount}
                        mapDisabled={mapDisabled}
                        onChangeMode={onChangeMode}
                    />

                    {mobileMode === 'browse' ? (
                        <>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                    <input
                                        type="search"
                                        placeholder="Search names, tags..."
                                        value={search}
                                        onChange={(event) => onSearchChange(event.target.value)}
                                        className="w-full rounded-2xl border py-3 pl-10 pr-3 text-[15px] font-medium leading-none focus:outline-none focus:ring-2"
                                        style={{
                                            ...INPUT_RING_STYLE,
                                            backgroundColor: 'var(--color-input-bg)',
                                            color: 'var(--color-text)',
                                            borderColor: 'var(--color-border)',
                                        }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setMobileFiltersOpen(true)}
                                    className="btn-ghost min-h-[46px] justify-center px-3 text-[15px] leading-none whitespace-nowrap"
                                >
                                    <SlidersHorizontal size={16} />
                                    Filters
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
                                    {['all', 'hard', 'soft'].map((tab) => (
                                        <button
                                            key={tab}
                                            type="button"
                                            onClick={() => setActiveTab(tab)}
                                            className="min-h-[38px] shrink-0 rounded-full px-3 py-2 text-[14px] font-bold leading-none whitespace-nowrap transition-all"
                                            style={activeTab === tab
                                                ? {
                                                    backgroundColor: 'var(--color-brand-light)',
                                                    color: 'var(--color-brand-strong)',
                                                    border: '1px solid var(--color-border)',
                                                }
                                                : {
                                                    backgroundColor: 'rgba(255,255,255,0.92)',
                                                    color: 'var(--color-text-secondary)',
                                                    border: '1px solid var(--color-border)',
                                                }}
                                        >
                                            {tab === 'all' ? 'All' : tab === 'hard' ? 'Places' : 'Offerings'}
                                        </button>
                                    ))}
                                </div>
                                <div
                                    className="inline-flex shrink-0 items-center gap-1 rounded-2xl border p-1"
                                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.92)' }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onChangeMobileCardDensity?.('comfortable')}
                                        aria-label="Show one asset per row"
                                        className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl transition-all"
                                        style={mobileCardDensity === 'comfortable'
                                            ? {
                                                backgroundColor: 'var(--color-brand-light)',
                                                color: 'var(--color-brand-strong)',
                                                border: '1px solid var(--color-border)',
                                            }
                                            : { color: 'var(--color-text-secondary)' }}
                                    >
                                        <Rows3 size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onChangeMobileCardDensity?.('compact')}
                                        aria-label="Show two assets per row"
                                        className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl transition-all"
                                        style={mobileCardDensity === 'compact'
                                            ? {
                                                backgroundColor: 'var(--color-brand-light)',
                                                color: 'var(--color-brand-strong)',
                                                border: '1px solid var(--color-border)',
                                            }
                                            : { color: 'var(--color-text-secondary)' }}
                                    >
                                        <Columns2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {summaryChips.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {summaryChips.map((chip) => (
                                        <span
                                            key={chip.key}
                                            className="inline-flex max-w-full items-center rounded-full px-3 py-1 text-[11px] font-semibold leading-none"
                                            style={{
                                                backgroundColor: 'rgba(255,255,255,0.92)',
                                                color: 'var(--color-text-secondary)',
                                                border: '1px solid var(--color-border)',
                                            }}
                                        >
                                            <span className="max-w-full truncate">{chip.label}</span>
                                        </span>
                                    ))}
                                </div>
                            ) : null}

                            <div className="text-[13px] font-semibold leading-none" style={{ color: 'var(--color-text-secondary)' }}>
                                Showing {resultCount} {resultCount === 1 ? 'resource' : 'resources'}
                            </div>

                            {savedAssetCount > 0 && mapDisabled ? (
                                <div className="rounded-2xl border px-3 py-2 text-[12px] font-medium leading-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.88)', color: 'var(--color-text-secondary)' }}>
                                    Your saved assets are list-only right now, so the map will unlock after you save a place or offering with a valid location.
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div
                            className="rounded-[22px] border px-4 py-3"
                            style={{
                                borderColor: 'var(--color-border)',
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(231,248,244,0.94) 100%)',
                            }}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-brand)' }}>
                                        Saved map
                                    </p>
                                    <p className="mt-1 text-[16px] font-extrabold leading-tight" style={{ color: 'var(--color-text)' }}>
                                        Showing {pinCount} saved {pinCount === 1 ? 'place' : 'places'}
                                    </p>
                                    <p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                        Only places represented by your saved assets appear on this map.
                                    </p>
                                </div>
                                {onOpenMobileBrowseDrawer ? (
                                    <button
                                        type="button"
                                        onClick={onOpenMobileBrowseDrawer}
                                        className="btn-ghost shrink-0 px-3 py-2 text-[13px] leading-none whitespace-nowrap"
                                        aria-label="Open browse results drawer"
                                    >
                                        <Menu size={15} />
                                        Browse
                                    </button>
                                ) : null}
                            </div>
                            {savedAssetCount > 0 && unmappableSavedCount > 0 ? (
                                <p className="mt-2 text-[12px] font-medium leading-5" style={{ color: 'var(--color-text-muted)' }}>
                                    {unmappableSavedCount} saved {unmappableSavedCount === 1 ? 'asset is' : 'assets are'} list-only right now and not shown on the map.
                                </p>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>

            <MobileFilterSheet
                activeTab={activeTab}
                clearLocationSearch={clearLocationSearch}
                handleLocateMe={handleLocateMe}
                handlePostalSearch={(event) => {
                    handlePostalSearch(event);
                }}
                isGeocoding={isGeocoding}
                isOpen={mobileFiltersOpen}
                locationNotice={locationNotice}
                onOpenChange={setMobileFiltersOpen}
                postalInput={postalInput}
                searchOrigin={searchOrigin}
                searchRadius={searchRadius}
                setActiveTab={setActiveTab}
                setPostalInput={setPostalInput}
                setSearchRadius={setSearchRadius}
                setShowFavoritesOnly={setShowFavoritesOnly}
                showFavoritesOnly={showFavoritesOnly}
                user={user}
                userLocation={userLocation}
            />
        </>
    );
}

export default DiscoveryFilterPanel;
