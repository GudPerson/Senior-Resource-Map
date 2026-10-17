import { useEffect, useRef, useState } from 'react';
import { FileDown } from 'lucide-react';

import { useLocale } from '../contexts/LocaleContext.jsx';
import { getMapNoteImageMessages } from '../lib/mapNoteImageMessages.js';
import { getDirectoryMapNoteImages } from '../../../shared/mapNoteImages.js';

export default function MyMapPdfExportButton({
    directory,
    presentation,
    className = '',
}) {
    const { locale, t } = useLocale();
    const messages = getMapNoteImageMessages(locale);
    const hasImages = getDirectoryMapNoteImages(directory).length > 0;
    const mountedRef = useRef(false);
    const downloadRef = useRef(null);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        mountedRef.current = true;
        downloadRef.current = null;
        setExporting(false);
        setError('');

        return () => {
            mountedRef.current = false;
            downloadRef.current?.abort();
        };
    }, [directory?.id]);

    async function handleDownload() {
        if (exporting || downloadRef.current) return;
        if (!mountedRef.current) return;
        const controller = new AbortController();
        downloadRef.current = controller;
        setExporting(true);
        setError('');

        try {
            const { downloadMyMapPdf } = await import('../lib/myMapPdfGenerator.js');
            await downloadMyMapPdf({
                directory,
                presentation,
                locale,
                generatedAt: new Date(),
                signal: controller.signal,
            });
        } catch (downloadError) {
            if (mountedRef.current && !controller.signal.aborted) {
                setError(downloadError?.code === 'map_notes_export_too_large' ? messages.exportTooLarge
                    : hasImages ? messages.exportFailed : t('failedDownloadPdf'));
            }
        } finally {
            if (downloadRef.current === controller) downloadRef.current = null;
            if (mountedRef.current && !controller.signal.aborted) {
                setExporting(false);
            }
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
                {exporting ? (hasImages ? messages.preparingExport : t('preparingPdf')) : (hasImages ? messages.downloadAll : t('downloadMapNotes'))}
            </button>
            {error ? (
                <p role="alert" className="text-sm font-medium text-red-600">{error}</p>
            ) : null}
        </>
    );
}
