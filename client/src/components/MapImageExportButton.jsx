import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileDown, ImageDown } from 'lucide-react';
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
    printAnnotations = [],
}) {
    const { t } = useLocale();
    const exportRef = useRef(null);
    const exportReadyRef = useRef(false);
    const mapErrorRef = useRef(null);
    const mapViewportSnapshotRef = useRef(null);
    const readyWaitersRef = useRef([]);
    const [exportingFormat, setExportingFormat] = useState('');
    const [error, setError] = useState('');
    const exportRoot = typeof document !== 'undefined' ? document.body : null;
    const exportWidth = PRINT_MAP_CANVAS_WIDTH_PX;
    const printMapCaptureKey = printMapState ? buildPrintMapCaptureKey(printMapState) : '';
    const printAnnotationCaptureKey = getPrintAnnotationCaptureKey(printAnnotations);
    const printMapQuality = normalizePrintMapQuality(printMapState?.mapQuality);
    const exportAsSeparatePages = shouldExportPrintMapAsSeparatePages(printMapState);
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
        printAnnotationCaptureKey,
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

    async function captureExportPages({ forceHighQuality = false } = {}) {
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
            capturedPages.push({
                dataUrl,
                width,
                height,
                name,
                outputScale: exportConfig.outputScale,
                outputWidth: Math.round(width * exportConfig.outputScale),
                outputHeight: Math.round(height * exportConfig.outputScale),
            });
        }
        return capturedPages;
    }

    async function handleImageExport() {
        if (!exportRef.current || exporting) return;
        setExportingFormat('image');
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
        }
    }

    async function handlePdfExport() {
        if (!exportRef.current || exporting) return;
        setExportingFormat('pdf');
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
                data-print-pdf-export="a3"
                className={`btn-ghost justify-center border border-slate-200 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            >
                <FileDown size={16} />
                {exportingFormat === 'pdf' ? t('preparingPdf') : t('savePrintPdf')}
            </button>
            {error ? (
                <p className="text-sm font-medium text-red-600">{error}</p>
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
                            printAnnotations={printAnnotations}
                        />
                    </div>
                </div>
                ,
                exportRoot,
            ) : null}
        </>
    );
}
