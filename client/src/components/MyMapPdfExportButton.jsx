import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileDown } from 'lucide-react';
import { toPng } from 'html-to-image';

import DirectoryMap from './DirectoryMap.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { downloadMyMapPdf } from '../lib/myMapPdfGenerator.js';

const TRANSPARENT_IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const MAP_CAPTURE_TIMEOUT_MS = 6500;

export default function MyMapPdfExportButton({
    directory,
    presentation,
    activeAnchor = null,
    className = '',
}) {
    const { locale, t } = useLocale();
    const mapSnapshotRef = useRef(null);
    const mapReadyRef = useRef(false);
    const mapErrorRef = useRef(null);
    const readyWaitersRef = useRef([]);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const exportRoot = typeof document !== 'undefined' ? document.body : null;

    useEffect(() => {
        mapReadyRef.current = false;
        mapErrorRef.current = null;
        const waiters = readyWaitersRef.current.splice(0);
        waiters.forEach(({ reject }) => reject(new Error('Directory map changed before PDF snapshot capture.')));
    }, [
        activeAnchor?.address,
        activeAnchor?.kind,
        activeAnchor?.lat,
        activeAnchor?.lng,
        activeAnchor?.postalCode,
        directory?.id,
        presentation?.pins,
        presentation?.placeNumberByKey,
    ]);

    const handleMapReadyForCapture = useCallback(() => {
        mapReadyRef.current = true;
        mapErrorRef.current = null;
        const waiters = readyWaitersRef.current.splice(0);
        waiters.forEach(({ resolve }) => resolve());
    }, []);

    const handleMapCaptureError = useCallback((captureError) => {
        mapReadyRef.current = false;
        mapErrorRef.current = captureError;
        const waiters = readyWaitersRef.current.splice(0);
        waiters.forEach(({ reject }) => reject(captureError));
    }, []);

    async function waitForMapSnapshotSurface() {
        if (document.fonts?.ready) {
            try {
                await document.fonts.ready;
            } catch {
                // Font readiness should not block a PDF download.
            }
        }

        if (mapErrorRef.current) {
            throw mapErrorRef.current;
        }

        if (!mapReadyRef.current) {
            await new Promise((resolve, reject) => {
                const timeoutId = window.setTimeout(() => {
                    readyWaitersRef.current = readyWaitersRef.current.filter((waiter) => waiter !== waiterEntry);
                    reject(new Error('Directory map did not finish loading for PDF snapshot capture.'));
                }, MAP_CAPTURE_TIMEOUT_MS);

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

        await new Promise((resolve) => {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(resolve);
            });
        });
    }

    async function captureMapSnapshot() {
        if (typeof document === 'undefined' || typeof window === 'undefined') return null;
        if (!mapSnapshotRef.current) return null;
        if (!presentation?.pins?.length && !activeAnchor) return null;

        try {
            await waitForMapSnapshotSurface();
            const snapshotNode = mapSnapshotRef.current;
            const snapshotWidth = Math.max(
                Math.ceil(snapshotNode.scrollWidth),
                Math.ceil(snapshotNode.getBoundingClientRect().width),
            );
            const snapshotHeight = Math.max(
                Math.ceil(snapshotNode.scrollHeight),
                Math.ceil(snapshotNode.getBoundingClientRect().height),
            );

            return await toPng(snapshotNode, {
                cacheBust: false,
                imagePlaceholder: TRANSPARENT_IMAGE_PLACEHOLDER,
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                width: snapshotWidth,
                height: snapshotHeight,
                canvasWidth: snapshotWidth * 2,
                canvasHeight: snapshotHeight * 2,
            });
        } catch {
            return null;
        }
    }

    async function handleDownload() {
        if (exporting) return;
        setExporting(true);
        setError('');

        const mapSnapshotDataUrl = await captureMapSnapshot();

        try {
            await downloadMyMapPdf({
                directory,
                presentation,
                locale,
                generatedAt: new Date(),
                mapSnapshotDataUrl,
            });
        } catch (downloadError) {
            console.error(downloadError);
            setError(t('failedDownloadPdf'));
        } finally {
            setExporting(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={handleDownload}
                disabled={exporting}
                className={`btn-ghost justify-center border border-slate-200 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            >
                <FileDown size={16} />
                {exporting ? t('preparingPdf') : t('downloadPdf')}
            </button>
            {error ? (
                <p className="text-sm font-medium text-red-600">{error}</p>
            ) : null}

            {exportRoot ? createPortal(
                <div
                    className="pointer-events-none fixed top-0 overflow-hidden bg-white"
                    style={{ left: '-10000px', width: '720px' }}
                    aria-hidden="true"
                >
                    <div ref={mapSnapshotRef} className="w-[720px] bg-white">
                        <DirectoryMap
                            activeAnchor={activeAnchor}
                            pins={presentation?.pins || []}
                            interactive={false}
                            markerMode="number"
                            placeNumberByKey={presentation?.placeNumberByKey}
                            showPopup={false}
                            showZoomControl={false}
                            mapHeightClassName="h-[360px] min-h-[360px] max-h-[360px]"
                            onMapReadyForCapture={handleMapReadyForCapture}
                            onMapCaptureError={handleMapCaptureError}
                        />
                    </div>
                </div>
                ,
                exportRoot,
            ) : null}
        </>
    );
}
