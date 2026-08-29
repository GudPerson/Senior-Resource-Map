import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';

import { useLocale } from '../contexts/LocaleContext.jsx';

export default function MyMapExcelExportButton({
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
        return () => { mountedRef.current = false; };
    }, []);

    async function handleDownload() {
        if (exporting || !mountedRef.current) return;
        setExporting(true);
        setError('');
        try {
            const { downloadMyMapExcel } = await import('../lib/myMapExcelExporter.js');
            await downloadMyMapExcel({ directory, presentation, locale });
        } catch (downloadError) {
            console.error(downloadError);
            if (mountedRef.current) setError(t('failedDownloadExcel'));
        } finally {
            if (mountedRef.current) setExporting(false);
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
                <FileSpreadsheet size={16} />
                {exporting ? t('preparingExcel') : t('downloadMapAssetsExcel')}
            </button>
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        </>
    );
}
