import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    AlertTriangle,
    CheckCircle2,
    FileDown,
    ImageDown,
    LoaderCircle,
    RefreshCw,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';

import MapDirectoryExportPanel from './MapDirectoryExportPanel.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { downloadPrintMapPdf } from '../lib/printMapPdf.js';
import {
    PRINT_MAP_CANVAS_WIDTH_PX,
    PRINT_MAP_QUALITY_HIGH,
    buildPrintMapCaptureKey,
    getPrintMapExportConfig,
    normalizePrintMapQuality,
    shouldExportPrintMapAsSeparatePages,
} from '../lib/printMapState.js';
import { getPrintAnnotationCaptureKey } from '../lib/printAnnotations.js';

const TRANSPARENT_IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const MAP_CAPTURE_RETRY_DELAY_MS = 750;
const MAP_CAPTURE_BLANK_SAMPLE_SIZE = 96;
const MAP_CAPTURE_BLANK_MAX_AVERAGE_DISTANCE = 3;
const MAP_CAPTURE_BLANK_MAX_CHANNEL_RANGE = 24;
const MAP_READINESS_PROBE_MAX_ATTEMPTS = 4;
const MAP_READINESS_PROBE_RETRY_DELAY_MS = 900;
const MAP_READINESS_PROBE_CANVAS_WIDTH = 320;
const MemoizedMapDirectoryExportPanel = memo(MapDirectoryExportPanel);

function buildFileName(directoryName, pageName = 'summary') {
    const slug = String(directoryName || 'carearound-directory')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `${slug || 'carearound-directory'}-${pageName}.png`;
}

function getExportNodeDimensions(node) {
    return {
        width: Math.max(
            Math.ceil(node.scrollWidth),
            Math.ceil(node.getBoundingClientRect().width),
        ),
        height: Math.max(
            Math.ceil(node.scrollHeight),
            Math.ceil(node.getBoundingClientRect().height),
        ),
    };
}

function delay(ms) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function waitForPaintStabilization(frameCount = 3) {
    return new Promise((resolve) => {
        const tick = (remaining) => {
            if (remaining <= 0) {
                resolve();
                return;
            }
            window.requestAnimationFrame(() => tick(remaining - 1));
        };
        tick(frameCount);
    });
}

async function loadCaptureImage(dataUrl) {
    try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        if (typeof createImageBitmap === 'function') {
            const bitmap = await createImageBitmap(blob);
            return { image: bitmap, close: () => bitmap.close?.() };
        }
    } catch {
        // Fall back to a normal image element below.
    }

    const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = dataUrl;
    });
    return { image, close: () => {} };
}

async function isMapCaptureVisiblyBlank({ dataUrl, pageNode, mapFrameNode }) {
    if (!dataUrl || !pageNode || !mapFrameNode) return false;

    const pageRect = pageNode.getBoundingClientRect();
    const mapRect = mapFrameNode.getBoundingClientRect();
    if (!pageRect.width || !pageRect.height || !mapRect.width || !mapRect.height) return false;

    const captureImage = await loadCaptureImage(dataUrl);
    const sampleCanvas = document.createElement('canvas');
    const sampleWidth = MAP_CAPTURE_BLANK_SAMPLE_SIZE;
    const sampleHeight = MAP_CAPTURE_BLANK_SAMPLE_SIZE;
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    const context = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
        captureImage.close?.();
        return false;
    }

    const imageWidth = Number(captureImage.image.width) || 1;
    const imageHeight = Number(captureImage.image.height) || 1;
    const scaleX = imageWidth / pageRect.width;
    const scaleY = imageHeight / pageRect.height;
    const insetX = Math.min(mapRect.width * 0.08, 32);
    const insetY = Math.min(mapRect.height * 0.08, 32);
    const sourceX = Math.max(0, (mapRect.left - pageRect.left + insetX) * scaleX);
    const sourceY = Math.max(0, (mapRect.top - pageRect.top + insetY) * scaleY);
    const sourceWidth = Math.max(1, (mapRect.width - (insetX * 2)) * scaleX);
    const sourceHeight = Math.max(1, (mapRect.height - (insetY * 2)) * scaleY);

    try {
        context.drawImage(
            captureImage.image,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            sampleWidth,
            sampleHeight,
        );
        const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
        let count = 0;
        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let minR = 255;
        let minG = 255;
        let minB = 255;
        let maxR = 0;
        let maxG = 0;
        let maxB = 0;
        for (let index = 0; index < pixels.length; index += 4) {
            const alpha = pixels[index + 3];
            if (alpha < 20) continue;
            const r = pixels[index];
            const g = pixels[index + 1];
            const b = pixels[index + 2];
            totalR += r;
            totalG += g;
            totalB += b;
            minR = Math.min(minR, r);
            minG = Math.min(minG, g);
            minB = Math.min(minB, b);
            maxR = Math.max(maxR, r);
            maxG = Math.max(maxG, g);
            maxB = Math.max(maxB, b);
            count += 1;
        }
        if (!count) return true;

        const averageR = totalR / count;
        const averageG = totalG / count;
        const averageB = totalB / count;
        let totalDistance = 0;
        for (let index = 0; index < pixels.length; index += 4) {
            const alpha = pixels[index + 3];
            if (alpha < 20) continue;
            totalDistance += (
                Math.abs(pixels[index] - averageR)
                + Math.abs(pixels[index + 1] - averageG)
                + Math.abs(pixels[index + 2] - averageB)
            ) / 3;
        }

        const averageDistance = totalDistance / count;
        const channelRange = Math.max(maxR - minR, maxG - minG, maxB - minB);
        return averageDistance <= MAP_CAPTURE_BLANK_MAX_AVERAGE_DISTANCE
            && channelRange <= MAP_CAPTURE_BLANK_MAX_CHANNEL_RANGE;
    } finally {
        captureImage.close?.();
    }
}

async function savePngDataUrl(dataUrl, fileName) {
    try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        saveAs(blob, fileName);
    } catch {
        saveAs(dataUrl, fileName);
    }
}

export default function MapImageExportButton({
    directory,
    activeAnchor = null,
    shareUrl = '',
    className = '',
    printMapState = null,
    fixedTownSurfaceManifest = null,
    fixedTownAssetBaseUrl = '',
    fixedTownSurfaceAvailable = false,
    fixedTownSurfacePending = false,
    fixedTownSurfaceMinZoom,
    fixedTownOverviewSurfaceManifest = null,
    fixedTownOverviewAssetBaseUrl = '',
    fixedTownOverviewSurfaceAvailable = false,
    fixedTownOverviewSurfacePending = false,
    printAnnotations = [],
    deferPreparation = false,
    disabled = false,
}) {
    const { t } = useLocale();
    const exportRef = useRef(null);
    const exportReadyRef = useRef(false);
    const mapErrorRef = useRef(null);
    const mapViewportSnapshotRef = useRef(null);
    const readyWaitersRef = useRef([]);
    const exportNodeWaitersRef = useRef([]);
    const readinessGenerationRef = useRef(0);
    const [exportingFormat, setExportingFormat] = useState('');
    const [error, setError] = useState('');
    const [mapDownloadStatus, setMapDownloadStatus] = useState('preparing');
    const [mapDownloadProgress, setMapDownloadProgress] = useState(12);
    const [preparationAttempt, setPreparationAttempt] = useState(0);
    const [verifiedPreparationKey, setVerifiedPreparationKey] = useState('');
    const [preparedPrintAnnotations, setPreparedPrintAnnotations] = useState(
        () => printAnnotations,
    );
    const exportRoot = typeof document !== 'undefined' ? document.body : null;
    const exportWidth = PRINT_MAP_CANVAS_WIDTH_PX;
    const printMapCaptureKey = printMapState ? buildPrintMapCaptureKey(printMapState) : '';
    const printAnnotationCaptureKey = getPrintAnnotationCaptureKey(printAnnotations);
    const preparedPrintAnnotationCaptureKey = getPrintAnnotationCaptureKey(
        preparedPrintAnnotations,
    );
    const printMapQuality = normalizePrintMapQuality(printMapState?.mapQuality);
    const exportAsSeparatePages = shouldExportPrintMapAsSeparatePages(printMapState);
    const exporting = Boolean(exportingFormat);
    const exportPreparationKey = [
        directory?.id,
        directory?.summary?.resourceCount,
        directory?.updatedAt,
        activeAnchor?.address,
        activeAnchor?.kind,
        activeAnchor?.lat,
        activeAnchor?.lng,
        activeAnchor?.postalCode,
        printMapCaptureKey,
        preparedPrintAnnotationCaptureKey,
        shareUrl,
    ].map((value) => String(value ?? '')).join('|');
    const annotationPreparationPending = printAnnotationCaptureKey
        !== preparedPrintAnnotationCaptureKey;
    const mapDownloadReady = mapDownloadStatus === 'ready'
        && !annotationPreparationPending
        && verifiedPreparationKey === exportPreparationKey;

    const resetExportReadiness = useCallback(() => {
        readinessGenerationRef.current += 1;
        exportReadyRef.current = false;
        mapErrorRef.current = null;
        mapViewportSnapshotRef.current = null;
        readyWaitersRef.current = [];
        setVerifiedPreparationKey('');
        setMapDownloadStatus('preparing');
        setMapDownloadProgress(12);
        setError('');
    }, []);

    useEffect(() => {
        if (!annotationPreparationPending) return;
        if (deferPreparation) {
            resetExportReadiness();
            return;
        }
        setPreparedPrintAnnotations(printAnnotations);
    }, [
        annotationPreparationPending,
        deferPreparation,
        printAnnotationCaptureKey,
        printAnnotations,
        resetExportReadiness,
    ]);

    useEffect(() => {
        resetExportReadiness();
        setPreparationAttempt((current) => current + 1);
    }, [exportPreparationKey, resetExportReadiness]);

    useEffect(() => () => {
        readinessGenerationRef.current += 1;
    }, []);

    const handleExportNodeRef = useCallback((node) => {
        exportRef.current = node;
        if (!node) return;
        const waiters = exportNodeWaitersRef.current.splice(0);
        waiters.forEach(({ resolve }) => resolve(node));
    }, []);

    async function mountExportSurface(format) {
        setExportingFormat(format);
        if (exportRef.current) return exportRef.current;

        return new Promise((resolve, reject) => {
            const waiterEntry = {
                resolve: (node) => {
                    window.clearTimeout(waiterEntry.timeoutId);
                    resolve(node);
                },
                timeoutId: window.setTimeout(() => {
                    exportNodeWaitersRef.current = exportNodeWaitersRef.current
                        .filter((waiter) => waiter !== waiterEntry);
                    reject(new Error('Export failed because the print surface did not open.'));
                }, 2000),
            };
            exportNodeWaitersRef.current.push(waiterEntry);
        });
    }

    const verifyMapDownloadReadiness = useCallback(async () => {
        const readinessGeneration = readinessGenerationRef.current;
        setMapDownloadStatus('checking');
        setMapDownloadProgress(68);

        try {
            for (let attempt = 0; attempt < MAP_READINESS_PROBE_MAX_ATTEMPTS; attempt += 1) {
                if (readinessGeneration !== readinessGenerationRef.current) return;

                await waitForPaintStabilization(3);
                if (exportAsSeparatePages) {
                    const mapPageNode = exportRef.current?.querySelector('[data-print-export-page="map"]');
                    const resourcePageNode = exportRef.current?.querySelector('[data-print-export-page="resources"]');
                    if (!mapPageNode || !resourcePageNode) {
                        throw new Error('Map download preparation failed because one of the print pages is unavailable.');
                    }
                }
                const mapFrameNode = exportRef.current?.querySelector('[data-print-export-map-frame="true"]');
                if (!mapFrameNode) {
                    throw new Error('Map download preparation failed because the export map is unavailable.');
                }

                const { width, height } = getExportNodeDimensions(mapFrameNode);
                const probeScale = Math.min(1, MAP_READINESS_PROBE_CANVAS_WIDTH / width);
                const dataUrl = await toPng(mapFrameNode, {
                    cacheBust: true,
                    imagePlaceholder: TRANSPARENT_IMAGE_PLACEHOLDER,
                    pixelRatio: 1,
                    backgroundColor: '#ffffff',
                    width,
                    height,
                    canvasWidth: Math.max(1, Math.round(width * probeScale)),
                    canvasHeight: Math.max(1, Math.round(height * probeScale)),
                });
                const mapIsBlank = await isMapCaptureVisiblyBlank({
                    dataUrl,
                    pageNode: mapFrameNode,
                    mapFrameNode,
                });

                if (readinessGeneration !== readinessGenerationRef.current) return;
                if (!mapIsBlank) {
                    exportReadyRef.current = true;
                    mapErrorRef.current = null;
                    setVerifiedPreparationKey(exportPreparationKey);
                    setMapDownloadStatus('ready');
                    setMapDownloadProgress(100);
                    const waiters = readyWaitersRef.current.splice(0);
                    waiters.forEach(({ resolve }) => resolve());
                    return;
                }

                setMapDownloadProgress(76 + (attempt * 6));
                if (attempt < MAP_READINESS_PROBE_MAX_ATTEMPTS - 1) {
                    await delay(MAP_READINESS_PROBE_RETRY_DELAY_MS);
                }
            }

            throw new Error('Map download preparation did not produce a usable map image.');
        } catch (captureError) {
            if (readinessGeneration !== readinessGenerationRef.current) return;
            mapErrorRef.current = captureError;
            exportReadyRef.current = false;
            setVerifiedPreparationKey('');
            setMapDownloadStatus('error');
            setMapDownloadProgress(0);
            const waiters = readyWaitersRef.current.splice(0);
            waiters.forEach(({ reject }) => reject(captureError));
        }
    }, [exportAsSeparatePages, exportPreparationKey]);

    const handleMapReadyForCapture = useCallback(() => {
        void verifyMapDownloadReadiness();
    }, [verifyMapDownloadReadiness]);

    const handleMapCaptureError = useCallback((captureError) => {
        readinessGenerationRef.current += 1;
        mapErrorRef.current = captureError;
        exportReadyRef.current = false;
        setVerifiedPreparationKey('');
        setMapDownloadStatus('error');
        setMapDownloadProgress(0);
        const waiters = readyWaitersRef.current.splice(0);
        waiters.forEach(({ reject }) => reject(captureError));
    }, []);

    const handleMapViewportSnapshot = useCallback((snapshot) => {
        mapViewportSnapshotRef.current = snapshot;
    }, []);

    async function waitForExportSurface({ forceHighQuality = false, waitForMap = true } = {}) {
        if (document.fonts?.ready) {
            try {
                await document.fonts.ready;
            } catch {
                // Proceed even if the font readiness promise rejects.
            }
        }

        if (!waitForMap) {
            await waitForPaintStabilization(3);
            return;
        }

        if (mapErrorRef.current) {
            throw mapErrorRef.current;
        }

        if (!exportReadyRef.current) {
            await new Promise((resolve, reject) => {
                const timeoutId = window.setTimeout(() => {
                    readyWaitersRef.current = readyWaitersRef.current.filter((waiter) => waiter !== waiterEntry);
                    reject(new Error('Image export failed because the directory map did not finish loading.'));
                }, forceHighQuality || printMapQuality === PRINT_MAP_QUALITY_HIGH ? 12000 : 6500);

                const waiterEntry = {
                    resolve: () => {
                        window.clearTimeout(timeoutId);
                        resolve();
                    },
                    reject: (captureError) => {
                        window.clearTimeout(timeoutId);
                        reject(captureError);
                    },
                };

                readyWaitersRef.current.push(waiterEntry);

                if (mapErrorRef.current) {
                    window.clearTimeout(timeoutId);
                    readyWaitersRef.current = readyWaitersRef.current.filter((waiter) => waiter !== waiterEntry);
                    reject(mapErrorRef.current);
                }
            });
        }

        if (mapErrorRef.current) {
            throw mapErrorRef.current;
        }

        await waitForPaintStabilization(3);
    }

    function getExportPages(pageName = '') {
        const exportPages = exportAsSeparatePages
            ? [
                {
                    node: exportRef.current?.querySelector('[data-print-export-page="map"]'),
                    name: 'map',
                },
                {
                    node: exportRef.current?.querySelector('[data-print-export-page="resources"]'),
                    name: 'resources',
                },
            ]
            : [{ node: exportRef.current, name: 'summary' }];
        const selectedPages = pageName
            ? exportPages.filter((page) => page.name === pageName)
            : exportPages;

        if (!selectedPages.length || selectedPages.some(({ node }) => !node)) {
            throw new Error('Export failed because one of the print pages is not ready.');
        }
        return selectedPages;
    }

    async function capturePageToPng({ node, captureState, mapFrameNode }) {
        const { width, height } = getExportNodeDimensions(node);
        const exportConfig = getPrintMapExportConfig(captureState, { width, height });
        const dataUrl = await toPng(node, {
            cacheBust: Boolean(mapFrameNode),
            imagePlaceholder: TRANSPARENT_IMAGE_PLACEHOLDER,
            pixelRatio: exportConfig.pixelRatio,
            backgroundColor: '#ffffff',
            width,
            height,
            canvasWidth: Math.round(width * exportConfig.canvasScale),
            canvasHeight: Math.round(height * exportConfig.canvasScale),
        });

        return {
            dataUrl,
            width,
            height,
            outputScale: exportConfig.outputScale,
            outputWidth: Math.round(width * exportConfig.outputScale),
            outputHeight: Math.round(height * exportConfig.outputScale),
        };
    }

    async function captureExportPages({ forceHighQuality = false, pageName = '' } = {}) {
        const captureState = forceHighQuality
            ? { ...printMapState, mapQuality: PRINT_MAP_QUALITY_HIGH }
            : printMapState;
        const capturedPages = [];
        for (const { node, name } of getExportPages(pageName)) {
            const mapFrameNode = node.querySelector('[data-print-export-map-frame="true"]');
            let capture = await capturePageToPng({ node, captureState, mapFrameNode });
            if (mapFrameNode && await isMapCaptureVisiblyBlank({
                dataUrl: capture.dataUrl,
                pageNode: node,
                mapFrameNode,
            })) {
                await delay(MAP_CAPTURE_RETRY_DELAY_MS);
                await waitForPaintStabilization(3);
                capture = await capturePageToPng({ node, captureState, mapFrameNode });
                if (await isMapCaptureVisiblyBlank({
                    dataUrl: capture.dataUrl,
                    pageNode: node,
                    mapFrameNode,
                })) {
                    throw new Error('Image export failed because the map image was still blank. Wait for the map to finish loading and try again.');
                }
            }
            capturedPages.push({
                ...capture,
                name,
            });
        }
        return capturedPages;
    }

    async function handleImageExport(pageName = '') {
        const requiresMap = pageName !== 'resources';
        if (exporting) return;
        if (requiresMap && !mapDownloadReady) {
            setError(t('mapDownloadUnavailable'));
            return;
        }
        setError('');
        const exportFormat = pageName ? `${pageName}-image` : 'image';

        try {
            await mountExportSurface(exportFormat);
            await waitForExportSurface({ waitForMap: pageName !== 'resources' });
            const capturedPages = await captureExportPages({ pageName });
            for (const { dataUrl, name } of capturedPages) {
                await savePngDataUrl(dataUrl, buildFileName(directory?.name, name));
            }
        } catch (err) {
            console.error(err);
            setError(err?.message || 'Image export failed. Try again.');
        } finally {
            setExportingFormat('');
        }
    }

    async function handlePdfExport() {
        if (exporting) return;
        if (!mapDownloadReady) {
            setError(t('mapDownloadUnavailable'));
            return;
        }
        setError('');

        try {
            await mountExportSurface('pdf');
            await waitForExportSurface({ forceHighQuality: true });
            const pages = await captureExportPages({ forceHighQuality: true });
            await downloadPrintMapPdf({ pages, directoryName: directory?.name });
        } catch (err) {
            console.error(err);
            setError(err?.message || 'PDF export failed. Try again.');
        } finally {
            setExportingFormat('');
        }
    }

    function retryMapDownloadPreparation() {
        resetExportReadiness();
        setPreparationAttempt((current) => current + 1);
    }

    const mapDownloadStatusLabel = mapDownloadStatus === 'ready'
        ? t('mapDownloadReady')
        : mapDownloadStatus === 'checking'
            ? t('mapDownloadChecking')
            : mapDownloadStatus === 'error'
                ? t('mapDownloadUnavailable')
                : t('mapDownloadPreparing');

    return (
        <>
            {exportAsSeparatePages ? (
                <>
                    <button
                        type="button"
                        onClick={() => handleImageExport('resources')}
                        disabled={disabled || exporting}
                        data-print-export-quality={printMapQuality}
                        data-print-export-page-action="resources"
                        className={`btn-ghost justify-center border border-slate-200 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
                    >
                        <ImageDown size={16} />
                        {exportingFormat === 'resources-image' ? t('exporting') : t('saveResourcePng')}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleImageExport('map')}
                        disabled={disabled || exporting || !mapDownloadReady}
                        aria-describedby="map-download-readiness"
                        data-print-export-quality={printMapQuality}
                        data-print-export-page-action="map"
                        className={`btn-ghost justify-center border border-slate-200 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
                    >
                        <ImageDown size={16} />
                        {exportingFormat === 'map-image' ? t('exporting') : t('saveMapPng')}
                    </button>
                </>
            ) : (
                <button
                    type="button"
                    onClick={() => handleImageExport()}
                    disabled={disabled || exporting || !mapDownloadReady}
                    aria-describedby="map-download-readiness"
                    data-print-export-quality={printMapQuality}
                    className={`btn-ghost justify-center border border-slate-200 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
                >
                    <ImageDown size={16} />
                    {exportingFormat === 'image' ? t('exporting') : t('saveAsImage')}
                </button>
            )}
            <button
                type="button"
                onClick={handlePdfExport}
                disabled={disabled || exporting || !mapDownloadReady}
                aria-describedby="map-download-readiness"
                data-print-pdf-export="a3"
                className={`btn-ghost justify-center border border-slate-200 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            >
                <FileDown size={16} />
                {exportingFormat === 'pdf' ? t('preparingPdf') : t('savePrintPdf')}
            </button>
            <div
                id="map-download-readiness"
                role="status"
                aria-live="polite"
                data-print-export-readiness={mapDownloadStatus}
                className={`col-span-2 flex min-h-11 min-w-0 items-center gap-2 rounded border px-3 py-2 text-xs font-semibold sm:w-auto sm:min-w-[220px] ${
                    mapDownloadStatus === 'ready'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : mapDownloadStatus === 'error'
                            ? 'border-amber-200 bg-amber-50 text-amber-900'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
            >
                {mapDownloadStatus === 'ready' ? (
                    <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
                ) : mapDownloadStatus === 'error' ? (
                    <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
                ) : (
                    <LoaderCircle size={16} className="shrink-0 animate-spin" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                    <span className="block leading-4">{mapDownloadStatusLabel}</span>
                    {mapDownloadStatus === 'preparing' || mapDownloadStatus === 'checking' ? (
                        <span
                            role="progressbar"
                            aria-label={mapDownloadStatusLabel}
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-valuenow={mapDownloadProgress}
                            className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
                        >
                            <span
                                className="block h-full rounded-full bg-brand-600 transition-[width] duration-300"
                                style={{ width: `${mapDownloadProgress}%` }}
                            />
                        </span>
                    ) : null}
                </div>
                {mapDownloadStatus === 'error' ? (
                    <button
                        type="button"
                        onClick={retryMapDownloadPreparation}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                        aria-label={t('retryMapDownloadPreparation')}
                        title={t('retryMapDownloadPreparation')}
                    >
                        <RefreshCw size={15} aria-hidden="true" />
                    </button>
                ) : null}
            </div>
            {error ? (
                <p className="col-span-2 text-sm font-medium text-red-600">{error}</p>
            ) : null}

            {exportRoot ? createPortal(
                <div
                    className="pointer-events-none fixed left-0 top-0 overflow-visible p-8"
                    style={{ zIndex: -1, opacity: 0.01 }}
                    aria-hidden="true"
                >
                    <div ref={handleExportNodeRef}>
                        <MemoizedMapDirectoryExportPanel
                            key={`${exportPreparationKey}:${preparationAttempt}`}
                            directory={directory}
                            activeAnchor={activeAnchor}
                            shareUrl={shareUrl}
                            exportWidth={exportWidth}
                            onMapReadyForCapture={handleMapReadyForCapture}
                            onMapCaptureError={handleMapCaptureError}
                            onMapViewportSnapshot={handleMapViewportSnapshot}
                            printMapState={printMapState}
                            fixedTownSurfaceManifest={fixedTownSurfaceManifest}
                            fixedTownAssetBaseUrl={fixedTownAssetBaseUrl}
                            fixedTownSurfaceAvailable={fixedTownSurfaceAvailable}
                            fixedTownSurfacePending={fixedTownSurfacePending}
                            fixedTownSurfaceMinZoom={fixedTownSurfaceMinZoom}
                            fixedTownOverviewSurfaceManifest={fixedTownOverviewSurfaceManifest}
                            fixedTownOverviewAssetBaseUrl={fixedTownOverviewAssetBaseUrl}
                            fixedTownOverviewSurfaceAvailable={fixedTownOverviewSurfaceAvailable}
                            fixedTownOverviewSurfacePending={fixedTownOverviewSurfacePending}
                            printAnnotations={preparedPrintAnnotations}
                        />
                    </div>
                </div>
                ,
                exportRoot,
            ) : null}
        </>
    );
}
