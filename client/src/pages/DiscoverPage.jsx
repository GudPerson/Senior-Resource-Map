import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api.js';
import { Building2, CalendarDays, Search, LocateFixed, MapPin } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Drawer } from 'vaul';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { getDistance, searchOneMap } from '../lib/geo.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useFavorites } from '../hooks/useFavorites.js';
import { AssetCard } from '../components/AssetCard.jsx';

// Fix Leaflet default icon path issue with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createColoredIcon(color = '#3b82f6') {
    return L.divIcon({
        className: '',
        html: `<div style="
        width: 32px; height: 32px;
        border-radius: 50% 50% 50% 0;
        background: ${color};
        transform: rotate(-45deg);
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        border: 3px solid white;
      "></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -34],
    });
}

function FlyToMarker({ target, bottomOffsetPx = 0 }) {
    const map = useMap();
    const prevTarget = useRef(null);
    useEffect(() => {
        if (!target) return;
        const key = JSON.stringify(target) + bottomOffsetPx;
        if (key === prevTarget.current) return;

        // Leaflet crashes if flyTo is called on a hidden map container (e.g. mobile vs desktop view)
        const size = map.getSize();
        if (size.x === 0 || size.y === 0) return;

        prevTarget.current = key;
        const zoom = target.zoom || 15;

        if (bottomOffsetPx > 0) {
            // Offset the target so it appears centered in the visible map area above the drawer
            // Convert target lat/lng to pixel, shift up by half the drawer height, convert back
            const targetPoint = map.project([target.lat, target.lng], zoom);
            targetPoint.y += bottomOffsetPx / 2;
            const offsetLatLng = map.unproject(targetPoint, zoom);
            map.flyTo(offsetLatLng, zoom, { animate: true, duration: 0.8 });
        } else {
            map.flyTo([target.lat, target.lng], zoom, { animate: true, duration: 0.8 });
        }
    }, [target, map, bottomOffsetPx]);
    return null;
}



export default function DiscoverPage() {
    const [subCatColors, setSubCatColors] = useState({});
    const [hardAssets, setHardAssets] = useState([]);
    const [softAssets, setSoftAssets] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search & Filter state
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    const { user } = useAuth();
    const { favorites, toggleFavorite: handleToggleFavorite, isFavorite } = useFavorites(user);

    // Selection state
    const [selectedId, setSelectedId] = useState(null);
    const [selectedAsset, setSelectedAsset] = useState(null);

    // Mobile drawer state
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeSnap, setActiveSnap] = useState(0.55);

    // Calculate the pixel offset for the drawer so the map centers in the visible area
    const drawerOffsetPx = useMemo(() => {
        if (!isDrawerOpen) return 0;
        // activeSnap is fraction of viewport height the drawer covers
        return typeof window !== 'undefined' ? window.innerHeight * activeSnap : 0;
    }, [isDrawerOpen, activeSnap]);

    // Split pane state
    const [listWidth, setListWidth] = useState(450);
    const [isDragging, setIsDragging] = useState(false);

    // Geo state
    const [userLocation, setUserLocation] = useState(null);
    const [searchRadius, setSearchRadius] = useState(100); // default = All SG
    const [postalInput, setPostalInput] = useState('');
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [flyTarget, setFlyTarget] = useState(null);

    const [searchParams] = useSearchParams();

    // Drag-to-resize split pane
    const startDragging = useCallback((e) => {
        setIsDragging(true);
        e.preventDefault();
    }, []);

    useEffect(() => {
        const onMouseMove = (e) => {
            if (!isDragging) return;
            const newWidth = Math.max(300, Math.min(e.clientX, window.innerWidth * 0.7));
            setListWidth(newWidth);
        };
        const onMouseUp = () => {
            setIsDragging(false);
            window.dispatchEvent(new Event('resize'));
        };
        if (isDragging) {
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging]);

    // Load data
    useEffect(() => {
        Promise.all([
            api.getHardAssets().catch(() => []),
            api.getSoftAssets().catch(() => []),
            api.getSubCategories().catch(() => [])
        ]).then(([hard, soft, subcats]) => {
            const colors = {};
            subcats.forEach(sc => { colors[sc.name] = sc.color || '#94a3b8'; });
            setSubCatColors(colors);
            setHardAssets(hard);
            setSoftAssets(soft);
            setLoading(false);
            const urlId = parseInt(searchParams.get('id'));
            if (urlId) {
                const foundHard = hard.find(a => a.id === urlId);
                if (foundHard) {
                    setSelectedId(foundHard.id);
                    setSelectedAsset({ ...foundHard, _type: 'hard' });
                }
            }
        });
    }, [searchParams]);

    const isPubliclyVisible = (a) => {
        if (a.isHidden) return false;
        const now = new Date();
        const from = a.hideFrom ? new Date(a.hideFrom) : null;
        const until = a.hideUntil ? new Date(a.hideUntil) : null;
        if (from && until) {
            if (now >= from && now <= until) return false;
        } else if (from && now >= from) {
            return false;
        } else if (until && now <= until) {
            return false;
        }
        return true;
    };

    // Geo handlers
    const handleLocateMe = useCallback(() => {
        if (!navigator.geolocation) return alert('Geolocation not supported');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setUserLocation(loc);
                const zoom = searchRadius <= 0.3 ? 17 : searchRadius <= 0.5 ? 16 : searchRadius <= 1 ? 15 : searchRadius <= 2 ? 14 : 13;
                setFlyTarget({ ...loc, zoom });
            },
            () => alert('Unable to retrieve your location')
        );
    }, [searchRadius]);

    const handlePostalSearch = useCallback(async (e) => {
        e.preventDefault();
        const val = postalInput.trim();
        if (!/^\d{6}$/.test(val)) {
            alert('Please enter a valid 6-digit Singapore postal code');
            return;
        }
        setIsGeocoding(true);

        let result = null;

        // Fallback 1: Check known assets first
        const localMatch = hardAssets.find(ha => ha.postalCode === val);
        if (localMatch) {
            result = { lat: parseFloat(localMatch.lat), lng: parseFloat(localMatch.lng) };
        } else {
            // Fallback 2: OneMap Web API
            result = await searchOneMap(val);
        }

        setIsGeocoding(false);
        if (result) {
            setUserLocation({ lat: result.lat, lng: result.lng });
            const zoom = searchRadius <= 0.3 ? 17 : searchRadius <= 0.5 ? 16 : searchRadius <= 1 ? 15 : searchRadius <= 2 ? 14 : 13;
            setFlyTarget({ lat: result.lat, lng: result.lng, zoom });
        } else {
            alert('Postal code not found. Please try another.');
        }
    }, [postalInput, searchRadius, hardAssets]);

    // Combined & filtered assets
    const combined = useMemo(() => {
        const items = [];
        const haOpts = hardAssets.filter(isPubliclyVisible);
        const saOpts = softAssets.filter(isPubliclyVisible);
        if (activeTab === 'all' || activeTab === 'hard') items.push(...haOpts.map(a => ({ ...a, _type: 'hard' })));
        if (activeTab === 'all' || activeTab === 'soft') items.push(...saOpts.map(a => ({ ...a, _type: 'soft' })));
        return items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }, [hardAssets, softAssets, activeTab]);

    const filtered = useMemo(() => {
        let items = combined;

        if (userLocation) {
            // Calculate and attach distance to each item
            items = items.map(r => {
                let lat, lng;
                if (r._type === 'hard') {
                    lat = parseFloat(r.lat);
                    lng = parseFloat(r.lng);
                } else {
                    if (r.locations && r.locations.length > 0) {
                        let minDist = Infinity;
                        let bestLoc = r.locations[0];
                        for (const loc of r.locations) {
                            const d = getDistance(userLocation.lat, userLocation.lng, parseFloat(loc.lat), parseFloat(loc.lng));
                            if (d < minDist) {
                                minDist = d;
                                bestLoc = loc;
                            }
                        }
                        lat = parseFloat(bestLoc.lat);
                        lng = parseFloat(bestLoc.lng);
                    } else if (r.location) {
                        lat = parseFloat(r.location.lat);
                        lng = parseFloat(r.location.lng);
                    }
                }

                if (!lat || !lng) return { ...r, _distance: null, _displayLat: lat, _displayLng: lng };
                const dist = getDistance(userLocation.lat, userLocation.lng, lat, lng);
                return { ...r, _distance: dist, _displayLat: lat, _displayLng: lng };
            });

            // If radius filter is active, filter items
            if (searchRadius < 100) {
                items = items.filter(r => r._distance !== null && r._distance <= searchRadius);
            }

            // Always sort by proximity if location is known
            items.sort((a, b) => {
                if (a._distance === null) return 1;
                if (b._distance === null) return -1;
                return a._distance - b._distance;
            });
        }

        const q = search.toLowerCase();

        items = items.filter(r => {
            if (showFavoritesOnly && user) {
                const isFav = favorites.some(f => f.resourceId === r.id && f.resourceType === r._type);
                if (!isFav) return false;
            }
            if (!q) return true;
            const matchName = r.name.toLowerCase().includes(q);
            const matchDesc = (r.description || '').toLowerCase().includes(q);
            const matchTag = r.tags?.some(t => t.toLowerCase().includes(q));
            const matchCat = r.subCategory?.toLowerCase().includes(q);
            return matchName || matchDesc || matchTag || matchCat;
        });

        return items;
    }, [combined, search, userLocation, searchRadius, showFavoritesOnly, favorites, user]);

    const mapLocations = useMemo(() => {
        let items = hardAssets.filter(isPubliclyVisible);
        if (userLocation && searchRadius < 100) {
            items = items.filter(ha =>
                getDistance(userLocation.lat, userLocation.lng, parseFloat(ha.lat), parseFloat(ha.lng)) <= searchRadius
            );
        }

        items = items.filter(ha => {
            if (showFavoritesOnly && user) {
                const isHardFav = favorites.some(f => f.resourceId === ha.id && f.resourceType === 'hard');
                const hasSoftFav = ha.softAssets?.some(sa => favorites.some(f => f.resourceId === sa.id && f.resourceType === 'soft'));
                if (!isHardFav && !hasSoftFav) return false;
            }
            return true;
        });

        if (!search) return items;
        const q = search.toLowerCase();
        return items.filter(ha => {
            const matchHard = ha.name.toLowerCase().includes(q) || (ha.description || '').toLowerCase().includes(q) || ha.tags?.some(t => t.toLowerCase().includes(q)) || ha.subCategory?.toLowerCase().includes(q);
            const matchSoft = ha.softAssets?.some(sa => sa.name.toLowerCase().includes(q) || (sa.description || '').toLowerCase().includes(q) || sa.tags?.some(t => t.toLowerCase().includes(q)) || sa.subCategory?.toLowerCase().includes(q));
            return matchHard || matchSoft;
        });
    }, [hardAssets, search, userLocation, searchRadius, showFavoritesOnly, favorites, user]);

    const handleSelect = useCallback((asset) => {
        if (!asset) { setSelectedId(null); setSelectedAsset(null); return; }
        setSelectedAsset(asset);
        const targetLocationId = asset._type === 'hard' ? asset.id : (asset.locations?.[0]?.id || asset.locationId);
        if (targetLocationId) {
            setSelectedId(targetLocationId);
            // Pan map to the selected asset
            const lat = asset._type === 'hard' ? asset.lat : (asset.locations?.[0]?.lat || asset.location?.lat);
            const lng = asset._type === 'hard' ? asset.lng : (asset.locations?.[0]?.lng || asset.location?.lng);
            if (lat && lng) {
                setFlyTarget({ lat: parseFloat(lat), lng: parseFloat(lng), zoom: 16 });
            }
        }
        const element = document.getElementById(`asset-card-${asset._type}-${asset.id}`);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, []);

    // Shared filter/search header — rendered as JSX, not a nested component
    const filterHeader = (
        <div className="flex-shrink-0 z-10 sticky top-0" style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
            {/* Title + Locate Me — desktop only */}
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

            {/* Compact search row */}
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
                            onChange={e => setPostalInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 min-h-[40px] transition-all"
                            style={{ backgroundColor: 'var(--color-input-bg)', color: 'var(--color-text)', border: '1.5px solid var(--color-border)', '--tw-ring-color': 'var(--color-brand)' }}
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
                    {/* Mobile Locate Me button */}
                    <button
                        type="button"
                        onClick={handleLocateMe}
                        className="lg:hidden px-3 py-2 rounded-xl font-bold text-sm min-h-[40px] flex items-center flex-shrink-0 transition-all"
                        style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)', border: '1px solid var(--color-border)' }}
                    >
                        <LocateFixed size={16} />
                    </button>
                </form>

                {/* Radius + text search on one row */}
                <div className="flex gap-2">
                    <select
                        value={searchRadius}
                        onChange={e => setSearchRadius(parseFloat(e.target.value))}
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
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 min-h-[36px] transition-all"
                            style={{ backgroundColor: 'var(--color-input-bg)', color: 'var(--color-text)', border: '1.5px solid var(--color-border)', '--tw-ring-color': 'var(--color-brand)' }}
                        />
                    </div>
                </div>

                {/* Tabs — compact horizontal pill strip */}
                <div className="flex items-center gap-1.5 p-0.5 rounded-xl" style={{ backgroundColor: 'var(--color-badge-bg)' }}>
                    {['all', 'hard', 'soft'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold min-h-[32px] whitespace-nowrap transition-all capitalize`}
                            style={activeTab === tab
                                ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-brand)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid var(--color-border)' }
                                : { color: 'var(--color-text-secondary)' }
                            }
                        >
                            {tab === 'all' ? 'All' : tab === 'hard' ? 'Places' : 'Offerings'}
                        </button>
                    ))}
                </div>

                {/* Favorites toggle */}
                {user && (
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none" style={{ color: 'var(--color-text-secondary)' }}>
                            <div className="relative inline-block w-9 mr-1 align-middle transition duration-200 ease-in">
                                <input type="checkbox" checked={showFavoritesOnly} onChange={e => setShowFavoritesOnly(e.target.checked)} className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer" style={{ right: showFavoritesOnly ? 0 : '1.125rem', borderColor: showFavoritesOnly ? '#10b981' : '#cbd5e1' }} />
                                <div className="toggle-label block overflow-hidden h-4 rounded-full cursor-pointer" style={{ backgroundColor: showFavoritesOnly ? '#10b981' : 'var(--color-border)' }}></div>
                            </div>
                            Favorites Only
                        </label>
                    </div>
                )}

                {/* Active filter indicator */}
                {userLocation && searchRadius < 100 && (
                    <div className="flex items-center justify-between text-xs font-bold px-1">
                        <span style={{ color: 'var(--color-brand)' }}>📍 Within {searchRadius < 1 ? `${searchRadius * 1000}m` : `${searchRadius}km`}</span>
                        <button
                            onClick={() => { setUserLocation(null); setPostalInput(''); }}
                            className="underline"
                            style={{ color: 'var(--color-text-muted)' }}
                        >Clear</button>
                    </div>
                )}
            </div>
        </div>
    );

    // Asset list content
    const listItems = (
        <div className="flex-1 overflow-y-auto p-3 lg:p-5 pb-20 scroll-smooth relative hide-scrollbar">
            {loading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="card animate-pulse h-36" style={{ border: '1px solid var(--color-border)' }} />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                    <Search size={40} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
                    <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>No results found</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Try adjusting your filters or search terms.</p>
                </div>
            ) : (
                <div className="space-y-3 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:gap-4 lg:space-y-0">
                    {filtered.map((r, idx) => (
                        <div
                            id={`asset-card-${r._type}-${r.id}`}
                            key={`${r._type}-${r.id}`}
                            className="mobile-card-enter"
                            style={{ animationDelay: `${idx * 0.04}s` }}
                        >
                            <AssetCard
                                asset={r}
                                type={r._type}
                                isSelected={selectedAsset?.id === r.id && selectedAsset?._type === r._type}
                                onClick={() => handleSelect(r)}
                                subCatColors={subCatColors}
                                isFavorite={favorites.some(f => f.resourceId === r.id && f.resourceType === r._type)}
                                onToggleFavorite={handleToggleFavorite}
                                isLoggedIn={!!user}
                                onTagClick={setSearch}
                                onCategoryClick={setSearch}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const mapElement = (
        <MapContainer
            center={[1.3521, 103.8198]}
            zoom={12}
            style={{ width: '100%', height: '100%', zIndex: 0 }}
            zoomControl={false}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <FlyToMarker target={flyTarget} bottomOffsetPx={drawerOffsetPx} />
            {userLocation && (
                <Marker
                    position={[userLocation.lat, userLocation.lng]}
                    icon={L.divIcon({
                        className: '',
                        html: `<div class="pulse-animation" style="width:20px;height:20px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(37,99,235,0.6);"></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })}
                >
                    <Popup><div className="p-1 font-bold text-sm">Your Search Location</div></Popup>
                </Marker>
            )}
            <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
                {mapLocations.map(r => {
                    const isLocationSelected = selectedId === r.id;
                    return (
                        <Marker
                            key={r.id}
                            position={[parseFloat(r.lat), parseFloat(r.lng)]}
                            icon={createColoredIcon(isLocationSelected ? '#2563eb' : (subCatColors[r.subCategory] || '#64748b'))}
                            eventHandlers={{
                                click: () => {
                                    handleSelect({ ...r, _type: 'hard' });
                                    setIsDrawerOpen(true);
                                }
                            }}
                        >
                            <Popup className="custom-popup">
                                <div className="p-1 min-w-[180px]">
                                    <h3 className="font-bold text-slate-900 text-sm leading-tight mb-1">{r.name}</h3>
                                    {r.address && <p className="text-xs text-slate-600 mb-2">{r.address}</p>}
                                    <div className="text-xs font-bold text-brand-600 cursor-pointer" onClick={() => setIsDrawerOpen(true)}>
                                        View details →
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MarkerClusterGroup>
        </MapContainer>
    );

    return (
        <div className="relative flex flex-col h-[calc(100vh-4rem)] overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>

            {/* DESKTOP SPLIT VIEW */}
            <div className="hidden lg:flex flex-1 w-full h-full relative">
                {/* Left pane */}
                <div
                    className="flex-shrink-0 h-full shadow-xl z-20 overflow-hidden flex flex-col"
                    style={{ width: `${listWidth}px`, backgroundColor: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}
                >
                    {filterHeader}
                    {listItems}
                </div>

                {/* Resize handle */}
                <div
                    className={`w-2 h-full absolute cursor-col-resize z-30 transition-colors ${isDragging ? 'bg-brand-500 opacity-60' : 'hover:bg-brand-300 hover:opacity-60'}`}
                    onMouseDown={startDragging}
                    style={{ left: `${listWidth - 4}px` }}
                />

                {/* Right pane: Map */}
                <div className="flex-1 w-full h-full relative z-0">
                    {mapElement}
                </div>
            </div>

            {/* MOBILE VIEW */}
            <div className="flex lg:hidden flex-1 w-full h-full relative">
                <div className="absolute inset-0 w-full h-full z-0">
                    {mapElement}
                </div>

                {!isDrawerOpen && (
                    <button
                        onClick={() => setIsDrawerOpen(true)}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] text-white px-6 py-3 min-h-[48px] rounded-full shadow-lg font-bold flex items-center gap-2 transition-all active:scale-95"
                        style={{ backgroundColor: 'var(--color-brand)', boxShadow: '0 4px 20px rgba(37, 99, 235, 0.4)' }}
                    >
                        <Search size={18} /> Browse Directory
                    </button>
                )}

                <Drawer.Root
                    open={isDrawerOpen}
                    onOpenChange={setIsDrawerOpen}
                    snapPoints={[0.55, 0.92]}
                    activeSnapPoint={activeSnap}
                    setActiveSnapPoint={setActiveSnap}
                    modal={false}
                >
                    <Drawer.Portal>
                        {/* No overlay — map stays fully interactive above the drawer */}
                        <Drawer.Content
                            className="fixed flex flex-col rounded-t-[16px] h-full max-h-[96%] mt-24 bottom-0 left-0 right-0 z-[501]"
                            style={{ backgroundColor: 'var(--color-drawer-bg)', boxShadow: '0 -8px 30px rgba(0,0,0,0.15)', borderTop: '1px solid var(--color-border)' }}
                        >
                            <VisuallyHidden><Drawer.Title>Directory List</Drawer.Title></VisuallyHidden>
                            {/* Drag handle */}
                            <div className="flex justify-center py-2">
                                <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--color-border-strong)' }} />
                            </div>
                            {filterHeader}
                            {listItems}
                        </Drawer.Content>
                    </Drawer.Portal>
                </Drawer.Root>
            </div>

            {loading && (
                <div className="absolute inset-0 z-[2000] flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <div className="card flex flex-col items-center gap-4 p-8" style={{ border: '2px solid var(--color-border)' }}>
                        <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-brand)' }} />
                        <p className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>Loading Directory…</p>
                    </div>
                </div>
            )}
        </div>
    );
}

