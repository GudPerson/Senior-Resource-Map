import DirectoryPrintView from './DirectoryPrintView.jsx';

export default function MapDirectoryExportPanel({
    directory,
    generatedAt = new Date(),
    onMapReadyForCapture,
}) {
    return (
        <DirectoryPrintView
            directory={directory}
            generatedAt={generatedAt}
            mode="owner"
            variant="export"
            footerNote={directory?.share?.isShared ? 'Open the shared link for the full interactive directory.' : ''}
            onMapReadyForCapture={onMapReadyForCapture}
        />
    );
}
