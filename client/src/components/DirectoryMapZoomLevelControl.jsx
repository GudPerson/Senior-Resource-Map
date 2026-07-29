import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

import { shouldCenterDirectoryMapAtMinimumZoom } from '../lib/directoryMapCamera.js';
import { resolveFixedTownDisplayZoomStep } from '../lib/fixedTownSurface.js';

export default function DirectoryMapZoomLevelControl({
    enabled = false,
    minZoom,
    minimumZoomCenter = null,
    lockAtMinimumZoom = false,
    preserveContainmentStep = false,
}) {
    const map = useMap();

    useEffect(() => {
        if (!enabled) return undefined;

        const zoomControlContainer = map.zoomControl?.getContainer?.();
        const counter = zoomControlContainer
            ? L.DomUtil.create(
                'div',
                'carearound-map-zoom-level flex h-[22px] min-w-[30px] select-none items-center justify-center rounded-t-[4px] border-b border-slate-300 bg-white text-[10px] font-extrabold tabular-nums leading-none text-slate-500 lg:h-6 lg:min-w-[32px] lg:text-[10px]',
            )
            : null;
        const zoomInButton = zoomControlContainer?.querySelector('.leaflet-control-zoom-in') || null;
        const previousZoomInRadii = zoomInButton ? {
            topLeft: zoomInButton.style.borderTopLeftRadius,
            topRight: zoomInButton.style.borderTopRightRadius,
        } : null;
        let previousSettledZoom = Number(map.getZoom());
        let draggingDisabledByLock = false;
        let minimumCenterCorrectionInProgress = false;
        const minimumCenter = Array.isArray(minimumZoomCenter)
            && minimumZoomCenter.length === 2
            && minimumZoomCenter.every((value) => Number.isFinite(Number(value)))
            ? {
                lat: Number(minimumZoomCenter[0]),
                lng: Number(minimumZoomCenter[1]),
            }
            : null;

        if (counter && zoomControlContainer) {
            counter.setAttribute('role', 'status');
            counter.setAttribute('aria-live', 'polite');
            counter.setAttribute('data-map-zoom-level', 'true');
            counter.title = 'Current zoom level';
            L.DomEvent.disableClickPropagation(counter);
            L.DomEvent.disableScrollPropagation(counter);
            zoomControlContainer.insertBefore(counter, zoomControlContainer.firstChild);
            if (zoomInButton) {
                zoomInButton.style.borderTopLeftRadius = '0';
                zoomInButton.style.borderTopRightRadius = '0';
            }
        }

        const updateCounter = () => {
            if (!counter) return;
            const zoomLevel = resolveFixedTownDisplayZoomStep({
                zoom: map.getZoom(),
                preserveContainmentStep,
            });
            counter.textContent = Number.isFinite(zoomLevel) ? String(zoomLevel) : '—';
            counter.setAttribute(
                'aria-label',
                Number.isFinite(zoomLevel) ? `Zoom level ${zoomLevel}` : 'Zoom level unavailable',
            );
        };
        const isAtMinimumZoom = () => {
            const currentZoom = Number(map.getZoom());
            const minimum = Number(minZoom);
            return Number.isFinite(currentZoom)
                && Number.isFinite(minimum)
                && currentZoom <= minimum;
        };
        const restoreDragging = () => {
            if (!draggingDisabledByLock) return;
            map.dragging?.enable?.();
            draggingDisabledByLock = false;
        };
        const centerMinimumZoomCamera = () => {
            if (!minimumCenter || minimumCenterCorrectionInProgress) return;
            const currentCenter = map.getCenter();
            const zoom = map.getZoom();
            const currentCenterPoint = map.project(currentCenter, zoom);
            const minimumCenterPoint = map.project([minimumCenter.lat, minimumCenter.lng], zoom);
            const isAlreadyCentered = currentCenterPoint.distanceTo(minimumCenterPoint) <= 1;
            if (!isAlreadyCentered) {
                minimumCenterCorrectionInProgress = true;
                try {
                    map.panTo([minimumCenter.lat, minimumCenter.lng], { animate: false });
                } finally {
                    minimumCenterCorrectionInProgress = false;
                }
            }
        };
        const syncMinimumZoomLock = () => {
            if (!lockAtMinimumZoom || !minimumCenter || !isAtMinimumZoom()) {
                restoreDragging();
                return;
            }
            if (map.dragging?.enabled?.()) {
                map.dragging.disable();
                draggingDisabledByLock = true;
            }
            centerMinimumZoomCamera();
        };
        const handleZoomEnd = () => {
            const currentZoom = Number(map.getZoom());
            updateCounter();
            if (!lockAtMinimumZoom && shouldCenterDirectoryMapAtMinimumZoom({
                previousZoom: previousSettledZoom,
                currentZoom,
                minZoom,
            }) && minimumCenter) {
                map.panTo(minimumZoomCenter, { animate: false });
            }
            syncMinimumZoomLock();
            previousSettledZoom = currentZoom;
        };
        const handleMoveEnd = () => {
            if (lockAtMinimumZoom && isAtMinimumZoom()) {
                centerMinimumZoomCamera();
            }
        };

        updateCounter();
        syncMinimumZoomLock();
        map.on('zoom', updateCounter);
        map.on('zoomend', handleZoomEnd);
        map.on('moveend', handleMoveEnd);

        return () => {
            map.off('zoom', updateCounter);
            map.off('zoomend', handleZoomEnd);
            map.off('moveend', handleMoveEnd);
            restoreDragging();
            counter?.remove();
            if (zoomInButton && previousZoomInRadii) {
                zoomInButton.style.borderTopLeftRadius = previousZoomInRadii.topLeft;
                zoomInButton.style.borderTopRightRadius = previousZoomInRadii.topRight;
            }
        };
    }, [enabled, lockAtMinimumZoom, map, minZoom, minimumZoomCenter, preserveContainmentStep]);

    return null;
}
