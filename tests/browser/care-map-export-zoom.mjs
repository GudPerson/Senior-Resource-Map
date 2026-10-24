import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';
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
  multiplePins = false
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
        annotations: [],
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
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64'),
      contentType: 'image/png'
    });
    return r.abort();
  });
}
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
try {
  browser = await chromium.launch({
    headless: true
  });
  const page = await browser.newPage({
    viewport: {
      width: 1600,
      height: 1200
    },
    hasTouch: true
  });
  await install(page, {
    multiplePins: true
  });
  await page.route('**/__carearound-town-maps/**', async route => {
    const u = new URL(route.request().url());
    const overview = u.pathname.includes('zoom14-atlas');
    const isIndex = u.pathname.endsWith('/manifest.json') && !u.pathname.includes('/surfaces/');
    if (u.pathname.endsWith('.json')) return route.fulfill({
      body: gunzipSync(await fs.readFile(path.join(repo, 'tests/fixtures/care-map-export-zoom', (overview ? isIndex ? 'overview-index' : 'overview-sg14' : isIndex ? 'native-index' : 'native-w01') + '.json.gz'))).toString('utf8'),
      contentType: 'application/json'
    });
    return route.fulfill({
      body: pixel,
      contentType: 'image/png'
    });
  });
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
    await page.mouse.wheel(0, 10);
    await page.waitForTimeout(700);
    const after = await currentMap();
    report.cases.push({
      name: 'first small wheel round ' + round,
      before: before.zoom,
      after: after.zoom
    });
    assert.ok(after.zoom < before.zoom, 'first small wheel keeps its requested outward scale');
    await assertParity('overview');
    await page.mouse.wheel(0, -10);
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
  await page.mouse.wheel(0, 10);
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
