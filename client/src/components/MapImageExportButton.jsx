import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageDown } from 'lucide-react';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';

import MapDirectoryExportPanel from './MapDirectoryExportPanel.jsx';

const TRANSPARENT_IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function buildFileName(directoryName) {
    const slug = String(directoryName || 'carearound-directory')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `${slug || 'carearound-directory'}-summary.png`;
}

export default function MapImageExportButton({
    directory,
    activeAnchor = null,
    shareUrl = '',
    className = '',
}) {
    const exportRef = useRef(null);
    const exportReadyRef = useRef(false);
    const mapErrorRef = useRef(null);
    const readyWaitersRef = useRef([]);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    const exportRoot = typeof document !== 'undefined' ? document.body : null;
    const exportWidth = typeof window === 'undefined'
        ? 1480
        : Math.min(1480, Math.max(960, window.innerWidth - 64));

    useEffect(() => {
        exportReadyRef.current = false;
        mapErrorRef.current = null;
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

    async function waitForExportSurface() {
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
                }, 6500);

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

    async function handleExport() {
        if (!exportRef.current || exporting) return;
        setExporting(true);
        setError('');

        try {
            await waitForExportSurface();
            const exportNode = exportRef.current;
            const exportNodeWidth = Math.max(
                Math.ceil(exportNode.scrollWidth),
                Math.ceil(exportNode.getBoundingClientRect().width),
            );
            const exportNodeHeight = Math.max(
                Math.ceil(exportNode.scrollHeight),
                Math.ceil(exportNode.getBoundingClientRect().height),
            );
            const dataUrl = await toPng(exportRef.current, {
                cacheBust: false,
                imagePlaceholder: TRANSPARENT_IMAGE_PLACEHOLDER,
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                width: exportNodeWidth,
                height: exportNodeHeight,
                canvasWidth: exportNodeWidth * 2,
                canvasHeight: exportNodeHeight * 2,
            });
            saveAs(dataUrl, buildFileName(directory?.name));
        } catch (err) {
            console.error(err);
            setError(err?.message || 'Image export failed. Try again.');
        } finally {
            setExporting(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className={`btn-ghost justify-center border border-slate-200 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            >
                <ImageDown size={16} />
                {exporting ? 'Exporting…' : 'Save as image'}
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
                        />
                    </div>
                </div>
                ,
                exportRoot,
            ) : null}
        </>
    );
}
