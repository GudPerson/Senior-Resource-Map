import React from 'react';
import { createRoot } from 'react-dom/client';
import { A11yProvider } from '../../../client/src/contexts/A11yContext.jsx';
import { LocaleProvider } from '../../../client/src/contexts/LocaleContext.jsx';
import { MapStyleProvider } from '../../../client/src/contexts/MapStyleContext.jsx';
import DirectoryMap from '../../../client/src/components/DirectoryMap.jsx';
import PrintAnnotationLayer from '../../../client/src/components/PrintAnnotationLayer.jsx';
import '../../../client/src/index.css';

// Local observer-only composition: two actual map components in one document,
// independent of the Export page's intentional preview/capture camera coupling.
const payload = await fetch('/__qa-label-payload.json').then(response => response.json());
createRoot(document.getElementById('root')).render(
    <A11yProvider><MapStyleProvider><LocaleProvider>
        <main style={{ display: 'flex', gap: 20, padding: 20 }}>
            {[13, 16].map(zoom => <section key={zoom} data-label-isolation-zoom={zoom} style={{ width: 600 }}>
                <DirectoryMap pins={payload.pins} mapHeightPx={420}
                    mapViewState={{ center: [1.38, 103.75], zoom }}
                    showZoomControl={false} showMapStyleControl={false} showAttribution={false}
                    markerMode="number" clusterMarkerMode="none"
                    mapOverlay={<PrintAnnotationLayer annotations={payload.annotations} editable={false} />} />
            </section>)}
        </main>
    </LocaleProvider></MapStyleProvider></A11yProvider>,
);
