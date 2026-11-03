import L from 'leaflet';
import { createRoot } from 'react-dom/client';
import StandardAppRoot from '../../../client/src/StandardAppRoot.jsx';
import '../../../client/src/index.css';

// Synthetic raster tiles keep the preview independent of external map services.
const tile = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eaf1eb"/><path d="M0 60H256M0 180H256M60 0V256M180 0V256" stroke="#fff" stroke-width="10"/><path d="M0 60H256M0 180H256M60 0V256M180 0V256" stroke="#cad6cd" stroke-width="1"/></svg>')}`;
const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
Object.defineProperty(HTMLImageElement.prototype, 'src', {
    ...src,
    set(value) {
        let remoteTile = false;
        try { const url = new URL(String(value), location.href); remoteTile = /^https?:$/.test(url.protocol) && /(?:^|\.)(?:onemap\.gov\.sg|maps\.carearound\.sg|tile\.openstreetmap\.org)$/.test(url.hostname); } catch { /* Preserve invalid assignments for the browser to handle. */ }
        return src.set.call(this, remoteTile ? tile : value);
    },
});
window.__spatialPreviewMaps = new Set();
window.__registerMapFirst = map => window.__spatialPreviewMaps.add(map);
L.Map.addInitHook(function () { window.__spatialPreviewMaps.add(this); });
window.__previewSyntheticTile = tile;
createRoot(document.getElementById('root')).render(<StandardAppRoot />);
