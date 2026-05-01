import DirectoryPrintView from './DirectoryPrintView.jsx';

export default function MapDirectoryExportPanel({
    directory,
    generatedAt = new Date(),
    activeAnchor = null,
    shareUrl = '',
    exportWidth,
    onMapReadyForCapture,
    onMapCaptureError,
}) {
    return (
        <DirectoryPrintView
            directory={directory}
            generatedAt={generatedAt}
            mode="owner"
            variant="export"
            exportWidth={exportWidth}
            activeAnchor={activeAnchor}
            shareUrl={shareUrl}
            footerNote={directory?.share?.isShared ? 'Open the shared link for the full interactive map.' : ''}
            onMapReadyForCapture={onMapReadyForCapture}
            onMapCaptureError={onMapCaptureError}
        />
    );
}
