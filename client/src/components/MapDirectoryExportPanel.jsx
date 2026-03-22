import DirectoryPrintView from './DirectoryPrintView.jsx';

export default function MapDirectoryExportPanel({
    directory,
    generatedAt = new Date(),
    activeAnchor = null,
    shareUrl = '',
    onMapReadyForCapture,
    onMapCaptureError,
}) {
    return (
        <DirectoryPrintView
            directory={directory}
            generatedAt={generatedAt}
            mode="owner"
            variant="export"
            activeAnchor={activeAnchor}
            shareUrl={shareUrl}
            footerNote={directory?.share?.isShared ? 'Open the shared link for the full interactive directory.' : ''}
            onMapReadyForCapture={onMapReadyForCapture}
            onMapCaptureError={onMapCaptureError}
        />
    );
}
