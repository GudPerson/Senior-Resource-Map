import { useEffect, useRef, useState } from 'react';
import { FileDown } from 'lucide-react';

import { useLocale } from '../contexts/LocaleContext.jsx';
import { downloadMyMapPdf } from '../lib/myMapPdfGenerator.js';

export default function MyMapPdfExportButton({
    directory,
    presentation,
    className = '',
}) {
    const { locale, t } = useLocale();
    const mountedRef = useRef(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    async function handleDownload() {
        if (exporting) return;
        if (!mountedRef.current) return;
        setExporting(true);
        setError('');

        try {
            await downloadMyMapPdf({
                directory,
                presentation,
                locale,
                generatedAt: new Date(),
            });
        } catch (downloadError) {
            console.error(downloadError);
            if (mountedRef.current) {
                setError(t('failedDownloadPdf'));
            }
        } finally {
            if (mountedRef.current) {
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
                {exporting ? t('preparingPdf') : t('downloadPdf')}
            </button>
            {error ? (
                <p className="text-sm font-medium text-red-600">{error}</p>
            ) : null}
        </>
    );
}
