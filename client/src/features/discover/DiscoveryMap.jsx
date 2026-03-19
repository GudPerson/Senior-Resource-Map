import { MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowUpRight, Heart, MapPin } from 'lucide-react';

import { FlyToMarker } from './FlyToMarker.jsx';
import { createSavedPlacePinIcon } from './discoverUtils.js';

function createUserLocationIcon() {
    return L.divIcon({
        className: '',
        html: '<div class="pulse-animation" style="width:20px;height:20px;background:#0b6d70;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(11,109,112,0.45);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    });
}

function SavedAssetLinks({ pin, onOpenAsset }) {
    const previewAssets = pin.savedAssets.slice(0, 4);
    const remaining = pin.savedAssets.length - previewAssets.length;

    return (
        <div className="mt-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Saved here
            </p>
            <div className="space-y-2">
                {previewAssets.map((asset) => (
                    <button
                        key={asset.assetKey}
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onOpenAsset?.(asset);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white"
                    >
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{asset.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{asset.subCategory}</p>
                        </div>
                        <ArrowUpRight size={14} className="shrink-0 text-slate-400" />
                    </button>
                ))}
            </div>
            {remaining > 0 ? (
                <p className="text-xs font-medium text-slate-500">
                    +{remaining} more saved {remaining === 1 ? 'asset' : 'assets'}
                </p>
            ) : null}
        </div>
    );
}

function SavedPlacePopupCard({
    markerKey,
    onKeepTooltipOpen,
    onScheduleTooltipClose,
    onOpenAsset,
    onOpenPlace,
    pin,
}) {
    return (
        <div
            className="min-w-[240px] p-1"
            onClick={(event) => event.stopPropagation()}
            onMouseEnter={() => onKeepTooltipOpen(markerKey)}
            onMouseLeave={() => onScheduleTooltipClose(markerKey)}
        >
            <div className="flex items-start gap-3">
                <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-strong)' }}
                >
                    <MapPin size={18} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="font-bold leading-tight text-slate-900">{pin.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                        {pin.totalOfferingsCount} {pin.totalOfferingsCount === 1 ? 'offering' : 'offerings'} available here
                    </div>
                    {pin.address ? (
                        <div className="mt-1 text-xs leading-5 text-slate-500">{pin.address}</div>
                    ) : null}
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    <Heart size={12} className="text-rose-500" />
                    {pin.savedAssets.length} saved {pin.savedAssets.length === 1 ? 'asset' : 'assets'}
                </span>
                {pin.hasUnavailableSavedAssets ? (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        Some saved items unavailable
                    </span>
                ) : null}
            </div>

            <SavedAssetLinks pin={pin} onOpenAsset={onOpenAsset} />

            {pin.placeDetailPath ? (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onOpenPlace?.(pin);
                    }}
                    className="mt-3 text-xs font-bold text-brand-700 hover:underline"
                >
                    Open place
                </button>
            ) : null}
        </div>
    );
}

export function DiscoveryMap({
    activeTooltipKey,
    bottomOffsetPx = 0,
    flyTarget,
    onKeepTooltipOpen,
    onOpenAsset,
    onOpenPlace,
    onScheduleTooltipClose,
    onSelectPin,
    savedPlacePins,
    selectedMarkerKey,
    userLocation,
}) {
    return (
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
            <FlyToMarker target={flyTarget} bottomOffsetPx={bottomOffsetPx} />
            {userLocation ? (
                <Marker position={[userLocation.lat, userLocation.lng]} icon={createUserLocationIcon()}>
                    <Popup>
                        <div className="p-1 font-bold text-sm">Your Search Location</div>
                    </Popup>
                </Marker>
            ) : null}
            <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
                {savedPlacePins.map((pin) => {
                    const markerKey = pin.pinKey;
                    const isSelected = selectedMarkerKey === markerKey;

                    return (
                        <Marker
                            key={markerKey}
                            position={[pin.lat, pin.lng]}
                            icon={createSavedPlacePinIcon(pin.totalOfferingsCount, isSelected)}
                            eventHandlers={{
                                click: () => {
                                    onSelectPin?.(pin);
                                    onKeepTooltipOpen?.(markerKey);
                                },
                                mouseover: () => onKeepTooltipOpen?.(markerKey),
                                mouseout: () => onScheduleTooltipClose?.(markerKey),
                            }}
                        >
                            {activeTooltipKey === markerKey ? (
                                <Tooltip direction="top" offset={[0, -34]} opacity={1} interactive permanent className="custom-popup">
                                    <SavedPlacePopupCard
                                        markerKey={markerKey}
                                        onKeepTooltipOpen={onKeepTooltipOpen}
                                        onScheduleTooltipClose={onScheduleTooltipClose}
                                        onOpenAsset={onOpenAsset}
                                        onOpenPlace={onOpenPlace}
                                        pin={pin}
                                    />
                                </Tooltip>
                            ) : null}
                            <Popup className="custom-popup">
                                <SavedPlacePopupCard
                                    markerKey={markerKey}
                                    onKeepTooltipOpen={onKeepTooltipOpen}
                                    onScheduleTooltipClose={onScheduleTooltipClose}
                                    onOpenAsset={onOpenAsset}
                                    onOpenPlace={onOpenPlace}
                                    pin={pin}
                                />
                            </Popup>
                        </Marker>
                    );
                })}
            </MarkerClusterGroup>
        </MapContainer>
    );
}

export default DiscoveryMap;
