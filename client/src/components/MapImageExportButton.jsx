import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileDown, ImageDown } from 'lucide-react';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';

import MapDirectoryExportPanel from './MapDirectoryExportPanel.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { upgradeCapturedPageWithPrintMaster } from '../lib/printMasterExport.js';
import {
    fetchPrintMasterManifest,
    normalizePrintMasterAssetBaseUrl,
    resolveFixedTownSurfaceId,
} from '../lib/printMasterSurface.js';
import { downloadPrintMapPdf } from '../lib/printMapPdf.js';
import {
    PRINT_MAP_CANVAS_WIDTH_PX,
    PRINT_MAP_QUALITY_HIGH,
    buildPrintMapCaptureKey,
    getPrintMapExportConfig,
    normalizePrintMapQuality,
    shouldExportPrintMapAsSeparatePages,
} from '../lib/printMapState.js';

const TRANSPARENT_IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const PRINT_MASTER_ASSET_BASE_URLS = {
    default: normalizePrintMasterAssetBaseUrl(import.meta.env.VITE_TOWN_MAP_PRINT_MASTER_ASSET_BASE_URL || ''),
    gray: normalizePrintMasterAssetBaseUrl(import.meta.env.VITE_TOWN_MAP_GRAY_PRINT_MASTER_ASSET_BASE_URL || ''),
};

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
}) {
    const { t } = useLocale();
    const exportRef = useRef(null);
    const exportReadyRef = useRef(false);
    const mapErrorRef = useRef(null);
    const mapViewportSnapshotRef = useRef(null);
    const readyWaitersRef = useRef([]);
    const [exportingFormat, setExportingFormat] = useState('');
    const [exportProgress, setExportProgress] = useState('');
    const [error, setError] = useState('');
    const exportRoot = typeof document !== 'undefined' ? document.body : null;
    const exportWidth = PRINT_MAP_CANVAS_WIDTH_PX;
    const printMapCaptureKey = printMapState ? buildPrintMapCaptureKey(printMapState) : '';
    const printMapQuality = normalizePrintMapQuality(printMapState?.mapQuality);
    const exportAsSeparatePages = shouldExportPrintMapAsSeparatePages(printMapState);
    const printMasterConfigured = Boolean(
        PRINT_MASTER_ASSET_BASE_URLS[printMapState?.mapStyle === 'gray' ? 'gray' : 'default'],
    );
    const exporting = Boolean(exportingFormat);

    useEffect(() => {
        exportReadyRef.current = false;
        mapErrorRef.current = null;
        mapViewportSnapshotRef.current = null;
        readyWaitersRef.current = [];
    }, [
        activeAnchor?.address,
        activeAnchor?.kind,
        activeAnchor?.lat,
        activeAnchor?.lng,
        activeAnchor?.postalCode,
        directory?.id,
        directory?.summary?.resourceCount,
        directory?.updatedAt,
        printMapCaptureKey,
        shareUrl,
    ]);

    const handleMapReadyForCapture = useCallback(() => {
        exportReadyRef.current = true;
        mapErrorRef.current = null;
        const waiters = readyWaitersRef.current.splice(0);
        waiters.forEach(({ resolve }) => resolve());
    }, []);

    const handleMapCaptureError = useCallback((captureError) => {
        mapErrorRef.current = captureError;
        exportReadyRef.current = false;
        const waiters = readyWaitersRef.current.splice(0);
        waiters.forEach(({ reject }) => reject(captureError));
    }, []);

    const handleMapViewportSnapshot = useCallback((snapshot) => {
        mapViewportSnapshotRef.current = snapshot;
    }, []);

    async function waitForExportSurface({ forceHighQuality = false } = {}) {
        if (document.fonts?.ready) {
            try {
                await document.fonts.ready;
            } catch {
                // Proceed even if the font readiness promise rejects.
            }
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

        await new Promise((resolve) => {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(resolve);
            });
        });
    }

    function getExportPages() {
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

        if (exportPages.some(({ node }) => !node)) {
            throw new Error('Export failed because one of the print pages is not ready.');
        }
        return exportPages;
    }

    async function captureExportPages({ forceHighQuality = false, printMaster = null } = {}) {
        const captureState = forceHighQuality
            ? { ...printMapState, mapQuality: PRINT_MAP_QUALITY_HIGH }
            : printMapState;
        const capturedPages = [];
        for (const { node, name } of getExportPages()) {
            const { width, height } = getExportNodeDimensions(node);
            const exportConfig = getPrintMapExportConfig(captureState, { width, height });
            const dataUrl = await toPng(node, {
                cacheBust: false,
                imagePlaceholder: TRANSPARENT_IMAGE_PLACEHOLDER,
                pixelRatio: exportConfig.pixelRatio,
                backgroundColor: '#ffffff',
                width,
                height,
                canvasWidth: Math.round(width * exportConfig.canvasScale),
                canvasHeight: Math.round(height * exportConfig.canvasScale),
            });
            const capture = {
                dataUrl,
                width,
                height,
                name,
                outputScale: exportConfig.outputScale,
                outputWidth: Math.round(width * exportConfig.outputScale),
                outputHeight: Math.round(height * exportConfig.outputScale),
            };
            const mapFrameNode = printMaster
                ? node.querySelector('[data-print-export-map-frame="true"]')
                : null;
            capturedPages.push(mapFrameNode ? await upgradeCapturedPageWithPrintMaster({
                capture,
                pageNode: node,
                mapFrameNode,
                viewportBounds: mapViewportSnapshotRef.current?.bounds,
                manifest: printMaster.manifest,
                assetBaseUrl: printMaster.assetBaseUrl,
                onProgress: ({ completed, total }) => {
                    setExportProgress(t('printMasterProgress', { completed, total }));
                },
            }) : capture);
        }
        return capturedPages;
    }

    async function preparePrintMaster() {
        if (printMapState?.basemapMode !== 'auto') {
            throw new Error(t('printMasterDetailedRequired'));
        }
        const surfaceId = resolveFixedTownSurfaceId(fixedTownSurfaceManifest);
        if (!fixedTownSurfaceAvailable || !surfaceId) {
            throw new Error(t('printMasterAreaUnavailable'));
        }
        if (!mapViewportSnapshotRef.current?.bounds) {
            throw new Error(t('printMasterViewUnavailable'));
        }
        const mapStyle = printMapState?.mapStyle === 'gray' ? 'gray' : 'default';
        const assetBaseUrl = PRINT_MASTER_ASSET_BASE_URLS[mapStyle];
        setExportProgress(t('printMasterLoadingManifest'));
        const manifest = await fetchPrintMasterManifest({
            assetBaseUrl,
            surfaceId,
            mapStyle,
        });
        return { assetBaseUrl, manifest };
    }

    async function handleImageExport() {
        if (!exportRef.current || exporting) return;
        setExportingFormat('image');
        setExportProgress('');
        setError('');

        try {
            await waitForExportSurface();
            const capturedPages = await captureExportPages();
            capturedPages.forEach(({ dataUrl, name }) => {
                saveAs(dataUrl, buildFileName(directory?.name, name));
            });
        } catch (err) {
            console.error(err);
            setError(err?.message || 'Image export failed. Try again.');
        } finally {
            setExportingFormat('');
            setExportProgress('');
        }
    }

    async function handlePdfExport() {
        if (!exportRef.current || exporting) return;
        setExportingFormat('pdf');
        setExportProgress('');
        setError('');

        try {
            await waitForExportSurface({ forceHighQuality: true });
            const pages = await captureExportPages({ forceHighQuality: true });
            await downloadPrintMapPdf({ pages, directoryName: directory?.name });
        } catch (err) {
            console.error(err);
            setError(err?.message || 'PDF export failed. Try again.');
        } finally {
            setExportingFormat('');
            setExportProgress('');
        }
    }

    async function handlePrintMasterPdfExport() {
        if (!exportRef.current || exporting) return;
        setExportingFormat('print-master');
        setExportProgress(t('printMasterPreparing'));
        setError('');

        try {
            await waitForExportSurface({ forceHighQuality: true });
            const printMaster = await preparePrintMaster();
            const pages = await captureExportPages({ forceHighQuality: true, printMaster });
            setExportProgress(t('printMasterBuildingPdf'));
            await downloadPrintMapPdf({
                pages,
                directoryName: directory?.name,
                fileNameSuffix: 'print-master',
            });
        } catch (err) {
            console.error(err);
            setError(err?.message || t('printMasterFailed'));
        } finally {
            setExportingFormat('');
            setExportProgress('');
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={handleImageExport}
                disabled={exporting}
                data-print-export-quality={printMapQuality}
                className={`btn-ghost justify-center border border-slate-200 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            >
                <ImageDown size={16} />
                {exportingFormat === 'image' ? t('exporting') : t(exportAsSeparatePages ? 'saveAsImages' : 'saveAsImage')}
            </button>
            <button
                type="button"
                onClick={handlePdfExport}
                disabled={exporting}
                data-print-pdf-export="a3-high-resolution"
                className={`btn-ghost justify-center border border-slate-200 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            >
                <FileDown size={16} />
                {exportingFormat === 'pdf' ? t('preparingPdf') : t('savePrintPdf')}
            </button>
            {printMasterConfigured ? (
                <button
                    type="button"
                    onClick={handlePrintMasterPdfExport}
                    disabled={exporting}
                    data-print-pdf-export="print-master-100"
                    className={`btn-ghost justify-center border border-slate-200 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
                >
                    <FileDown size={16} />
                    {exportingFormat === 'print-master' ? t('preparingPrintMasterPdf') : t('savePrintMasterPdf')}
                </button>
            ) : null}
            {exportProgress ? (
                <p className="text-sm font-semibold text-slate-600" aria-live="polite">{exportProgress}</p>
            ) : null}
            {error ? (
                <p className="text-sm font-medium text-red-600">{error}</p>
            ) : null}
            {printMasterConfigured ? (
                <p className="basis-full text-xs font-medium leading-5 text-slate-500">
                    {t('printMasterPdfHelp')}
                </p>
            ) : null}

            {exportRoot ? createPortal(
                <div
                    className="pointer-events-none fixed left-0 top-0 overflow-visible p-8"
                    style={{ left: '-10000px', opacity: 0.001 }}
                    aria-hidden="true"
                >
                    <div ref={exportRef}>
                        <MapDirectoryExportPanel
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
                        />
                    </div>
                </div>
                ,
                exportRoot,
            ) : null}
        </>
    );
}
