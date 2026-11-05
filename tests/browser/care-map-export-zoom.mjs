import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';
import { createPrintAnnotation } from '../../client/src/lib/printAnnotations.js';
import { appendKmlBoundaries } from '../../client/src/lib/kmlBoundaries.js';
const repo = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) || (await fs.mkdtemp(path.join(os.tmpdir(), 'care-map-view-controls-')));
await fs.mkdir(out, {
  recursive: true
});
const report = {
  cases: [],
  errors: [],
  writes: [],
  boundary: 'Actual owner page, fictional API data, synthetic imagery and emulated layouts/touch. No production writes or physical-device claim.'
};
const server = await createServer({
  configFile: path.join(repo, 'tests/fixtures/care-map-view-controls/vite.config.mjs'),
  cacheDir: path.join(out, 'cache/node_modules/.vite'),
  server: {
    host: '127.0.0.1',
    port: 0,
    strictPort: false
  },
  plugins: [{
    name: 'probe',
    enforce: 'pre',
    transform(source, id) {
      if (id.endsWith('/components/DirectoryMap.jsx')) return source.replace('mapInstanceRef.current = map;', "mapInstanceRef.current = map;if(map&&!window.fixtureMaps?.includes(map)){(window.fixtureMaps ||= []).push(map);map.fixtureEvents=[];const original=map.setView;map.setView=function(...a){map.fixtureEvents.push({type:'setView',zoom:a[1],at:performance.now()});return original.apply(this,a)};map.on('zoomend moveend',e=>map.fixtureEvents.push({type:e.type,zoom:map.getZoom(),at:performance.now()}));}");
    }
  }],
  define: {
    'import.meta.env.VITE_TOWN_MAP_PROOF_ENABLED': '"true"',
    'import.meta.env.VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED': '"true"',
    ...Object.fromEntries([['ASSET_BASE_URL', 'v2/native-scale-20260722/default'], ['GRAY_ASSET_BASE_URL', 'v2/native-scale-20260722/gray'], ['OVERVIEW_ASSET_BASE_URL', 'v3/zoom14-atlas-20260730/default'], ['GRAY_OVERVIEW_ASSET_BASE_URL', 'v3/zoom14-atlas-20260730/gray']].map(([key, value]) => ['import.meta.env.VITE_TOWN_MAP_' + key, JSON.stringify('/__carearound-town-maps/' + value)]))
  }
});
await server.listen();
const baseUrl = server.resolvedUrls.local[0];
let browser;
const studioDoc = createMapStudioDocument();
studioDoc.revision = 1;
studioDoc.views[0].revision = 1;
studioDoc.views[0].design.camera = {
  mode: 'fixed',
  view: {
    center: [1.38, 103.75],
    zoom: 15
  }
};
studioDoc.views[0].design.layout.preset = 'full-map';
studioDoc.views[0].design.pins.style = 'numbered';
if (process.argv.includes('--gray')) studioDoc.views[0].design.basemap.style = 'gray';
async function install(page, {
  multiplePins = false,
  annotations = [],
  tilePixel = null
} = {}) {
  page.on('pageerror', e => report.errors.push(e.message));
  const row = {
    rowKey: 'personal:91261',
    assetKey: 'personal:91261',
    resourceType: 'personal',
    resourceId: 91261,
    personalPlaceId: 91261,
    name: 'Fictional centre',
    personalPlaceCategory: 'home',
    subCategory: 'Personal place',
    address: 'Fictional address',
    lat: 1.38,
    lng: 103.75,
    isPersonalPlace: true,
    saveEligible: false,
    status: 'active',
    mapShortDescriptors: []
  };
  const pin = {
    pinKey: 'personal:91261',
    placeKey: 'personal:91261',
    title: 'Fictional centre',
    lat: 1.38,
    lng: 103.75,
    curatedCount: 0,
    previewResourceNames: []
  };
  const directory = {
    id: 91261012,
    name: 'Fictional Care Map',
    description: '',
    categoryOrder: [],
    summary: {
      resourceCount: 1,
      savedResourceCount: 0,
      personalPlaceCount: 1,
      placeCount: 1,
      mappablePlaceCount: 1
    },
    share: {
      isShared: false,
      shareToken: null,
      embedEnabled: false,
      embedAllowedOrigins: []
    },
    assets: [],
    personalPlaces: [{
      ...row,
      shortDescription: '',
      shortDescriptors: []
    }],
    places: [{
      ...pin,
      name: row.name,
      address: row.address,
      hasCoordinates: true,
      openProgrammeServiceCount: 0,
      rows: [row]
    }],
    pins: [pin],
    viewer: {
      isAuthenticated: true,
      isOwner: true,
      canSaveCopy: false,
      canSaveResources: true
    }
  };
  if (multiplePins) {
    const secondRow = {
      ...row,
      rowKey: 'personal:91262',
      assetKey: 'personal:91262',
      resourceId: 91262,
      personalPlaceId: 91262,
      name: 'Fictional second centre',
      lat: 1.3707,
      lng: 103.741
    };
    const secondPin = {
      ...pin,
      pinKey: 'personal:91262',
      placeKey: 'personal:91262',
      title: secondRow.name,
      lat: secondRow.lat,
      lng: secondRow.lng
    };
    directory.personalPlaces.push({
      ...secondRow,
      shortDescription: '',
      shortDescriptors: []
    });
    directory.places.push({
      ...secondPin,
      name: secondRow.name,
      address: secondRow.address,
      hasCoordinates: true,
      openProgrammeServiceCount: 0,
      rows: [secondRow]
    });
    directory.pins.push(secondPin);
    directory.summary = {
      ...directory.summary,
      resourceCount: 2,
      personalPlaceCount: 2,
      placeCount: 2,
      mappablePlaceCount: 2
    };
  }
  await page.route('**/*', async r => {
    const req = r.request(),
      url = new URL(req.url());
    if (url.pathname.includes('/api/auth/')) return r.fulfill({
      json: {
        user: {
          id: 91261,
          name: 'Fixture owner',
          role: 'standard',
          locale: 'en'
        }
      }
    });
    if (url.pathname.endsWith('/my-maps/91261012')) return r.fulfill({
      json: directory
    });
    if (url.pathname.endsWith('/my-maps/91261012/print-annotations')) return r.fulfill({
      json: {
        mapId: 91261012,
        schemaVersion: 1,
        annotations,
        revision: 1
      }
    });
    if (url.pathname.endsWith('/my-maps/91261012/studio')) {
      if (!['GET', 'OPTIONS'].includes(req.method())) report.writes.push({
        method: req.method(),
        path: url.pathname
      });
      return r.fulfill({
        json: {
          mapId: 91261012,
          document: studioDoc,
          updatedAt: null
        }
      });
    }
    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'OPTIONS'].includes(req.method())) report.writes.push({
        method: req.method(),
        path: url.pathname
      });
      return r.fulfill({
        json: []
      });
    }
    if (url.hostname === '127.0.0.1') return r.continue();
    if (url.hostname === 'fonts.googleapis.com') return r.fulfill({
      body: '',
      contentType: 'text/css'
    });
    if (url.hostname.includes('onemap.gov.sg')) return r.fulfill({
      body: tilePixel || Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64'),
      contentType: 'image/png'
    });
    return r.abort();
  });
}
// One pixel stays within Leaflet's 0.1 zoom snap on Mac/Linux at DPR 1 or 2.
const fineWheelPixels = 1;
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
const paintedStandardPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO48OwDAAUwAqemVUSMAAAAAElFTkSuQmCC', 'base64');
async function screenshotPixel(page, point) {
  const screenshot = await page.screenshot();
  return page.evaluate(async ({ image, point }) => {
    const decoded = new Image(); decoded.src = image; await decoded.decode();
    const canvas = document.createElement('canvas'); canvas.width = decoded.width; canvas.height = decoded.height;
    const context = canvas.getContext('2d'); context.drawImage(decoded, 0, 0);
    return [...context.getImageData(Math.floor(point.x * devicePixelRatio), Math.floor(point.y * devicePixelRatio), 1, 1).data];
  }, { image: `data:image/png;base64,${screenshot.toString('base64')}`, point });
}
async function installTownMapAssets(page, imageDelay = 0) {
  await page.route('**/__carearound-town-maps/**', async route => {
    const u = new URL(route.request().url());
    const overview = u.pathname.includes('zoom14-atlas');
    const isIndex = u.pathname.endsWith('/manifest.json') && !u.pathname.includes('/surfaces/');
    if (u.pathname.endsWith('.json')) return route.fulfill({
      body: gunzipSync(await fs.readFile(path.join(repo, 'tests/fixtures/care-map-export-zoom', (overview ? isIndex ? 'overview-index' : 'overview-sg14' : isIndex ? 'native-index' : 'native-w01') + '.json.gz'))).toString('utf8'),
      contentType: 'application/json'
    });
    if (imageDelay) await new Promise(resolve => setTimeout(resolve, imageDelay));
    return route.fulfill({ body: pixel, contentType: 'image/png' });
  });
}

async function verifyInteractiveLowerZoomBoundary() {
  const savedCamera = studioDoc.views[0].design.camera;
  try {
    for (const savedZoom of [14, 13.9, 13.8]) {
      studioDoc.views[0].design.camera = { ...savedCamera, view: { ...savedCamera.view, zoom: savedZoom } };
      const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
      let cdp;
      try {
        await install(page);
        await installTownMapAssets(page, 200);
        await page.goto(new URL('?route=/my-directory/maps/91261012', baseUrl).href);
        await page.waitForFunction(() => window.fixtureMaps?.some(map => map?._loaded && map.getContainer().isConnected));
        await page.waitForTimeout(1000);
        const readMap = () => page.evaluate(() => {
          const map = window.fixtureMaps.find(item => item?._loaded && item.getContainer().isConnected);
          return { zoom: map.getZoom(), mode: map.getContainer().parentElement.dataset.mapBasemapMode };
        });
        assert.ok(Math.abs((await readMap()).zoom - savedZoom) < 0.001, 'an explicit saved camera restores its fractional zoom');
        if (savedZoom === 14) {
          for (const expectedZoom of [13.5, 13, 12.5, 12]) {
            await page.locator('.leaflet-control-zoom-out').first().click();
            await page.waitForTimeout(700);
            const after = await readMap();
            report.cases.push({ name: 'Interactive overview to Standard one-action half step', savedZoom, expectedZoom, ...after });
            assert.ok(Math.abs(after.zoom - expectedZoom) < 0.001, 'overview containment must not snap an outward half step back to 14');
            assert.equal(after.mode, 'live', 'Standard takes over below the overview tier');
          }
        } else {
          cdp = await page.context().newCDPSession(page);
          const mapBox = await page.locator('.leaflet-container').first().boundingBox();
          await page.mouse.move(mapBox.x + mapBox.width / 2, Math.min(1100, mapBox.y + mapBox.height / 2));
          for (let action = 0; action < 3; action++) {
            const before = await readMap();
            await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: mapBox.x + mapBox.width / 2, y: Math.min(1100, mapBox.y + mapBox.height / 2), deltaX: 0, deltaY: fineWheelPixels, modifiers: 2 });
            await page.waitForTimeout(700);
            const after = await readMap();
            report.cases.push({ name: 'Interactive fractional outward ctrl-pinch retains progress', savedZoom, before: before.zoom, ...after });
            assert.ok(after.zoom < before.zoom - 0.01, 'fractional zoom-out must not flash and return to 14');
          }
        }
        await page.reload();
        await page.waitForFunction(() => window.fixtureMaps?.some(map => map?._loaded && map.getContainer().isConnected));
        await page.waitForTimeout(1000);
        assert.ok(Math.abs((await readMap()).zoom - savedZoom) < 0.001, 'reloading still applies the authoritative saved view');
        report.cases.push({ name: 'Interactive explicit saved camera survives boundary exploration', savedZoom });
      } finally {
        await cdp?.detach();
        await page.close();
      }
    }
  } finally {
    studioDoc.views[0].design.camera = savedCamera;
  }
}

async function verifyAnnotationInwardZoom() {
  const savedCamera = studioDoc.views[0].design.camera;
  try {
    studioDoc.views[0].design.camera = { ...savedCamera, view: { center: [1.38, 103.75], zoom: 13 } };
    for (const dense of [false, true]) {
      const seeds = dense ? [[981, 1.38, 103.76, 0.04], [441, 1.44, 103.82, 0.02], [812, 1.32, 103.82, 0.02]] : [[4, 1.38, 103.76, 0.04]];
      const annotations = seeds.map(([count, lat, lng, radius], index) => {
        const points = dense
          ? Array.from({ length: count }, (_, i) => [lat + radius * Math.sin(i * 2 * Math.PI / count), lng + radius * Math.cos(i * 2 * Math.PI / count)])
          : [[1.34, 103.72], [1.34, 103.80], [1.42, 103.80], [1.42, 103.72]];
        const text = `Fictional boundary ${index + 1}`;
        const style = { color: '#056e5b', weight: 4.2, fillColor: '#64b78a', fillOpacity: 0.11, fontSize: 16, textColor: '#334155' };
        const annotation = dense
          ? appendKmlBoundaries([], [{ points, name: text, style }])[0]
          : createPrintAnnotation({ type: 'polygon', points, text, style });
        assert.equal(annotation.points.length, count, 'dense synthetic boundary keeps its input complexity');
        return annotation;
      });
      const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
      let cdp;
      const tileRequests = [];
      page.on('request', request => {
        const url = new URL(request.url());
        const tile = url.pathname.match(/\/(\d+)\/\d+\/\d+(?:\.[a-z]+)?$/i);
        if (url.hostname.includes('onemap.gov.sg') && tile) tileRequests.push(Number(tile[1]));
      });
      try {
        await install(page, { annotations, tilePixel: paintedStandardPixel });
        await installTownMapAssets(page);
        await page.goto(new URL('?route=/my-directory/maps/91261012', baseUrl).href);
        await page.locator('[data-annotation-shape-text]').first().waitFor();
        if (dense) {
          await page.getByRole('button', { name: 'Edit content', exact: true }).click();
          await page.getByText('Annotate', { exact: true }).click();
        }
        await page.waitForTimeout(650);
        cdp = await page.context().newCDPSession(page);
        const resetCamera = async () => {
          await page.evaluate(() => window.fixtureMaps.find(map => map?._loaded && map.getContainer().isConnected).setView([1.38, 103.75], 13, { animate: false }));
          await page.waitForTimeout(350);
        };
        const readMap = () => page.evaluate(() => {
          const map = window.fixtureMaps.find(item => item?._loaded && item.getContainer().isConnected);
          const el = map.getContainer();
          return { zoom: map.getZoom(), minZoom: map.getMinZoom(), maxZoom: map.getMaxZoom(),
            mode: el.parentElement.dataset.mapBasemapMode, tier: el.parentElement.dataset.fixedTownSurfaceTier,
            tileLayers: Object.values(map._layers).filter(layer => typeof layer.getTileUrl === 'function').map(layer => ({
              maxZoom: Number.isFinite(layer.options.maxZoom) ? layer.options.maxZoom : null,
              maxNativeZoom: layer.options.maxNativeZoom, detectRetina: layer.options.detectRetina, zoomOffset: layer.options.zoomOffset,
              tileZooms: [...new Set(Object.values(layer._tiles || {}).map(tile => tile.coords.z))],
            })),
            loadedBackgrounds: [...el.querySelectorAll('.leaflet-tile-pane img, .leaflet-image-layer')].filter(img => img.complete && img.naturalWidth > 0).length };
        });
        const assertGatedRequests = (state, requestStart) => {
          for (const layer of state.tileLayers) {
            if (layer.maxZoom === null) continue;
            const integerCeiling = Math.floor(layer.maxZoom);
            assert.equal(layer.maxZoom, integerCeiling + 0.5);
            assert.ok(layer.maxNativeZoom <= integerCeiling, 'fractional display admission cannot raise the native URL ceiling');
            assert.ok(layer.tileZooms.every(zoom => zoom <= integerCeiling));
            assert.ok(tileRequests.slice(requestStart).every(zoom => zoom <= integerCeiling), 'actual gated OneMap URLs stay below the existing integer ceiling');
          }
        };
        const hitTarget = target => page.evaluate(target => {
          const map = window.fixtureMaps.find(item => item?._loaded && item.getContainer().isConnected);
          const box = map.getContainer().getBoundingClientRect();
          let x, y;
          if (target === 'label') {
            const label = document.querySelector('[data-annotation-shape-text]').getBoundingClientRect();
            x = label.x + label.width / 2; y = label.y + label.height / 2;
          } else {
            const coordinate = target === 'fill' ? [1.36, 103.76] : target === 'stroke' ? [1.38, 103.72] : [1.38, 103.68];
            const point = map.latLngToContainerPoint(coordinate); x = box.x + point.x; y = box.y + point.y;
          }
          const element = document.elementFromPoint(x, y);
          return { x, y, tag: element?.tagName, annotation: Boolean(element?.closest('[class*="print-annotation-"]')),
            label: Boolean(element?.closest('[data-annotation-shape-text]')) };
        }, target);
        for (const gesture of ['wheel', 'ctrl-wheel']) {
          for (const target of ['fill', 'stroke', 'label', 'clear']) {
            await resetCamera();
            const hit = await hitTarget(target);
            assert.equal(hit.annotation, target !== 'clear', 'browser hit-testing reaches the intended annotation or clear-map path');
            if (target === 'label') assert.equal(hit.label, true);
            else if (target !== 'clear') assert.equal(hit.tag, 'path');
            await page.mouse.move(hit.x, hit.y);
            const requestStart = tileRequests.length;
            await page.evaluate(() => { window.__qaLastOwnerWheel = null; window.addEventListener('wheel', event => queueMicrotask(() => { window.__qaLastOwnerWheel = { ctrlKey: event.ctrlKey, defaultPrevented: event.defaultPrevented }; }), { once: true }); });
            if (gesture === 'wheel') await page.mouse.wheel(0, -fineWheelPixels);
            else await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: hit.x, y: hit.y, deltaX: 0, deltaY: -fineWheelPixels, modifiers: 2 });
            await page.waitForTimeout(650);
            const after = await readMap();
            const wheelPolicy = await page.evaluate(() => window.__qaLastOwnerWheel);
            report.cases.push({ name: gesture === 'wheel' ? 'Actual annotation-target owner scroll passes through' : 'Actual annotation-target fractional inward ctrl-pinch', dense, editor: dense, gesture, target, hit, wheelPolicy, ...after });
            assert.ok(Math.abs(after.zoom - (gesture === 'wheel' ? 13 : 13.1)) < 0.001, gesture === 'wheel' ? 'ordinary owner scrolling must leave the map zoom untouched' : 'one small admitted ctrl-pinch over the actual boundary target must retain 13.1');
            assert.deepEqual(wheelPolicy, { ctrlKey: gesture !== 'wheel', defaultPrevented: gesture !== 'wheel' }, 'only an admitted owner pinch prevents the ordinary page-scroll action');
            assert.equal(after.minZoom, 11); assert.equal(after.maxZoom, 19);
            assert.ok(after.loadedBackgrounds > 0, 'fractional input retains a decoded background');
            assertGatedRequests(after, requestStart);
          }
        }
        if (!dense) {
          await resetCamera();
          for (const expectedZoom of [13.1, 13.2, 13.3, 13.4, 13.5]) {
            const hit = await hitTarget('clear');
            const requestStart = tileRequests.length;
            await page.mouse.move(hit.x, hit.y); await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: hit.x, y: hit.y, deltaX: 0, deltaY: -fineWheelPixels, modifiers: 2 });
            await page.waitForTimeout(650);
            const after = await readMap();
            assert.ok(Math.abs(after.zoom - expectedZoom) < 0.001, 'successive small inward inputs accumulate across the Standard fractional band');
            const point = await hitTarget('clear');
            const rgb = await screenshotPixel(page, point);
            assert.deepEqual(rgb, [208, 230, 240, 255], 'Standard tiles stay visibly painted through 13.1–13.5 without removing tile caps');
            assertGatedRequests(after, requestStart);
            report.cases.push({ name: 'Painted Standard fractional-band continuity', zoom: after.zoom, rgb, loadedBackgrounds: after.loadedBackgrounds });
          }
          let state = await readMap();
          for (let action = 0; action < 6 && state.tier !== 'native'; action++) {
            await page.locator('.leaflet-control-zoom-in').first().click(); await page.waitForTimeout(650);
            state = await readMap();
            assert.ok(state.loadedBackgrounds > 0);
          }
          assert.equal(state.tier, 'native', 'interactive warm-up reaches native detail through real controls');
          let overviewSeen = false;
          for (let action = 0; action < 8 && state.mode !== 'live'; action++) {
            await page.locator('.leaflet-control-zoom-out').first().click(); await page.waitForTimeout(650);
            state = await readMap(); overviewSeen ||= state.tier === 'overview';
            assert.ok(state.loadedBackgrounds > 0, 'native/overview/Standard handoff keeps a decoded background');
          }
          assert.ok(overviewSeen); assert.equal(state.mode, 'live');
          const before = state.zoom, hit = await hitTarget('fill'), requestStart = tileRequests.length;
          await page.mouse.move(hit.x, hit.y); await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: hit.x, y: hit.y, deltaX: 0, deltaY: -fineWheelPixels, modifiers: 2 }); await page.waitForTimeout(650);
          state = await readMap();
          assert.ok(Math.abs(state.zoom - before - 0.1) < 0.001);
          assert.ok(state.loadedBackgrounds > 0);
          assertGatedRequests(state, requestStart);
          report.cases.push({ name: 'Warm interactive native/overview/Standard inward continuation', before, hit, ...state });
        }
      } finally {
        await cdp?.detach(); await page.close();
      }
    }
  } finally {
    studioDoc.views[0].design.camera = savedCamera;
  }
}

try {
  browser = await chromium.launch({
    headless: true
  });
  await verifyAnnotationInwardZoom();
  await verifyInteractiveLowerZoomBoundary();
  const page = await browser.newPage({
    viewport: {
      width: 1600,
      height: 1200
    },
    hasTouch: true
  });
  const exportTileRequests = [];
  page.on('request', request => {
    const url = new URL(request.url()), tile = url.pathname.match(/\/(\d+)\/\d+\/\d+(?:\.[a-z]+)?$/i);
    if (url.hostname.includes('onemap.gov.sg') && tile) exportTileRequests.push(Number(tile[1]));
  });
  await install(page, {
    multiplePins: true,
    tilePixel: paintedStandardPixel
  });
  await installTownMapAssets(page);
  await page.goto(new URL('?route=/my-directory/maps/91261012?view=print%26studioView=view-default', baseUrl).href);
  await page.waitForFunction(() => window.fixtureMaps?.length);
  await page.waitForTimeout(1000);
  const read = () => page.evaluate(() => {
    const maps = window.fixtureMaps.filter(map => map && map._loaded && map.getContainer().isConnected).map(map => {
      const el = map.getContainer(),
        frame = el.parentElement,
        b = el.getBoundingClientRect();
      return {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        zoom: map.getZoom(),
        zoomLabel: el.querySelector('.carearound-map-zoom-level')?.textContent?.trim() || null,
        dataset: {
          ...frame.dataset
        },
        chunks: el.querySelectorAll('.leaflet-image-layer').length,
        tiles: el.querySelectorAll('.leaflet-tile-pane img').length,
        tileLayers: Object.values(map._layers).filter(layer => typeof layer.getTileUrl === 'function').map(layer => ({
          maxZoom: Number.isFinite(layer.options.maxZoom) ? layer.options.maxZoom : null,
          maxNativeZoom: layer.options.maxNativeZoom, detectRetina: layer.options.detectRetina, zoomOffset: layer.options.zoomOffset,
          tileZooms: [...new Set(Object.values(layer._tiles || {}).map(tile => tile.coords.z))],
        })),
        events: map.fixtureEvents.slice(-15)
      };
    });
    return {
      maps,
      errors: window.fixtureErrors,
      mobileZoomLabel: document.querySelector('[data-print-mobile-map-controls] output')?.textContent?.trim() || null,
      ready: document.querySelector('[data-print-export-readiness]')?.dataset.printExportReadiness
    };
  });
  report.cases.push({
    name: 'initial',
    state: await read()
  });
  for(const item of (await read()).maps){ assert.equal(item.dataset.fixedTownSurfaceTier,'native','cold saved15 remains Detailed');assert.equal(item.tiles,0);assert.ok(item.chunks>0); }
  const separator = page.getByRole('separator', {
    name: 'Resize export map height'
  });
  if (await separator.count()) {
    await separator.focus();
    await separator.press('End');
    await page.waitForTimeout(800);
    report.cases.push({
      name: 'extended',
      state: await read()
    });
  }
  for(const item of (await read()).maps){ assert.equal(item.dataset.fixedTownSurfaceTier,'native','largest real resize remains Detailed');assert.equal(item.tiles,0); }
  await page.evaluate(() => {
    const map = window.fixtureMaps.find(m => m && m._loaded && m.getContainer().isConnected && !m.getContainer().parentElement.dataset.printExportMapFrame);
    map.setView([1.37, 103.74], 15, {
      animate: false
    });
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const map = window.fixtureMaps.find(m => m && m._loaded && m.getContainer().isConnected && m.getContainer().getBoundingClientRect().x >= 0);
    map.fixtureEvents = [];
    map.setZoom(15, {
      animate: false
    });
  });
  await page.waitForTimeout(700);
  const state = await read();
  report.cases.push({
    name: 'force15',
    state
  });
  const visible = state.maps.find(m => m.x >= 0 && !m.dataset.printExportMapFrame);
  const zoomWrites = visible.events.filter(e => e.type === 'setView').map(e => e.zoom);
  const corrected = zoomWrites.findIndex((z, i) => i > 0 && z > 15.05);
  assert.ok(corrected >= 0, 'real W01 grid requires containment within displayed15');
  assert.ok(!zoomWrites.slice(corrected + 1).some(z => Math.abs(z - 15) < 0.001), 'contained camera must not replay the stale requested15');
  assert.equal(visible.dataset.fixedTownSurfaceTier, 'native', 'actual owner Export keeps native at displayed15');
  assert.equal(visible.tiles, 0);
  const currentMap = () => page.evaluate(() => {
    const map = window.fixtureMaps.find(m => m && m._loaded && m.getContainer().isConnected && !m.getContainer().parentElement.dataset.printExportMapFrame);
    return {
      zoom: map.getZoom(),
      center: [map.getCenter().lat, map.getCenter().lng],
      events: map.fixtureEvents
    };
  });
  const mapPoint = () => page.evaluate(() => {
    const map = window.fixtureMaps.find(m => m && m._loaded && m.getContainer().isConnected && !m.getContainer().parentElement.dataset.printExportMapFrame);
    const box = map.getContainer().getBoundingClientRect();
    return {
      x: box.x + box.width / 2,
      y: Math.min(innerHeight - 80, box.y + box.height / 2)
    };
  });
  const assertParity = async expectedTier => {
    const { zoom, center } = await currentMap();
    const waitStarted = Date.now();
    try {
      await page.waitForFunction(({ zoom, center, expectedTier }) => {
        const maps = window.fixtureMaps.filter(map => map?._loaded && map.getContainer().isConnected);
        const readiness = document.querySelector('[data-print-export-readiness]')?.dataset.printExportReadiness;
        if (readiness === 'error') throw new Error('Export readiness failed while awaiting the intended camera');
        const preview = maps.find(map => !map.getContainer().parentElement.dataset.printExportMapFrame);
        const capture = maps.find(map => map.getContainer().parentElement.dataset.printExportMapFrame);
        const matches = map => map && Math.abs(map.getZoom() - zoom) < 0.001
          && map.project(map.getCenter(), zoom).distanceTo(map.project(center, zoom)) <= 1.6
          && map.getContainer().parentElement.dataset.fixedTownSurfaceTier === expectedTier;
        return readiness === 'ready' && matches(preview) && matches(capture);
      }, { zoom, center, expectedTier }, { timeout: 10000 });
    } catch (error) {
      report.lastParity = { expectedTier, intendedCamera: { zoom, center }, snapshot: await read() };
      throw error;
    }
    (report.parityReadinessWaits ||= []).push({ expectedTier, zoom, center, elapsedMs: Date.now() - waitStarted });
    const snapshot = await read();
    report.lastParity={expectedTier,snapshot};
    const preview = snapshot.maps.find(m => !m.dataset.printExportMapFrame);
    const capture = snapshot.maps.find(m => m.dataset.printExportMapFrame);
    assert.equal(preview.dataset.fixedTownSurfaceTier, expectedTier);
    assert.equal(capture.dataset.fixedTownSurfaceTier, expectedTier);
    assert.ok(Math.abs(preview.zoom - capture.zoom) < 0.001, 'hidden capture uses the ready preview camera');
    assert.equal(preview.tiles, 0);
    assert.equal(capture.tiles, 0);
    assert.equal(snapshot.ready, 'ready');
    const label = String(Number(preview.zoom.toFixed(1)));
    assert.equal(preview.zoomLabel, label, 'Export desktop readout exposes fractional progress like Studio');
    if(snapshot.mobileZoomLabel !== null) assert.equal(snapshot.mobileZoomLabel, label, 'Export mobile readout matches the same decimal scale');
    return snapshot;
  };
  const resetMap = async () => {
    const button = page.getByRole('button', {name:'Reset map view',exact:true});
    // An unchanged-baseline focus scroll can move this oversized-frame control
    // between pointerdown/up. Keyboard activation exercises its real handler.
    await button.press('Enter');
    await page.waitForTimeout(100);
    await page.waitForFunction(() => {
      const maps = window.fixtureMaps.filter(m => m?._loaded && m.getContainer().isConnected);
      const preview = maps.find(m => !m.getContainer().parentElement.dataset.printExportMapFrame);
      const capture = maps.find(m => m.getContainer().parentElement.dataset.printExportMapFrame);
      return preview && capture && !preview.touchGestures?._active && !preview._rotating && !preview._animatingZoom
        && Math.abs(preview.getZoom() - capture.getZoom()) < 0.001
        && document.querySelector('[data-print-export-readiness]')?.dataset.printExportReadiness === 'ready';
    }, null, { timeout: 10000 });
    const snapshot = await read();
    report.resetSnapshot=snapshot;
    const preview = snapshot.maps.find(m=>!m.dataset.printExportMapFrame);
    const capture = snapshot.maps.find(m=>m.dataset.printExportMapFrame);
    assert.equal(preview.dataset.fixedTownRequestedScale,undefined,'Reset clears requested scale and pending input');
    assert.equal(snapshot.ready,'ready','reset camera is ready before the next input');
    assert.ok(Math.abs(preview.zoom-capture.zoom)<0.001,'reset camera reaches hidden capture');
    report.cases.push({name:'Reset setup ready',zoom:preview.zoom,preference:false});
  };
  for (const [direction, expectedZoom, tier] of [['out',15,'overview'],['out',14.5,'overview'],['in',15,'overview'],['in',15.5,'native']]) {
    const before = await currentMap();
    await page.locator('.leaflet-control-zoom-' + direction).first().click();
    await page.waitForTimeout(700);
    const after = await currentMap();
    assert.ok(Math.abs(after.zoom-expectedZoom)<0.001,'one '+direction+' button keeps its requested half step across the native boundary');
    const snapshot = await assertParity(tier);
    report.cases.push({name:'Export threshold half-step '+direction,before:before.zoom,after:after.zoom,label:snapshot.maps.find(m=>!m.dataset.printExportMapFrame).zoomLabel,tier});
  }
  await page.evaluate(() => {
    const map = window.fixtureMaps.find(item => item?._loaded && item.getContainer().isConnected && !item.getContainer().parentElement.dataset.printExportMapFrame);
    map.setZoom(14, { animate: false });
  });
  await page.waitForTimeout(700);
  const containedOverview = await currentMap();
  assert.ok(containedOverview.zoom >= 14 && containedOverview.zoom < 14.5, 'maximum-height overview keeps its valid coverage containment');
  for (let action = 0; action < 2; action++) {
    const before = await currentMap();
    await page.locator('.leaflet-control-zoom-out').first().press('Enter');
    await page.waitForTimeout(700);
    const after = await currentMap();
    report.cases.push({ name: 'Maximum-height export escapes overview containment', before: before.zoom, after: after.zoom });
    assert.ok(after.zoom < 14 && after.zoom < before.zoom - 0.01, 'outward input escapes the tall overview frame instead of snapping back');
    const maps = (await read()).maps;
    assert.ok(Math.abs(maps.find(map => !map.dataset.printExportMapFrame).zoom - maps.find(map => map.dataset.printExportMapFrame).zoom) < 0.001, 'tall preview and capture retain the same outward camera');
  }
  await page.evaluate(() => {
    const map = window.fixtureMaps.find(item => item?._loaded && item.getContainer().isConnected && !item.getContainer().parentElement.dataset.printExportMapFrame);
    map.setZoom(13, { animate: false });
  });
  await page.waitForFunction(() => window.fixtureMaps.filter(map => map?._loaded && map.getContainer().isConnected).every(map => Math.abs(map.getZoom() - 13) < 0.001));
  for (const expectedZoom of [13.1, 13.2, 13.3, 13.4]) {
    const pointer = await mapPoint();
    const requestStart = exportTileRequests.length;
    await page.mouse.move(pointer.x, pointer.y); await page.mouse.wheel(0, -fineWheelPixels);
    await page.waitForTimeout(700);
    report.fractionalExportAttempt = { expectedZoom, state: await read() };
    await page.waitForFunction(expected => {
      const maps = window.fixtureMaps.filter(map => map?._loaded && map.getContainer().isConnected);
      return maps.length === 2 && maps.every(map => Math.abs(map.getZoom() - expected) < 0.001
        && [...map.getContainer().querySelectorAll('.leaflet-tile-pane img')].some(img => img.complete && img.naturalWidth > 0));
    }, expectedZoom, { timeout: 10000 });
    const state = await read();
    for (const map of state.maps) {
      assert.ok(Math.abs(map.zoom - expectedZoom) < 0.001, 'Export preview and hidden capture retain the fractional inward camera');
      assert.equal(map.dataset.mapBasemapMode, 'live');
      assert.ok(map.tiles > 0);
    }
    assert.equal(state.maps.find(map => !map.dataset.printExportMapFrame).zoomLabel, String(expectedZoom));
    const preview = state.maps.find(map => !map.dataset.printExportMapFrame);
    assert.equal(preview.tileLayers[0].maxZoom, 13.5);
    assert.equal(preview.tileLayers[0].maxNativeZoom, 13);
    assert.ok(preview.tileLayers[0].tileZooms.every(zoom => zoom <= 13));
    const requestedZooms = exportTileRequests.slice(requestStart);
    assert.ok(requestedZooms.every(zoom => zoom <= 13), 'warm Export cannot request a higher native LOD while admitting fractional camera progress');
    const rgb = await screenshotPixel(page, { x: preview.x + preview.width / 4, y: Math.min(1120, preview.y + preview.height / 2) });
    assert.deepEqual(rgb, [208, 230, 240, 255], 'warm Export preview remains visibly painted through the fractional gap');
    report.cases.push({ name: 'Export fractional inward preview/capture parity', expectedZoom, rgb, requestedZooms, state });
  }
  for (let round = 0; round < Number(process.argv.find(a => a.startsWith('--rounds='))?.slice(9) || 10); round++) {
    await resetMap();
    await page.evaluate(() => {
      const map = window.fixtureMaps.find(m => m && m._loaded && m.getContainer().isConnected && !m.getContainer().parentElement.dataset.printExportMapFrame);
      map.setView([1.37, 103.74], 15, {
        animate: false
      });
    });
    await page.waitForTimeout(650);
    const before = await currentMap();
    const pointer = await mapPoint();
    await page.mouse.move(pointer.x, pointer.y);
    await page.mouse.wheel(0, fineWheelPixels);
    await page.waitForTimeout(700);
    const after = await currentMap();
    report.cases.push({
      name: 'first small wheel round ' + round,
      before: before.zoom,
      after: after.zoom
    });
    assert.ok(after.zoom < before.zoom, 'first small wheel keeps its requested outward scale');
    await assertParity('overview');
    await page.mouse.wheel(0, -fineWheelPixels);
    await page.waitForTimeout(700);
    assert.ok((await currentMap()).zoom > after.zoom, 'first inward action advances scale');
    await assertParity('native');
  }
  await resetMap();
  assert.equal((await read()).maps.find(m=>!m.dataset.printExportMapFrame).dataset.fixedTownRequestedScale,undefined,'explicit reset clears scale preference');
  const cancelPoint = await mapPoint();
  const touchSession = await page.context().newCDPSession(page);
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{
      id: 1,
      x: cancelPoint.x - 60,
      y: cancelPoint.y
    }, {
      id: 2,
      x: cancelPoint.x + 60,
      y: cancelPoint.y
    }]
  });
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: []
  });
  await page.waitForTimeout(500);
  assert.equal((await read()).maps.find(m => !m.dataset.printExportMapFrame).dataset.fixedTownRequestedScale, undefined, 'canceled pinch restores prior scale policy');
  await touchSession.detach();
  report.cases.push({
    name: 'canceled pinch restores policy',
    passed: true
  });
  await page.evaluate(() => {
    const map = window.fixtureMaps.find(m => m && m._loaded && m.getContainer().isConnected && !m.getContainer().parentElement.dataset.printExportMapFrame);
    map.setZoom(map.getMinZoom(), {
      animate: false
    });
  });
  await page.waitForTimeout(500);
  await page.locator('.leaflet-control-zoom-out').first().click({
    force: true
  });
  await page.locator('.leaflet-control-zoom-out').first().click({
    force: true
  });
  await page.waitForTimeout(1700);
  assert.equal((await read()).maps.find(m => !m.dataset.printExportMapFrame).dataset.fixedTownRequestedScale, undefined, 'no-zoom burst restores its first prior policy');
  report.cases.push({
    name: 'no-op burst expires without altering policy',
    passed: true
  });
  await resetMap();
  await page.evaluate(() => {
    const map = window.fixtureMaps.find(m => m && m._loaded && m.getContainer().isConnected && !m.getContainer().parentElement.dataset.printExportMapFrame);
    map.setView([1.37, 103.74], 15, {
      animate: false
    });
  });
  await page.waitForTimeout(700);
  const panPoint = await mapPoint();
  await page.mouse.move(panPoint.x, panPoint.y);
  await page.mouse.wheel(0, fineWheelPixels);
  await page.waitForTimeout(700);
  const panScale = (await currentMap()).zoom;
  await assertParity('overview');
  await page.mouse.down();
  await page.mouse.move(panPoint.x + 15, panPoint.y + 10, {
    steps: 5
  });
  await page.mouse.up();
  await page.waitForTimeout(700);
  assert.ok(Math.abs((await currentMap()).zoom - panScale) < 0.001, 'panning preserves accepted user scale');
  await assertParity('overview');
  await page.locator('.leaflet-control-zoom-in').first().click();
  await page.waitForTimeout(700);
  await assertParity('native');
  report.cases.push({
    name: 'pan retains requested scale and subsequent zoom returns native',
    passed: true
  });
  for (const direction of ['in', 'in', 'out', 'out', 'out', 'in', 'in']) {
    const before = await currentMap();
    await page.locator('.leaflet-control-zoom-' + direction).first().click();
    await page.waitForTimeout(550);
    const after = await currentMap();
    const expected = before.zoom + (direction === 'in' ? 0.5 : -0.5);
    assert.ok(Math.abs(after.zoom - expected) < 0.001, 'one ' + direction + ' action advances one raw half step');
    const state = await read();
    assert.equal(state.maps.find(m=>!m.dataset.printExportMapFrame).zoomLabel,String(Number(after.zoom.toFixed(1))),'Export readout shows the actual decimal zoom');
    report.cases.push({
      name: 'Export one-action zoom ' + direction,
      before: before.zoom,
      after: after.zoom
    });
  }
  const point = await page.evaluate(() => {
    const map = window.fixtureMaps.find(m => m && m._loaded && m.getContainer().isConnected && !m.getContainer().parentElement.dataset.printExportMapFrame);
    const box = map.getContainer().getBoundingClientRect();
    return {
      x: box.x + box.width / 2,
      y: Math.min(innerHeight - 80, box.y + box.height / 2)
    };
  });
  await page.mouse.move(point.x, point.y);
  const wheelBefore = await currentMap();
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(650);
  const wheelAfter = await currentMap();
  assert.ok(wheelAfter.zoom > wheelBefore.zoom, 'one Export mouse wheel action advances raw zoom');
  report.cases.push({
    name: 'Export single wheel action',
    before: wheelBefore.zoom,
    after: wheelAfter.zoom
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    ...point,
    deltaX: 0,
    deltaY: 120,
    modifiers: 2
  });
  await page.waitForTimeout(650);
  const pinchAfter = await currentMap();
  assert.ok(pinchAfter.zoom < wheelAfter.zoom, 'one emulated trackpad pinch action reduces raw zoom');
  report.cases.push({
    name: 'Export single emulated trackpad pinch action',
    before: wheelAfter.zoom,
    after: pinchAfter.zoom
  });
  await cdp.detach();
  for (const [name, file, signature] of [['Save Map PNG', 'map.png', 'PNG'], ['Save PDF', 'map.pdf', '%PDF']]) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', {
      name,
      exact: true
    }).click();
    const download = await pending;
    const target = path.join(out, file);
    await download.saveAs(target);
    const bytes = await fs.readFile(target);
    assert.ok(bytes.subarray(0, 8).toString('latin1').includes(signature), 'valid ' + file + ' download');
    report.cases.push({
      name: 'ready ' + name + ' download',
      bytes: bytes.length
    });
  }
  // The route return is a new authoritative camera request, rather than a gesture echo.
  await page.getByRole('button', {
    name: 'Back to interactive view',
    exact: true
  }).click();
  await page.waitForTimeout(650);
  report.cases.push({
    name: 'Back accepts pre-Export camera',
    state: await read()
  });
  const studioStart = await currentMap();
  await page.locator('.leaflet-control-zoom-in').first().click();
  await page.waitForTimeout(550);
  const studioAfter = await currentMap();
  assert.ok(Math.abs(studioAfter.zoom - studioStart.zoom - 0.5) < 0.001, 'Studio retains its existing half-step button');
  report.cases.push({
    name: 'Studio one-action zoom in',
    before: studioStart.zoom,
    after: studioAfter.zoom
  });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.writes, []);
  console.log(JSON.stringify({
    cases: report.cases.length,
    errors: report.errors,
    writes: report.writes,
    passed: true
  }));
} catch (e) {
  report.failure = e.stack;
  console.error(e.stack);
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await server.close();
  await fs.rm(path.join(out, 'cache'), {
    recursive: true,
    force: true
  });
}
