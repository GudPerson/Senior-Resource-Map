import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { createSavedPlacePinIcon } from '../features/discover/discoverUtils.js';

const DEFAULT_CENTER = [1.3521, 103.8198];
const DEFAULT_ZOOM = 11;

function getBounds(points) {
    return L.latLngBounds(points.map((point) => [point.lat, point.lng]));
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function createDirectoryNumberMarker(number) {
    return L.divIcon({
        className: '',
        html: `
            <div style="position:relative;width:40px;height:40px;pointer-events:none;">
                <div style="position:absolute;left:50%;top:50%;width:40px;height:40px;transform:translate(-50%,-50%);border-radius:999px;background:#0f766e;border:4px solid #ffffff;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;line-height:1;box-shadow:0 12px 24px rgba(15,118,110,0.28);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                    ${escapeHtml(number)}
                </div>
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -18],
        tooltipAnchor: [0, -18],
    });
}

function DirectoryMapController({ pins, focusedPlaceKey, markerRefs, interactive, onMapSettled }) {
    const map = useMap();
    const previousSignatureRef = useRef('');

    const signature = useMemo(
        () => pins.map((pin) => `${pin.placeKey}:${pin.lat}:${pin.lng}:${pin.curatedCount}`).join('|'),
        [pins]
    );

    useEffect(() => {
        window.setTimeout(() => {
            map.invalidateSize({ animate: false });
        }, 0);
    }, [map, signature]);

    useEffect(() => {
        if (!pins.length) return;
        if (previousSignatureRef.current === signature) return;
        previousSignatureRef.current = signature;

        if (pins.length === 1) {
            map.setView([pins[0].lat, pins[0].lng], 16, { animate: false });
            window.setTimeout(() => onMapSettled?.(), 250);
            return;
        }

        map.fitBounds(getBounds(pins), {
            paddingTopLeft: [28, 28],
            paddingBottomRight: [28, 28],
            maxZoom: 16,
            animate: false,
        });
        window.setTimeout(() => onMapSettled?.(), 250);
    }, [map, onMapSettled, pins, signature]);

    useEffect(() => {
        if (!focusedPlaceKey) return;
        if (!interactive) return;
        const pin = pins.find((item) => item.placeKey === focusedPlaceKey);
        if (!pin) return;

        map.flyTo([pin.lat, pin.lng], Math.max(map.getZoom(), 17), {
            animate: true,
            duration: 0.5,
        });
        window.setTimeout(() => {
            markerRefs.current[pin.placeKey]?.openPopup();
        }, 220);
    }, [focusedPlaceKey, interactive, map, markerRefs, pins]);

    useEffect(() => {
        if (!interactive) {
            map.closePopup();
        }
    }, [interactive, map]);

    return null;
}

function PopupPreview({ pin, onViewSection }) {
    return (
        <div className="w-[220px] space-y-3">
            <div>
                <p className="text-sm font-bold text-slate-900">{pin.title}</p>
                {pin.address ? (
                    <p className="mt-1 text-xs leading-5 text-slate-500">{pin.address}</p>
                ) : null}
            </div>

            <div className="inline-flex rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                {pin.curatedCount} {pin.curatedCount === 1 ? 'selected resource' : 'selected resources'}
            </div>

            <div className="space-y-1.5">
                {pin.previewResourceNames.map((name) => (
                    <p key={name} className="text-sm text-slate-700">
                        {name}
                    </p>
                ))}
                {pin.hiddenPreviewCount > 0 ? (
                    <p className="text-xs font-medium text-slate-400">
                        +{pin.hiddenPreviewCount} more in this directory
                    </p>
                ) : null}
            </div>

            <button
                type="button"
                onClick={() => onViewSection?.(pin.placeKey)}
                className="inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
                View section
            </button>
        </div>
    );
}

export default function DirectoryMap({
    pins = [],
    focusedPlaceKey = null,
    onViewSection,
    interactive = true,
    className = '',
    emptyLabel = 'This directory does not have any mappable places yet.',
    markerMode = 'count',
    placeNumberByKey = null,
    showPopup = true,
    showZoomControl = interactive,
    showAttribution = true,
    mapHeightClassName = 'h-[340px]',
    onMapReadyForCapture,
}) {
    const markerRefs = useRef({});
    const hasReportedReadyRef = useRef(false);
    const mapSettledRef = useRef(false);
    const tileLoadedRef = useRef(false);
    const readyTimeoutRef = useRef(null);

    const notifyReady = useMemo(() => () => {
        if (hasReportedReadyRef.current) return;
        hasReportedReadyRef.current = true;
        if (readyTimeoutRef.current) {
            window.clearTimeout(readyTimeoutRef.current);
            readyTimeoutRef.current = null;
        }
        onMapReadyForCapture?.();
    }, [onMapReadyForCapture]);

    const tryNotifyReady = useMemo(() => () => {
        if (hasReportedReadyRef.current) return;
        if (!mapSettledRef.current) return;
        if (!tileLoadedRef.current) return;
        notifyReady();
    }, [notifyReady]);

    useEffect(() => {
        hasReportedReadyRef.current = false;
        mapSettledRef.current = false;
        tileLoadedRef.current = false;
        if (readyTimeoutRef.current) {
            window.clearTimeout(readyTimeoutRef.current);
        }
        if (!onMapReadyForCapture) return undefined;

        readyTimeoutRef.current = window.setTimeout(() => {
            notifyReady();
        }, 1500);

        return () => {
            if (readyTimeoutRef.current) {
                window.clearTimeout(readyTimeoutRef.current);
                readyTimeoutRef.current = null;
            }
        };
    }, [notifyReady, onMapReadyForCapture, pins, markerMode, placeNumberByKey]);

    if (!pins.length) {
        return (
            <div className={`rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500 ${className}`}>
                {emptyLabel}
            </div>
        );
    }

    return (
        <div className={`overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm ${className}`}>
            <MapContainer
                center={DEFAULT_CENTER}
                zoom={DEFAULT_ZOOM}
                scrollWheelZoom={false}
                dragging={interactive}
                touchZoom={interactive}
                doubleClickZoom={interactive}
                boxZoom={interactive}
                keyboard={interactive}
                zoomControl={showZoomControl}
                className={`${mapHeightClassName} w-full ${interactive ? '' : 'pointer-events-none'}`}
                attributionControl={showAttribution}
            >
                <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    eventHandlers={onMapReadyForCapture ? {
                        load: () => {
                            tileLoadedRef.current = true;
                            tryNotifyReady();
                        },
                    } : undefined}
                />
                <DirectoryMapController
                    pins={pins}
                    focusedPlaceKey={focusedPlaceKey}
                    markerRefs={markerRefs}
                    interactive={interactive}
                    onMapSettled={onMapReadyForCapture ? () => {
                        mapSettledRef.current = true;
                        tryNotifyReady();
                    } : undefined}
                />
                {pins.map((pin) => {
                    const icon = markerMode === 'number'
                        ? createDirectoryNumberMarker(placeNumberByKey?.[pin.placeKey] || '?')
                        : createSavedPlacePinIcon({
                            count: pin.curatedCount,
                            emphasis: focusedPlaceKey === pin.placeKey ? 'primary' : 'default',
                            tone: 'saved',
                        });

                    return (
                        <Marker
                            key={pin.pinKey}
                            position={[pin.lat, pin.lng]}
                            icon={icon}
                            ref={(instance) => {
                                if (instance) {
                                    markerRefs.current[pin.placeKey] = instance;
                                }
                            }}
                        >
                            {interactive && showPopup ? (
                                <Popup autoPan className="directory-map-popup">
                                    <PopupPreview pin={pin} onViewSection={onViewSection} />
                                </Popup>
                            ) : null}
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
