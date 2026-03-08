import { Heart } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FlyToMarker } from './FlyToMarker.jsx';
import {
    buildMarkerKey,
    createColoredIcon,
    findLocationForMarker,
    getAssetLocations,
} from './discoverUtils.js';

function createUserLocationIcon() {
    return L.divIcon({
        className: '',
        html: '<div class="pulse-animation" style="width:20px;height:20px;background:#0b6d70;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(11,109,112,0.45);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    });
}

function MarkerTooltipCard({
    markerAsset,
    markerFavorite,
    markerKey,
    locationCount,
    onKeepTooltipOpen,
    onScheduleTooltipClose,
    onToggleFavorite,
    onViewDetails,
    resource,
    user,
}) {
    return (
        <div
            className="p-1 min-w-[220px]"
            onClick={(event) => event.stopPropagation()}
            onMouseEnter={() => onKeepTooltipOpen(markerKey)}
            onMouseLeave={() => onScheduleTooltipClose(markerKey)}
        >
            <div className="flex items-start gap-3">
                {markerAsset?.logoUrl ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-white flex items-center justify-center p-1 flex-shrink-0">
                        <img src={markerAsset.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                        {resource.asset_type === 'hard' ? 'PL' : 'OF'}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-sm leading-tight">{resource.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{resource.category || resource.asset_type}</div>
                    {resource.asset_type === 'soft' && (
                        <div className="text-xs text-slate-500 mt-1">
                            Available in {locationCount} {locationCount === 1 ? 'place' : 'places'}
                        </div>
                    )}
                </div>
                {user && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onKeepTooltipOpen(markerKey);
                            onToggleFavorite(resource.id, resource.asset_type);
                        }}
                        className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                        aria-label={markerFavorite ? 'Remove favorite' : 'Add favorite'}
                    >
                        <Heart size={16} className={markerFavorite ? 'fill-red-500 text-red-500' : 'text-slate-400'} />
                    </button>
                )}
            </div>
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onKeepTooltipOpen(markerKey);
                    onViewDetails(markerAsset, markerAsset._markerLocation);
                }}
                className="mt-3 text-xs font-bold text-brand-600 hover:underline"
            >
                View details
            </button>
        </div>
    );
}

export function DiscoveryMap({
    activeTooltipKey,
    bottomOffsetPx,
    enrichedMapLocations,
    flyTarget,
    isFavorite,
    onKeepTooltipOpen,
    onScheduleTooltipClose,
    onSelectAsset,
    onToggleFavorite,
    onViewDetails,
    selectedMarkerKey,
    subCatColors,
    user,
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
            {userLocation && (
                <Marker position={[userLocation.lat, userLocation.lng]} icon={createUserLocationIcon()}>
                    <Popup><div className="p-1 font-bold text-sm">Your Search Location</div></Popup>
                </Marker>
            )}
            <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
                {enrichedMapLocations.map((resource) => {
                    const markerKey = buildMarkerKey(resource);
                    const isLocationSelected = selectedMarkerKey === markerKey;
                    const markerAsset = resource.asset?._type ? resource.asset : { ...resource.asset, _type: resource.asset_type };
                    const markerFavorite = isFavorite(resource.id, resource.asset_type);
                    const locationCount = markerAsset?._type === 'soft' ? getAssetLocations(markerAsset).length : 1;
                    const markerLocation = findLocationForMarker(markerAsset, resource) || {
                        id: resource.locationId,
                        lat: resource.lat,
                        lng: resource.lng,
                    };
                    const assetWithMarkerLocation = { ...markerAsset, _markerLocation: markerLocation };

                    return (
                        <Marker
                            key={markerKey}
                            position={[parseFloat(resource.lat), parseFloat(resource.lng)]}
                            icon={createColoredIcon(isLocationSelected ? '#0b6d70' : (subCatColors[resource.category] || '#64748b'), markerFavorite)}
                            eventHandlers={{
                                click: () => {
                                    onSelectAsset(assetWithMarkerLocation, markerLocation);
                                    onKeepTooltipOpen(markerKey);
                                },
                                mouseover: () => onKeepTooltipOpen(markerKey),
                                mouseout: () => onScheduleTooltipClose(markerKey),
                            }}
                        >
                            {activeTooltipKey === markerKey && (
                                <Tooltip direction="top" offset={[0, -26]} opacity={1} interactive permanent className="custom-popup">
                                    <MarkerTooltipCard
                                        markerAsset={assetWithMarkerLocation}
                                        markerFavorite={markerFavorite}
                                        markerKey={markerKey}
                                        locationCount={locationCount}
                                        onKeepTooltipOpen={onKeepTooltipOpen}
                                        onScheduleTooltipClose={onScheduleTooltipClose}
                                        onToggleFavorite={onToggleFavorite}
                                        onViewDetails={onViewDetails}
                                        resource={resource}
                                        user={user}
                                    />
                                </Tooltip>
                            )}
                            <Popup className="custom-popup">
                                <div className="p-1 min-w-[180px]">
                                    <h3 className="font-bold text-slate-900 text-sm leading-tight mb-1">{resource.title}</h3>
                                    <p className="text-xs text-slate-600 mb-2">{resource.category || resource.asset_type}</p>
                                    <div
                                        className="text-xs font-bold text-brand-700 cursor-pointer"
                                        onClick={() => onViewDetails(assetWithMarkerLocation, markerLocation)}
                                    >
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
}
