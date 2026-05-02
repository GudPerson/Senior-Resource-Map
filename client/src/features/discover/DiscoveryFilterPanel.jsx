import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Columns2, Heart, House, LocateFixed, Map, MapPin, Rows3, Search, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';

import MobileBottomSheet from '../../components/mobile/MobileBottomSheet.jsx';
import { getSearchLocationLabel } from '../../lib/searchLocation.js';

const INPUT_RING_STYLE = { '--tw-ring-color': 'var(--color-brand)' };
const DISCOVERY_CONTROL_HEIGHT_CLASS = 'min-h-[2.75rem]';
const DISCOVERY_SECONDARY_CONTROL_HEIGHT_CLASS = 'min-h-[2.5rem]';
const DISCOVERY_CONTROL_TEXT_CLASS = 'text-[0.94rem]';
const DISCOVERY_LABEL_TEXT_CLASS = 'text-[0.68rem] font-bold uppercase tracking-[0.18em]';
const DISCOVERY_TAB_TEXT_CLASS = 'text-[0.82rem] font-bold';

function getDesktopLocationControlMode(width, hasHomePostalCode) {
    const compactThreshold = hasHomePostalCode ? 640 : 560;
    const fullThreshold = hasHomePostalCode ? 770 : 680;

    if (width >= fullThreshold) return 'full';
    if (width >= compactThreshold) return 'compact';
    return 'icon';
}

function useAdaptiveLocationControlMode(hasHomePostalCode) {
    const rowRef = useRef(null);
    const [mode, setMode] = useState(() => getDesktopLocationControlMode(999, hasHomePostalCode));

    useEffect(() => {
        const node = rowRef.current;
        if (!node) return undefined;

        const updateMode = (width) => {
            setMode((current) => {
                const next = getDesktopLocationControlMode(width, hasHomePostalCode);
                return current === next ? current : next;
            });
        };

        updateMode(node.getBoundingClientRect().width);

        if (typeof ResizeObserver === 'undefined') {
            return undefined;
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            updateMode(entry.contentRect.width);
        });

        observer.observe(node);
        return () => observer.disconnect();
    }, [hasHomePostalCode]);

    return { mode, rowRef };
}

function LocationActionButton({
    active = false,
    children,
    icon: Icon,
    labelMode = 'full',
    onClick,
    shortLabel = null,
    title,
}) {
    const isIconOnly = labelMode === 'icon';
    const visibleLabel = labelMode === 'compact' && shortLabel ? shortLabel : children;
    const accessibleLabel = typeof children === 'string' ? children : title;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex ${DISCOVERY_CONTROL_HEIGHT_CLASS} items-center justify-center rounded-2xl font-semibold transition-all whitespace-nowrap ${isIconOnly ? 'gap-0 px-3' : `gap-2 px-3 ${DISCOVERY_CONTROL_TEXT_CLASS}`}`}
            style={active
                ? {
                    border: '1.5px solid var(--color-brand)',
                    backgroundColor: 'var(--color-brand-light)',
                    color: 'var(--color-brand-strong)',
                }
                : {
                    border: '1.5px solid var(--color-border)',
                    backgroundColor: 'var(--color-input-bg)',
                    color: 'var(--color-text-secondary)',
                }}
            aria-label={accessibleLabel}
            title={title}
        >
            <Icon size={16} />
            {!isIconOnly ? visibleLabel : null}
        </button>
    );
}

function HomePostalCodeCta({ compact = false }) {
    return (
        <div
            className={`rounded-2xl border ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}
            style={{
                borderColor: 'rgba(15, 118, 110, 0.18)',
                background: 'linear-gradient(135deg, rgba(240,253,250,0.96) 0%, rgba(255,255,255,0.96) 100%)',
            }}
        >
            <div className={`flex ${compact ? 'flex-col gap-2' : 'items-center justify-between gap-3'}`}>
                <div className="min-w-0">
                    <p className={`${compact ? 'text-[13px]' : 'text-sm'} font-bold leading-tight`} style={{ color: 'var(--color-text)' }}>
                        Add your home postal code for nearby suggestions.
                    </p>
                    <p className={`mt-1 ${compact ? 'text-[12px]' : 'text-[13px]'} leading-5`} style={{ color: 'var(--color-text-secondary)' }}>
                        This helps us show programmes, services, and support near your home.
                    </p>
                </div>
                <Link
                    to="/dashboard/profile"
                    className="inline-flex min-h-[40px] items-center justify-center rounded-2xl border px-3 py-2 text-[12px] font-bold whitespace-nowrap transition-all"
                    style={{
                        borderColor: 'var(--color-brand)',
                        color: 'var(--color-brand-strong)',
                        backgroundColor: 'rgba(255,255,255,0.92)',
                    }}
                >
                    Update profile
                </Link>
            </div>
        </div>
    );
}

function buildSummaryChips({
    activeTab,
    activeSubregionLabel,
    distanceOverridden = false,
    search,
    searchOrigin,
    searchRadius,
    showFavoritesOnly,
    user,
    userLocation,
}) {
    const summaryChips = [];
    const hasLocationAnchor = Boolean(searchOrigin || userLocation);

    if (search.trim()) {
        summaryChips.push({
            key: 'query',
            label: `“${search.trim()}”`,
        });
    }

    if (activeTab !== 'all') {
        summaryChips.push({
            key: 'tab',
            label: activeTab === 'hard' ? 'Places only' : 'Programmes & services only',
        });
    }

    if (showFavoritesOnly && user) {
        summaryChips.push({
            key: 'favorites',
            label: 'Saved only',
        });
    }

    if (activeSubregionLabel) {
        summaryChips.push({
            key: 'subregion',
            label: `Service area: ${activeSubregionLabel}`,
        });
    }

    if (hasLocationAnchor && searchRadius < 100 && !distanceOverridden) {
        summaryChips.push({
            key: 'radius',
            label: `Within ${searchRadius < 1 ? `${searchRadius * 1000}m` : `${searchRadius}km`}`,
        });
    }

    return summaryChips;
}

function SaveAllToggleControl({
    checked = false,
    count = 0,
    disabled = false,
    indeterminate = false,
    pending = false,
    pendingLabel = 'Working…',
    onChange,
}) {
    const inputRef = useRef(null);

    useEffect(() => {
        if (!inputRef.current) return;
        inputRef.current.indeterminate = Boolean(indeterminate && !checked);
    }, [checked, indeterminate]);

    const toneStyles = pending
        ? {
            borderColor: 'rgba(15, 118, 110, 0.18)',
            backgroundColor: 'rgba(248, 250, 252, 0.96)',
            color: 'var(--color-brand-strong)',
        }
        : checked
            ? {
                borderColor: 'rgba(15, 118, 110, 0.24)',
                backgroundColor: 'rgba(240, 253, 250, 0.88)',
                color: 'var(--color-brand-strong)',
            }
            : indeterminate
                ? {
                    borderColor: 'rgba(217, 119, 6, 0.22)',
                    backgroundColor: 'rgba(255, 251, 235, 0.92)',
                    color: '#a16207',
                }
                : {
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    color: 'var(--color-text-secondary)',
                };

    return (
        <label
            className={`flex ${DISCOVERY_SECONDARY_CONTROL_HEIGHT_CLASS} select-none items-center gap-2.5 rounded-2xl border px-3 py-2 transition-all ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-white'}`}
            style={toneStyles}
        >
            <input
                ref={inputRef}
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange?.(event.target.checked)}
                className="sr-only"
            />
            <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
                style={{
                    borderColor: checked || indeterminate ? 'currentColor' : 'var(--color-border)',
                    backgroundColor: checked
                        ? 'rgba(15, 118, 110, 0.14)'
                        : indeterminate
                            ? 'rgba(217, 119, 6, 0.12)'
                            : 'rgba(255,255,255,0.92)',
                }}
                aria-hidden="true"
            >
                <Heart size={15} fill={checked || indeterminate ? 'currentColor' : 'none'} />
            </span>
            <span className="min-w-0">
                <span className={`block ${DISCOVERY_LABEL_TEXT_CLASS} leading-none`}>
                    {pending ? pendingLabel : 'Save these results'}
                </span>
                <span className="mt-1 block text-[0.76rem] leading-none opacity-75">
                    {count} {count === 1 ? 'result' : 'results'}
                </span>
            </span>
        </label>
    );
}

function MobileFilterSheet({
    activeTab,
    activeSubregionLabel,
    canShowSaveAll,
    canUseSubregionScope,
    canClearLocationSearch,
    clearLocationSearch,
    discoverySubregionOptions = [],
    distanceOverridden = false,
    favoritesActionNotice,
    handleHomeAnchor,
    handleLocateMe,
    handlePostalSearch,
    hasHomePostalCode,
    isGeocoding,
    isSaveAllChecked,
    isSaveAllIndeterminate,
    isSaveAllPending,
    isOpen,
    locationNotice,
    mobileCardDensity = 'comfortable',
    onChangeMobileCardDensity,
    onOpenChange,
    onToggleSaveAll,
    postalInput,
    saveAllCount = 0,
    saveAllPendingLabel,
    searchRadius,
    selectedDiscoverySubregionId,
    setActiveTab,
    setPostalInput,
    setSelectedDiscoverySubregion,
    setSearchRadius,
    setShowFavoritesOnly,
    showFavoritesOnly,
    tabCounts = { all: 0, hard: 0, soft: 0 },
    user,
    userLocation,
    searchOrigin,
}) {
    return (
        <MobileBottomSheet
            open={isOpen}
            onOpenChange={onOpenChange}
            title="Choose what to show"
            description="Adjust location, distance, resource type, and card size."
            headerActions={(
                <button type="button" onClick={() => onOpenChange(false)} className="btn-ghost px-3 py-2 text-[13px] leading-none whitespace-nowrap">
                    Done
                </button>
            )}
        >
            <div className="space-y-4">
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
                            <div className={`grid gap-2 ${hasHomePostalCode ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {hasHomePostalCode ? (
                                    <LocationActionButton
                                        active={searchOrigin?.source === 'home'}
                                        icon={House}
                                        onClick={() => handleHomeAnchor()}
                                        title="Use home postal code from your profile"
                                    >
                                        Home
                                    </LocationActionButton>
                                ) : null}
                                <LocationActionButton
                                    active={searchOrigin?.source === 'geolocation'}
                                    icon={LocateFixed}
                                    onClick={handleLocateMe}
                                    title="Use my current location"
                                >
                                    Locate me
                                </LocationActionButton>
                            </div>
                        </form>

                        {user && !hasHomePostalCode ? (
                            <HomePostalCodeCta compact />
                        ) : null}

                        {canUseSubregionScope ? (
                            <label className="space-y-2">
                                <span className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                                    Service area
                                </span>
                                <div
                                    className="relative flex items-center gap-2 rounded-2xl border px-3"
                                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.82)' }}
                                >
                                    <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-muted)' }}>
                                        Area
                                    </span>
                                    <select
                                        value={selectedDiscoverySubregionId}
                                        onChange={(event) => setSelectedDiscoverySubregion(event.target.value)}
                                        className="w-full appearance-none bg-transparent py-3 pr-7 text-[15px] font-semibold leading-none outline-none"
                                        style={{ color: 'var(--color-text)' }}
                                    >
                                        {discoverySubregionOptions.map((option) => (
                                            <option key={option.id} value={String(option.id)}>
                                                {option.discoveryLabel}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-50" />
                                </div>
                                {activeSubregionLabel ? (
                                    <p className="text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                        Results are limited to the selected service area: {activeSubregionLabel}.
                                    </p>
                                ) : null}
                            </label>
                        ) : null}

                        <div className="grid grid-cols-2 gap-3">
                            <label className="space-y-2">
                                <span className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                                    Distance
                                </span>
                                <select
                                    value={searchRadius}
                                    onChange={(event) => setSearchRadius(parseFloat(event.target.value))}
                                    disabled={distanceOverridden}
                                    className="w-full rounded-2xl border bg-white px-3 py-3 text-[15px] font-semibold leading-none outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                    style={{
                                        borderColor: 'var(--color-border)',
                                        color: 'var(--color-text)',
                                        opacity: distanceOverridden ? 0.55 : 1,
                                    }}
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
                                    Show
                                </span>
                                <select
                                    value={activeTab}
                                    onChange={(event) => setActiveTab(event.target.value)}
                                    className={`w-full rounded-2xl border bg-white px-3 py-3 ${DISCOVERY_CONTROL_TEXT_CLASS} font-semibold leading-none outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100`}
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                                >
                                    <option value="all">All ({tabCounts.all})</option>
                                    <option value="hard">Places ({tabCounts.hard})</option>
                                    <option value="soft">Programmes & services ({tabCounts.soft})</option>
                                </select>
                            </label>
                        </div>

                        {distanceOverridden ? (
                            <p className="text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                When a service area is selected, it replaces the distance filter.
                            </p>
                        ) : null}

                        {user ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-all hover:bg-white" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.82)' }}>
                                    <span className="min-w-0">
                                        <span className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                                            Saved only
                                        </span>
                                        <span className="mt-1 block text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                            Show only resources you have saved.
                                        </span>
                                    </span>
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
                                </label>

                                {canShowSaveAll ? (
                                    <SaveAllToggleControl
                                        checked={isSaveAllChecked}
                                        count={saveAllCount}
                                        disabled={saveAllCount === 0 || isSaveAllPending}
                                        indeterminate={isSaveAllIndeterminate}
                                        pending={isSaveAllPending}
                                        pendingLabel={saveAllPendingLabel}
                                        onChange={onToggleSaveAll}
                                    />
                                ) : null}
                            </div>
                        ) : null}

                        {onChangeMobileCardDensity ? (
                            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.82)' }}>
                                <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                                    Card layout
                                </p>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'comfortable', label: 'One per row', icon: Rows3 },
                                        { value: 'compact', label: 'Two per row', icon: Columns2 },
                                    ].map((option) => {
                                        const Icon = option.icon;
                                        const active = mobileCardDensity === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => onChangeMobileCardDensity(option.value)}
                                                className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-[13px] font-bold transition-all"
                                                style={active
                                                    ? {
                                                        borderColor: 'var(--color-brand)',
                                                        backgroundColor: 'var(--color-brand-light)',
                                                        color: 'var(--color-brand-strong)',
                                                    }
                                                    : {
                                                        borderColor: 'var(--color-border)',
                                                        backgroundColor: 'white',
                                                        color: 'var(--color-text-secondary)',
                                                    }}
                                            >
                                                <Icon size={16} />
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        {locationNotice ? (
                            <div className="rounded-xl border px-3 py-2 text-[14px] font-medium leading-5" style={{ backgroundColor: '#fff1ef', color: '#b84030', borderColor: '#f7c2b8' }}>
                                {locationNotice.message}
                            </div>
                        ) : null}

                        {favoritesActionNotice ? (
                            <div className="rounded-xl border px-3 py-2 text-[14px] font-medium leading-5" style={{ backgroundColor: '#fff7ed', color: '#c2410c', borderColor: '#fdba74' }}>
                                {favoritesActionNotice}
                            </div>
                        ) : null}

                        {userLocation ? (
                            <div className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-[14px] font-medium" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.82)' }}>
                                <div className="min-w-0">
                                    <p className="truncate" style={{ color: 'var(--color-brand-strong)' }}>
                                        Using {getSearchLocationLabel(searchOrigin)}
                                    </p>
                                    {searchRadius < 100 && !distanceOverridden ? (
                                        <p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                            Within {searchRadius < 1 ? `${searchRadius * 1000}m` : `${searchRadius}km`}
                                        </p>
                                    ) : null}
                                </div>
                                {canClearLocationSearch ? (
                                    <button type="button" onClick={clearLocationSearch} className="shrink-0 text-[12px] font-bold underline leading-none whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                                        Clear
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
            </div>
        </MobileBottomSheet>
    );
}

function DesktopFilterPanel({
    activeTab,
    activeSubregionLabel,
    canShowSaveAll,
    canUseSubregionScope,
    canClearLocationSearch,
    clearLocationSearch,
    discoverySubregionOptions = [],
    distanceOverridden = false,
    favoritesActionNotice,
    handleHomeAnchor,
    handleLocateMe,
    handlePostalSearch,
    hasHomePostalCode,
    isGeocoding,
    isCollapsed,
    isSaveAllChecked,
    isSaveAllIndeterminate,
    isSaveAllPending,
    locationNotice,
    onApplySearch,
    onCollapse,
    onExpand,
    onSearchChange,
    onToggleSaveAll,
    postalInput,
    resultCount,
    saveAllCount = 0,
    saveAllPendingLabel,
    search,
    searchOrigin,
    searchRadius,
    selectedDiscoverySubregionId,
    setActiveTab,
    setPostalInput,
    setSelectedDiscoverySubregion,
    setSearchRadius,
    setShowFavoritesOnly,
    showFavoritesOnly,
    tabCounts = { all: 0, hard: 0, soft: 0 },
    user,
    userLocation,
}) {
    const summaryChips = buildSummaryChips({
        activeTab,
        activeSubregionLabel,
        distanceOverridden,
        search,
        searchOrigin,
        searchRadius,
        showFavoritesOnly,
        user,
        userLocation,
    });
    const { mode: locationControlMode, rowRef: locationControlsRef } = useAdaptiveLocationControlMode(hasHomePostalCode);
    const postalPlaceholder = locationControlMode === 'full'
        ? '6-digit Postal Code'
        : locationControlMode === 'compact'
            ? 'Postal code'
            : '';
    const showSearchLabel = locationControlMode === 'full';

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
                                    Current search
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
                        <h1 className="text-[1.6rem] font-black leading-tight tracking-tight" style={{ color: 'var(--color-text)' }}>
                            Find care and support near you
                        </h1>
                        <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                            Search for nearby places, programmes, services, and support.
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
                    <div ref={locationControlsRef} className="flex gap-2">
                        <div className="relative flex-1">
                            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
                            <input
                                id="postal-input"
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                maxLength={6}
                                placeholder={postalPlaceholder}
                                value={postalInput}
                                onChange={(event) => setPostalInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                className={`w-full rounded-2xl py-2.5 pl-9 pr-10 ${DISCOVERY_CONTROL_TEXT_CLASS} font-medium focus:outline-none focus:ring-2 ${DISCOVERY_CONTROL_HEIGHT_CLASS} transition-all`}
                                style={{
                                    ...INPUT_RING_STYLE,
                                    backgroundColor: 'var(--color-input-bg)',
                                    color: 'var(--color-text)',
                                    border: '1.5px solid var(--color-border)',
                                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
                                }}
                            />
                            {isGeocoding ? (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-brand)' }} />
                                </div>
                            ) : null}
                        </div>
                        {hasHomePostalCode ? (
                            <LocationActionButton
                                active={searchOrigin?.source === 'home'}
                                icon={House}
                                labelMode={locationControlMode}
                                onClick={() => handleHomeAnchor()}
                                shortLabel="Home"
                                title="Use home postal code from your profile"
                            >
                                Home
                            </LocationActionButton>
                        ) : null}
                        <LocationActionButton
                            active={searchOrigin?.source === 'geolocation'}
                            icon={LocateFixed}
                            labelMode={locationControlMode}
                            onClick={handleLocateMe}
                            shortLabel="Locate"
                            title="Use my current location"
                        >
                            Locate me
                        </LocationActionButton>
                        <div className="relative shrink-0">
                            <select
                                value={searchRadius}
                                onChange={(event) => setSearchRadius(parseFloat(event.target.value))}
                                disabled={distanceOverridden}
                                className={`${DISCOVERY_CONTROL_HEIGHT_CLASS} cursor-pointer appearance-none rounded-2xl pl-3 pr-8 py-2.5 text-[0.78rem] font-semibold focus:outline-none transition-all`}
                                style={{
                                    backgroundColor: 'var(--color-input-bg)',
                                    color: 'var(--color-text)',
                                    border: '1.5px solid var(--color-border)',
                                    opacity: distanceOverridden ? 0.55 : 1,
                                }}
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
                            className={`flex ${DISCOVERY_CONTROL_HEIGHT_CLASS} flex-shrink-0 items-center justify-center rounded-2xl ${DISCOVERY_CONTROL_TEXT_CLASS} font-bold text-white transition-all hover:shadow-lg active:scale-95 ${showSearchLabel ? 'gap-2 px-5' : 'gap-0 px-3'}`}
                            style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)' }}
                            aria-label="Search using the current location settings"
                            title="Search using the current location settings"
                        >
                            <Search size={16} />
                            {showSearchLabel ? 'Search' : null}
                        </button>
                    </div>

                    {user && !hasHomePostalCode ? (
                        <HomePostalCodeCta />
                    ) : null}

                    {canUseSubregionScope ? (
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
                                <input
                                    type="search"
                                    placeholder="Search by name, service, tag, or address"
                                    value={search}
                                    onChange={(event) => onSearchChange(event.target.value)}
                                    className={`w-full rounded-2xl py-2.5 pl-9 pr-3 ${DISCOVERY_CONTROL_TEXT_CLASS} font-medium focus:outline-none focus:ring-2 ${DISCOVERY_CONTROL_HEIGHT_CLASS} transition-all`}
                                    style={{
                                        ...INPUT_RING_STYLE,
                                        backgroundColor: 'var(--color-input-bg)',
                                        color: 'var(--color-text)',
                                        border: '1.5px solid var(--color-border)',
                                    }}
                                />
                            </div>

                            <label
                                className={`relative flex ${DISCOVERY_CONTROL_HEIGHT_CLASS} items-center gap-2 rounded-2xl border bg-white px-3`}
                                style={{ borderColor: 'var(--color-border)' }}
                            >
                                <span className={`shrink-0 ${DISCOVERY_LABEL_TEXT_CLASS}`} style={{ color: 'var(--color-text-muted)' }}>
                                    Area
                                </span>
                                <select
                                    value={selectedDiscoverySubregionId}
                                    onChange={(event) => setSelectedDiscoverySubregion(event.target.value)}
                                    className={`w-full ${DISCOVERY_CONTROL_HEIGHT_CLASS} cursor-pointer appearance-none bg-transparent pl-0 pr-7 py-2.5 ${DISCOVERY_CONTROL_TEXT_CLASS} font-medium focus:outline-none transition-all`}
                                    style={{ color: 'var(--color-text)' }}
                                >
                                    {discoverySubregionOptions.map((option) => (
                                        <option key={option.id} value={String(option.id)}>
                                            {option.discoveryLabel}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-50" />
                            </label>
                        </div>
                    ) : (
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
                            <input
                                type="search"
                                placeholder="Search by name, service, tag, or address"
                                value={search}
                                onChange={(event) => onSearchChange(event.target.value)}
                                className={`w-full rounded-2xl py-2.5 pl-9 pr-3 ${DISCOVERY_CONTROL_TEXT_CLASS} font-medium focus:outline-none focus:ring-2 ${DISCOVERY_CONTROL_HEIGHT_CLASS} transition-all`}
                                style={{
                                    ...INPUT_RING_STYLE,
                                    backgroundColor: 'var(--color-input-bg)',
                                    color: 'var(--color-text)',
                                    border: '1.5px solid var(--color-border)',
                                }}
                            />
                        </div>
                    )}
                </form>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-1 items-center gap-1 rounded-2xl p-1" style={{ backgroundColor: 'var(--color-badge-bg)', border: '1px solid var(--color-border)' }}>
                        {[
                            { value: 'all', label: 'All', count: tabCounts.all },
                            { value: 'hard', label: 'Places', count: tabCounts.hard },
                            { value: 'soft', label: 'Programmes & services', count: tabCounts.soft },
                        ].map((tab) => (
                            <button
                                key={tab.value}
                                onClick={() => setActiveTab(tab.value)}
                                className={`${DISCOVERY_SECONDARY_CONTROL_HEIGHT_CLASS} flex-1 rounded-[14px] px-2 py-1.5 whitespace-nowrap transition-all`}
                                style={activeTab === tab.value
                                    ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-brand-strong)', boxShadow: '0 4px 12px rgba(15, 89, 91, 0.08)', border: '1px solid var(--color-border)' }
                                    : { color: 'var(--color-text-secondary)' }}
                            >
                                <span className="flex items-center justify-center gap-1.5">
                                    <span className={DISCOVERY_TAB_TEXT_CLASS}>{tab.label}</span>
                                    <span
                                        className="inline-flex min-w-[1.55rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[0.68rem] font-bold leading-none"
                                        style={{
                                            backgroundColor: activeTab === tab.value ? 'rgba(231, 248, 244, 0.96)' : 'rgba(255,255,255,0.9)',
                                            border: '1px solid var(--color-border)',
                                            color: activeTab === tab.value ? 'var(--color-brand-strong)' : 'var(--color-text-muted)',
                                        }}
                                    >
                                        {tab.count}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {canShowSaveAll ? (
                        <SaveAllToggleControl
                            checked={isSaveAllChecked}
                            count={saveAllCount}
                            disabled={saveAllCount === 0 || isSaveAllPending}
                            indeterminate={isSaveAllIndeterminate}
                            pending={isSaveAllPending}
                            pendingLabel={saveAllPendingLabel}
                            onChange={onToggleSaveAll}
                        />
                    ) : null}

                    {user ? (
                        <label className={`flex shrink-0 cursor-pointer select-none items-center gap-3 rounded-2xl border px-3 py-2 transition-all hover:bg-white ${DISCOVERY_SECONDARY_CONTROL_HEIGHT_CLASS}`} style={{ borderColor: 'var(--color-border)' }}>
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
                            <span className={DISCOVERY_LABEL_TEXT_CLASS} style={{ color: 'var(--color-text-secondary)' }}>
                                Saved only
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

                {distanceOverridden ? (
                    <div
                        className="rounded-xl px-4 py-2.5 text-xs font-bold leading-relaxed border animate-in fade-in slide-in-from-top-1"
                        style={{ backgroundColor: 'rgba(248,250,252,0.92)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
                    >
                        A service area is selected, so distance is shown for context only and no longer filters results.
                    </div>
                ) : null}

                {favoritesActionNotice ? (
                    <div
                        className="rounded-xl px-4 py-2.5 text-xs font-bold leading-relaxed border animate-in fade-in slide-in-from-top-1"
                        style={{ backgroundColor: '#fff7ed', color: '#c2410c', borderColor: '#fdba74' }}
                    >
                        {favoritesActionNotice}
                    </div>
                ) : null}

                {userLocation ? (
                    <div className="flex items-center justify-between rounded-2xl border px-4 py-2.5 text-xs font-extrabold transition-all" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.72)' }}>
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span style={{ color: 'var(--color-brand-strong)' }}>
                                Using {getSearchLocationLabel(searchOrigin)}
                                {searchRadius < 100 && !distanceOverridden ? ` • Within ${searchRadius < 1 ? `${searchRadius * 1000}m` : `${searchRadius}km`}` : ''}
                            </span>
                        </div>
                        {canClearLocationSearch ? (
                            <button onClick={clearLocationSearch} className="font-black underline decoration-2 underline-offset-2 transition-colors hover:text-red-500" style={{ color: 'var(--color-text-muted)' }}>
                                Clear
                            </button>
                        ) : null}
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
        activeSubregionLabel,
        canShowSaveAll = false,
        canUseSubregionScope = false,
        canClearLocationSearch = true,
        clearLocationSearch,
        discoverySubregionOptions = [],
        distanceOverridden = false,
        favoritesActionNotice = '',
        handleHomeAnchor,
        handleLocateMe,
        handlePostalSearch,
        hasHomePostalCode = false,
        isGeocoding,
        isCollapsed,
        isSaveAllChecked = false,
        isSaveAllIndeterminate = false,
        isSaveAllPending = false,
        locationNotice,
        mobileMode = 'browse',
        mobileCardDensity = 'comfortable',
        onApplySearch,
        onChangeMobileCardDensity,
        onCollapse,
        onExpand,
        onOpenBrowse,
        onOpenMap,
        onOpenMobileBrowseDrawer,
        onSearchChange,
        onToggleSaveAll,
        pinCount = 0,
        postalInput,
        resultCount,
        savedAssetCount = 0,
        saveAllCount = 0,
        saveAllPendingLabel = 'Working…',
        search,
        searchOrigin,
        searchRadius,
        selectedDiscoverySubregionId = '',
        setActiveTab,
        setPostalInput,
        setSelectedDiscoverySubregion = () => {},
        setSearchRadius,
        setShowFavoritesOnly,
        showFavoritesOnly,
        tabCounts = { all: 0, hard: 0, soft: 0 },
        unmappableSavedCount = 0,
        user,
        userLocation,
    } = props;

    const summaryChips = buildSummaryChips({
        activeTab,
        activeSubregionLabel,
        distanceOverridden,
        search,
        searchOrigin,
        searchRadius,
        showFavoritesOnly,
        user,
        userLocation,
    });
    const mapDisabled = pinCount === 0 && !userLocation;

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
                    {mobileMode === 'browse' ? (
                        <>
                            <div
                                className="rounded-[24px] border px-4 py-3"
                                style={{
                                    borderColor: 'var(--color-border)',
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(231,248,244,0.94) 100%)',
                                }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-brand)' }}>
                                            Browse
                                        </p>
                                        <p className="mt-1 text-[16px] font-extrabold leading-tight" style={{ color: 'var(--color-text)' }}>
                                            Showing {resultCount} {resultCount === 1 ? 'resource' : 'resources'}
                                        </p>
                                        <p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                            {userLocation
                                                ? `Anchored around ${getSearchLocationLabel(searchOrigin)}`
                                                : 'Browse the list first, then open the map when you want to see where resources are.'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onOpenMap}
                                        disabled={mapDisabled}
                                        className="btn-primary min-h-[44px] shrink-0 justify-center px-4 text-[13px] leading-none whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Map size={15} />
                                        Open map
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                                    <input
                                        type="search"
                                        placeholder="Search names, services, tags..."
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
                                    Filter
                                </button>
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

                            {savedAssetCount > 0 && mapDisabled ? (
                                <div className="rounded-2xl border px-3 py-2 text-[12px] font-medium leading-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.88)', color: 'var(--color-text-secondary)' }}>
                                    Your saved resources do not have map locations yet. The map will appear after you save a place, programme, or service with a valid address.
                                </div>
                            ) : null}

                            {user && !hasHomePostalCode ? (
                                <HomePostalCodeCta compact />
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
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-brand)' }}>
                                    Map view
                                </p>
                                <p className="mt-1 text-[16px] font-extrabold leading-tight" style={{ color: 'var(--color-text)' }}>
                                    {pinCount > 0
                                        ? `Showing ${pinCount} saved ${pinCount === 1 ? 'place' : 'places'}`
                                        : `Showing ${getSearchLocationLabel(searchOrigin)}`}
                                </p>
                                <p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                    {pinCount > 0
                                        ? 'Use the map to compare saved places. Open the list when you want to scan the resource cards.'
                                        : 'This map is centred around your selected location. Save places to pin them here.'}
                                </p>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={onOpenMobileBrowseDrawer}
                                    className="btn-ghost min-h-[44px] justify-center px-3 text-[12px] font-bold leading-none whitespace-nowrap"
                                    disabled={!onOpenMobileBrowseDrawer}
                                >
                                    <Rows3 size={15} />
                                    List
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMobileFiltersOpen(true)}
                                    className="btn-ghost min-h-[44px] justify-center px-3 text-[12px] font-bold leading-none whitespace-nowrap"
                                >
                                    <SlidersHorizontal size={15} />
                                    Filter
                                </button>
                                <button
                                    type="button"
                                    onClick={onOpenBrowse}
                                    className="btn-ghost min-h-[44px] justify-center px-3 text-[12px] font-bold leading-none whitespace-nowrap"
                                >
                                    <Search size={15} />
                                    Browse
                                </button>
                            </div>
                            {savedAssetCount > 0 && unmappableSavedCount > 0 ? (
                                <p className="mt-2 text-[12px] font-medium leading-5" style={{ color: 'var(--color-text-muted)' }}>
                                    {unmappableSavedCount} saved {unmappableSavedCount === 1 ? 'resource is' : 'resources are'} shown in the list only and not shown on the map.
                                </p>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>

            <MobileFilterSheet
                activeTab={activeTab}
                activeSubregionLabel={activeSubregionLabel}
                canShowSaveAll={canShowSaveAll}
                canUseSubregionScope={canUseSubregionScope}
                canClearLocationSearch={canClearLocationSearch}
                clearLocationSearch={clearLocationSearch}
                discoverySubregionOptions={discoverySubregionOptions}
                distanceOverridden={distanceOverridden}
                favoritesActionNotice={favoritesActionNotice}
                handleHomeAnchor={handleHomeAnchor}
                handleLocateMe={handleLocateMe}
                handlePostalSearch={(event) => {
                    handlePostalSearch(event);
                }}
                hasHomePostalCode={hasHomePostalCode}
                isGeocoding={isGeocoding}
                isSaveAllChecked={isSaveAllChecked}
                isSaveAllIndeterminate={isSaveAllIndeterminate}
                isSaveAllPending={isSaveAllPending}
                isOpen={mobileFiltersOpen}
                locationNotice={locationNotice}
                mobileCardDensity={mobileCardDensity}
                onChangeMobileCardDensity={onChangeMobileCardDensity}
                onOpenChange={setMobileFiltersOpen}
                onToggleSaveAll={onToggleSaveAll}
                postalInput={postalInput}
                saveAllCount={saveAllCount}
                saveAllPendingLabel={saveAllPendingLabel}
                searchOrigin={searchOrigin}
                searchRadius={searchRadius}
                selectedDiscoverySubregionId={selectedDiscoverySubregionId}
                setActiveTab={setActiveTab}
                setPostalInput={setPostalInput}
                setSelectedDiscoverySubregion={setSelectedDiscoverySubregion}
                setSearchRadius={setSearchRadius}
                setShowFavoritesOnly={setShowFavoritesOnly}
                showFavoritesOnly={showFavoritesOnly}
                tabCounts={tabCounts}
                user={user}
                userLocation={userLocation}
            />
        </>
    );
}

export default DiscoveryFilterPanel;
