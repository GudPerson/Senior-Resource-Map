import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageDown } from 'lucide-react';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';

import MapDirectoryExportPanel from './MapDirectoryExportPanel.jsx';

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
    className = '',
}) {
    const exportRef = useRef(null);
    const exportReadyRef = useRef(false);
    const readyWaitersRef = useRef([]);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        exportReadyRef.current = false;
        readyWaitersRef.current = [];
    }, [directory?.id, directory?.updatedAt, directory?.summary?.resourceCount]);

    const handleMapReadyForCapture = useCallback(() => {
        exportReadyRef.current = true;
        const waiters = readyWaitersRef.current.splice(0);
        waiters.forEach((resolve) => resolve());
    }, []);

    async function waitForExportSurface() {
        if (document.fonts?.ready) {
            try {
                await document.fonts.ready;
            } catch {
                // Proceed even if the font readiness promise rejects.
            }
        }

        if (!exportReadyRef.current) {
            await new Promise((resolve) => {
                const timeoutId = window.setTimeout(() => {
                    readyWaitersRef.current = readyWaitersRef.current.filter((waiter) => waiter !== ready);
                    resolve();
                }, 2200);

                const ready = () => {
                    window.clearTimeout(timeoutId);
                    resolve();
                };

                readyWaitersRef.current.push(ready);
            });
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
            const dataUrl = await toPng(exportRef.current, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: '#ffffff',
            });
            saveAs(dataUrl, buildFileName(directory?.name));
        } catch (err) {
            console.error(err);
            setError('Image export failed. Try again.');
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

            <div className="pointer-events-none fixed left-[-200vw] top-0">
                <div ref={exportRef}>
                    <MapDirectoryExportPanel
                        directory={directory}
                        onMapReadyForCapture={handleMapReadyForCapture}
                    />
                </div>
            </div>
        </>
    );
}
