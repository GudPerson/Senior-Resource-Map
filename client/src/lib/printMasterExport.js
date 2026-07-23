import { toPng } from 'html-to-image';

import { composePrintMasterBasemap } from './printMasterSurface.js';

const HIDDEN_BASEMAP_SELECTORS = [
    '.leaflet-tile-pane',
    '.leaflet-carearound-fixed-town-surface-pane',
    '.leaflet-carearound-fixed-town-surface-backdrop-pane',
];

function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
}

async function loadDataUrlImage(dataUrl) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(blob);
        return { image: bitmap, close: () => bitmap.close?.() };
    }
    const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = dataUrl;
    });
    return { image, close: () => {} };
}

export function getPrintMasterMapRect(pageNode, mapFrameNode, outputScale) {
    const pageRect = pageNode.getBoundingClientRect();
    const mapRect = mapFrameNode.getBoundingClientRect();
    const scale = Math.max(1, Number(outputScale) || 1);
    return {
        x: Math.round((mapRect.left - pageRect.left) * scale),
        y: Math.round((mapRect.top - pageRect.top) * scale),
        width: Math.max(1, Math.round(mapRect.width * scale)),
        height: Math.max(1, Math.round(mapRect.height * scale)),
        cssWidth: Math.max(1, mapRect.width),
        cssHeight: Math.max(1, mapRect.height),
    };
}

async function captureMapOverlay(mapFrameNode, mapRect) {
    const hiddenElements = HIDDEN_BASEMAP_SELECTORS.flatMap((selector) => (
        [...mapFrameNode.querySelectorAll(selector)]
    ));
    const backgroundElements = [
        mapFrameNode,
        mapFrameNode.querySelector('.leaflet-container'),
    ].filter(Boolean);
    const hiddenVisibility = hiddenElements.map((element) => element.style.visibility);
    const backgrounds = backgroundElements.map((element) => element.style.background);
    hiddenElements.forEach((element) => { element.style.visibility = 'hidden'; });
    backgroundElements.forEach((element) => { element.style.background = 'transparent'; });
    try {
        return await toPng(mapFrameNode, {
            cacheBust: false,
            backgroundColor: 'transparent',
            pixelRatio: 1,
            width: mapRect.cssWidth,
            height: mapRect.cssHeight,
            canvasWidth: mapRect.width,
            canvasHeight: mapRect.height,
            skipAutoScale: true,
        });
    } finally {
        hiddenElements.forEach((element, index) => { element.style.visibility = hiddenVisibility[index]; });
        backgroundElements.forEach((element, index) => { element.style.background = backgrounds[index]; });
    }
}

function clipRoundedMap(context, mapRect, mapFrameNode) {
    const radiusCssPx = Number.parseFloat(getComputedStyle(mapFrameNode).borderTopLeftRadius) || 0;
    const radius = Math.max(0, radiusCssPx * (mapRect.width / mapRect.cssWidth));
    context.beginPath();
    if (typeof context.roundRect === 'function') {
        context.roundRect(mapRect.x, mapRect.y, mapRect.width, mapRect.height, radius);
    } else {
        context.rect(mapRect.x, mapRect.y, mapRect.width, mapRect.height);
    }
    context.clip();
}

export async function upgradeCapturedPageWithPrintMaster({
    capture,
    pageNode,
    mapFrameNode,
    viewportBounds,
    manifest,
    assetBaseUrl,
    onProgress,
} = {}) {
    if (!capture?.dataUrl || !pageNode || !mapFrameNode) return capture;
    const mapRect = getPrintMasterMapRect(pageNode, mapFrameNode, capture.outputScale);
    // Keep the expensive steps sequential. A print-master chunk can be tens of
    // megapixels after decoding, so overlapping the DOM captures and master
    // composition creates avoidable memory spikes on tablets and older laptops.
    const overlayDataUrl = await captureMapOverlay(mapFrameNode, mapRect);
    const masterBasemap = await composePrintMasterBasemap({
        manifest,
        assetBaseUrl,
        viewportBounds,
        width: mapRect.width,
        height: mapRect.height,
        onProgress,
    });
    const basePage = await loadDataUrlImage(capture.dataUrl);
    const overlay = await loadDataUrlImage(overlayDataUrl);
    const output = createCanvas(capture.outputWidth, capture.outputHeight);
    const context = output.getContext('2d');
    try {
        context.drawImage(basePage.image, 0, 0, output.width, output.height);
        context.save();
        clipRoundedMap(context, mapRect, mapFrameNode);
        context.drawImage(masterBasemap, mapRect.x, mapRect.y, mapRect.width, mapRect.height);
        context.restore();
        context.drawImage(overlay.image, mapRect.x, mapRect.y, mapRect.width, mapRect.height);
        return {
            ...capture,
            dataUrl: output.toDataURL('image/png'),
            printMasterApplied: true,
        };
    } finally {
        basePage.close?.();
        overlay.close?.();
        masterBasemap.width = 1;
        masterBasemap.height = 1;
    }
}
