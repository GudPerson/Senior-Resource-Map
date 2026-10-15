import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';
import { createPrintAnnotation } from '../../client/src/lib/printAnnotations.js';
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
  configFile: path.join(repo, 'tests/fixtures/care-map-view-controls/vite.config.mjs')
});
await server.listen();
let browser;
const layoutControlsOnly = process.argv.includes('--layout-controls-only');
const studioDoc = createMapStudioDocument();
studioDoc.revision = 1;
studioDoc.views[0].revision = 1;
studioDoc.views[0].design.camera = {
  mode: 'fixed',
  view: {
    center: [1.30, 103.85],
    zoom: 16
  }
};
studioDoc.views[0].design.layout.preset = 'full-map';
studioDoc.views[0].design.pins.style = 'numbered';
const rect = createPrintAnnotation({
  type: 'rectangle',
  points: [[1.3005, 103.8505], [1.3015, 103.8525]],
  text: '',
  style: {
    color: '#ff0000',
    weight: 0,
    fillColor: '#ff0000',
    fillOpacity: 1
  }
});
async function install(page, { multiplePins = false } = {}) {
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
    lat: 1.30,
    lng: 103.85,
    isPersonalPlace: true,
    saveEligible: false,
    status: 'active',
    mapShortDescriptors: []
  };
  const pin = {
    pinKey: 'personal:91261',
    placeKey: 'personal:91261',
    title: 'Fictional centre',
    lat: 1.30,
    lng: 103.85,
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
    const secondRow = { ...row, rowKey: 'personal:91262', assetKey: 'personal:91262', resourceId: 91262,
      personalPlaceId: 91262, name: 'Fictional second centre', lat: 1.3007, lng: 103.851 };
    const secondPin = { ...pin, pinKey: 'personal:91262', placeKey: 'personal:91262', title: secondRow.name,
      lat: secondRow.lat, lng: secondRow.lng };
    directory.personalPlaces.push({ ...secondRow, shortDescription: '', shortDescriptors: [] });
    directory.places.push({ ...secondPin, name: secondRow.name, address: secondRow.address, hasCoordinates: true,
      openProgrammeServiceCount: 0, rows: [secondRow] });
    directory.pins.push(secondPin);
    directory.summary = { ...directory.summary, resourceCount: 2, personalPlaceCount: 2, placeCount: 2, mappablePlaceCount: 2 };
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
        annotations: [rect],
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
try {
  browser = await chromium.launch();
  if (!process.argv.includes('--fullscreen-only')) {
    for (const scenario of [
      { name: 'desktop-balanced', preset: 'balanced', height: 'standard', viewport: { width: 1440, height: 1100 } },
      { name: 'desktop-beside', preset: 'map-focus', panel: 'beside-map', height: 'compact', viewport: { width: 1440, height: 1100 } },
      { name: 'desktop-full', preset: 'full-map', height: 'compact', viewport: { width: 1440, height: 1100 } },
      { name: 'phone-short', preset: 'balanced', height: 'standard', mobile: true, viewport: { width: 390, height: 640 } },
      { name: 'phone-compact', preset: 'balanced', height: 'compact', mobile: true, viewport: { width: 390, height: 640 } },
      { name: 'tablet-compact', preset: 'balanced', height: 'compact', mobile: true, viewport: { width: 768, height: 800 } },
    ].flatMap(scenario => scenario.mobile
      ? [0.9, 1, 1.4].map(scale => ({ ...scenario, scale, name: scenario.name + '-text-' + scale }))
      : [scenario])) {
      studioDoc.views[0].design.layout.preset = scenario.preset;
      studioDoc.views[0].design.layout.mapHeight = scenario.height;
      studioDoc.views[0].design.layout.resourcePanel = scenario.panel || 'responsive';
      const page = await browser.newPage({ viewport: scenario.viewport, isMobile: !!scenario.mobile, hasTouch: !!scenario.mobile });
      await install(page, { multiplePins: true });
      await page.goto(`http://127.0.0.1:4192/?fontScale=${scenario.scale || 1}`);
      await page.getByRole('button', { name: 'Reset to north', exact: true }).waitFor();
      await page.waitForTimeout(450);
      const readControls = scope => scope.evaluate(root => {
        const north = root.querySelector('[aria-label="Reset to north"]');
        const toggle = root.querySelector('[data-mobile-map-actions] button:last-child');
        const zoom = root.querySelector('.leaflet-control-zoom-out');
        const map = root.querySelector('.leaflet-container');
        const box = e => { const r = e?.getBoundingClientRect(); return r && { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const exposed = e => { const r = e?.getBoundingClientRect(); const hit = r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!e && (e === hit || e.contains(hit)); };
        const overlaps = (a, b) => !!a && !!b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        return { north: box(north), toggle: box(toggle), zoom: box(zoom), map: box(map), northExposed: exposed(north), toggleExposed: exposed(toggle),
          overlapsZoom: overlaps(box(north), box(zoom)) || overlaps(box(toggle), box(zoom)),
          bearing: north?.querySelector('svg')?.style.transform || '',
          camera: map?.parentElement?.dataset.mapControlledCenter,
          zoomLevel: map?.parentElement?.dataset.mapControlledZoom,
          northHint: north?.title || '' };
      });
      const controls = await readControls(page.locator('body'));
      report.cases.push({ name: scenario.name + ' North is inside the map and reachable', passed: controls.northExposed
        && controls.north.y >= controls.map.y && controls.north.y + controls.north.height <= controls.map.y + controls.map.height, controls });
      if (!scenario.mobile) {
        const map = page.locator('.leaflet-container:visible').first();
        const bounds = await map.boundingBox();
        for (const [axis, x, y] of [['vertical', 0, 120], ['horizontal', 120, 0]]) {
          const before = (await readControls(page.locator('body'))).bearing;
          await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          await page.keyboard.down('Shift'); await page.mouse.wheel(x, y); await page.keyboard.up('Shift');
          await page.waitForTimeout(450);
          const after = (await readControls(page.locator('body'))).bearing;
          report.cases.push({ name: scenario.name + ' native Shift trackpad ' + axis + ' rotates', passed: after !== before, before, after });
        }
        if (controls.northExposed) {
          const before = await readControls(page.locator('body'));
          await page.getByRole('button', { name: 'Reset to north', exact: true }).click();
          await page.waitForTimeout(250);
          const reset = await readControls(page.locator('body'));
          report.cases.push({ name: scenario.name + ' North resets without moving the camera and explains trackpad input',
            passed: reset.bearing === 'rotate(0deg)' && before.camera === reset.camera && before.zoomLevel === reset.zoomLevel
              && reset.northHint.includes('Shift'), before, reset });
        }
      } else {
        report.cases.push({ name: scenario.name + ' compact controls do not cover zoom out', passed: !controls.overlapsZoom
          && controls.north.width <= 33 && controls.toggle.width <= 33 && controls.toggleExposed, controls });
        await page.getByRole('button', { name: 'Full map', exact: true }).click();
        await page.waitForTimeout(450);
        const full = await readControls(page.locator('[data-mobile-full-map]'));
        report.cases.push({ name: scenario.name + ' fullscreen controls remain reachable and clear of zoom', passed: full.northExposed
          && full.toggleExposed && !full.overlapsZoom && full.north.y + full.north.height <= full.toggle.y, controls: full });
      }
      await page.screenshot({ path: path.join(out, scenario.name + '.png') });
      await page.close();
    }
    studioDoc.views[0].design.layout.preset = 'full-map';
    studioDoc.views[0].design.layout.mapHeight = 'standard';
    studioDoc.views[0].design.layout.resourcePanel = 'responsive';
  }
  if (!layoutControlsOnly && !process.argv.includes('--fullscreen-only')) {
    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 1024
      }
    });
    await install(page);
    const settle = () => page.waitForTimeout(800);
    const read = () => page.evaluate(() => {
      const frame = [...document.querySelectorAll('[data-map-basemap-mode]')].find(r => !r.closest('[data-print-export-hidden-root]'));
      return {
        bearing: frame?.querySelector('.leaflet-rotate-pane')?.style.transform || '',
        zoom: Number(frame?.dataset.mapControlledZoom),
        center: frame?.dataset.mapControlledCenter
      };
    });
    await page.goto('http://127.0.0.1:4192/');
    await page.getByRole('button', {
      name: 'Reset to north',
      exact: true
    }).waitFor();
    await settle();
    const rotateWithTrackpad = () => page.locator('.leaflet-container:visible').first().dispatchEvent('wheel', {
      deltaY: 9, deltaMode: 1, shiftKey: true, bubbles: true, cancelable: true
    });
    report.cases.push({ name: 'Owner removes both 45-degree buttons',
      passed: await page.getByRole('button', { name: /^Rotate (left|right)$/ }).count() === 0 });
    await rotateWithTrackpad();
    await settle();
    const owner = await read();
    report.cases.push({
      name: 'Owner browsing rotates',
      passed: owner.bearing.includes('0.785398')
    });
    await page.getByRole('button', {
      name: 'Export View',
      exact: true
    }).click();
    await settle();
    const inherited = await read();
    report.cases.push({
      name: 'Export View inherits the browsing angle',
      passed: inherited.bearing.includes('0.785398'),
      snapshot: inherited
    });
    report.cases.push({ name: 'Export removes both 45-degree buttons and retains one North control',
      passed: await page.getByRole('button', { name: /^Rotate (left|right)$/ }).count() === 0
        && await page.getByRole('button', { name: 'Reset to north', exact: true }).count() === 1 });
    await rotateWithTrackpad();
    await settle();
    const rotated = await read();
    report.cases.push({
      name: 'Export controls rotate independently',
      passed: rotated.bearing.includes('1.5708') || rotated.bearing.includes('1.570796'),
      snapshot: rotated
    });
    const buttons = await page.getByRole('button').allTextContents();
    const save = page.locator('[data-print-export-page-action="map"]');
    await save.waitFor();
    await save.waitFor({
      state: 'visible'
    });
    for (let i = 0; i < 60 && (await save.isDisabled()); i++) await page.waitForTimeout(500);
    report.cases.push({
      name: 'Rotated map download is ready',
      passed: !(await save.isDisabled())
    });
    if (await save.isDisabled()) throw new Error('Rotated export not ready');
    let d = page.waitForEvent('download');
    await save.click();
    await (await d).saveAs(out + '/' + 'rotated.png');
    report.cases.push({
      name: 'Actual rotated PNG downloaded',
      passed: true
    });
    d = page.waitForEvent('download');
    await page.locator('[data-print-pdf-export="a3"]').click();
    await (await d).saveAs(out + '/' + 'rotated.pdf');
    report.cases.push({
      name: 'Actual rotated PDF downloaded',
      passed: true
    });
    const cdp = await page.context().newCDPSession(page);
    const point = await page.evaluate(() => {
      const f = [...document.querySelectorAll('[data-map-basemap-mode]')].find(r => !r.closest('[data-print-export-hidden-root]'));
      const b = f.querySelector('.leaflet-container').getBoundingClientRect();
      return {
        x: b.x + b.width / 2,
        y: b.y + b.height / 2
      };
    });
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, -120);
    await settle();
    const mouseZoom = await read();
    report.cases.push({
      name: 'Export mouse wheel zoom preserves rotation',
      passed: mouseZoom.zoom > rotated.zoom && mouseZoom.bearing === rotated.bearing
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      ...point,
      deltaX: 0,
      deltaY: 120,
      modifiers: 2
    });
    await settle();
    const trackpadZoom = await read();
    report.cases.push({
      name: 'Export trackpad pinch zoom is independent of rotation',
      passed: trackpadZoom.zoom < mouseZoom.zoom && trackpadZoom.bearing === rotated.bearing
    });
    await page.getByRole('button', {
      name: 'Reset to north',
      exact: true
    }).click();
    await settle();
    const north = await read();
    report.cases.push({
      name: 'Export North restores only its angle',
      passed: north.bearing === '' && north.zoom === trackpadZoom.zoom && north.center === trackpadZoom.center
    });
    for (let i = 0; i < 60 && (await save.isDisabled()); i++) await page.waitForTimeout(500);
    d = page.waitForEvent('download');
    await save.click();
    await (await d).saveAs(out + '/' + 'north.png');
    await page.getByRole('button', {
      name: 'Back to interactive view',
      exact: true
    }).click();
    await settle();
    const restored = await read();
    report.cases.push({
      name: 'Back restores original browsing angle and camera',
      passed: restored.bearing === owner.bearing && restored.zoom === owner.zoom && restored.center === owner.center,
      snapshot: restored
    });
    await page.close();
  }
  const mobileProfiles = layoutControlsOnly ? [] : [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]];
  for (const [profile, viewport, fontScale] of mobileProfiles.flatMap(([name, size]) =>
    [0.9, 1, 1.4].map(scale => [scale === 1 ? name : `${name}-text-${scale}`, size, scale]))) {
    const page = await browser.newPage({
      viewport,
      isMobile: true,
      hasTouch: true
    });
    await install(page);
    await page.goto(`http://127.0.0.1:4192/?fontScale=${fontScale}`);
    await page.getByRole('button', {
      name: 'Open map controls',
      exact: true
    }).waitFor();
    async function checkNorthStack(scope, toggleLabel, name) {
      const north = scope.getByRole('button', { name: 'Reset to north', exact: true });
      const toggle = scope.getByRole('button', { name: toggleLabel, exact: true });
      const n = await north.boundingBox(), b = await toggle.boundingBox();
      const exposed = await north.evaluate(button => {
        const box = button.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return button === hit || button.contains(hit);
      });
      report.cases.push({ name: profile + ' ' + name, passed: n && b && exposed
          && n.y + n.height <= b.y && Math.abs(n.x + n.width / 2 - b.x - b.width / 2) <= 1
          && n.width >= 32 && n.height >= 32 && n.width <= 33 && n.height <= 33, north: n, toggle: b });
    }
    await checkNorthStack(page, 'Full map', 'North sits above expand and is reachable');
    report.cases.push({ name: profile + ' removes 45-degree controls',
      passed: await page.getByRole('button', { name: /^Rotate (left|right)$/ }).count() === 0 });
    await page.getByRole('button', {
      name: 'Full map',
      exact: true
    }).click();
    await page.waitForTimeout(600);
    await checkNorthStack(page.locator('[data-mobile-full-map]'), 'Back to list', 'North sits above return in fullscreen');
    const layout = await page.evaluate(() => {
      const menu = document.querySelector('button[aria-label="Open map controls"]');
      const header = menu.parentElement.parentElement;
      const h = header.getBoundingClientRect(),
        b = menu.getBoundingClientRect(),
        m = [...document.querySelectorAll('.leaflet-container')].at(-1).getBoundingClientRect(),
        n = document.querySelector('[data-fixture-navbar]').getBoundingClientRect();
      const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      const overlay = document.querySelector('[data-mobile-full-map]');
      const overlayRect = overlay.getBoundingClientRect();
      const seamHit = document.elementFromPoint(40, h.bottom + 2);
      return {
        overlayGap: overlayRect.top - h.bottom,
        fullscreenCoversSeam: overlay.contains(seamHit),
        headerTop: h.top,
        headerBottom: h.bottom,
        mapTop: m.top,
        navBottom: n.bottom,
        menuExposed: menu === hit || menu.contains(hit),
        titlePresent: header.textContent.includes('Fictional Care Map')
      };
    });
    report.cases.push({
      name: profile + ' fullscreen leaves the menu and map title above the canvas',
      passed: layout.headerTop >= layout.navBottom && layout.mapTop >= layout.headerBottom && layout.menuExposed && layout.titlePresent,
      layout
    });
    report.cases.push({
      name: profile + ' fullscreen begins at the title row without exposing the inline map',
      passed: Math.abs(layout.overlayGap) <= 1 && layout.fullscreenCoversSeam,
      layout
    });
    await page.screenshot({path: path.join(out, profile + '-fullscreen.png')});
    const cdp = await page.context().newCDPSession(page);
    const mapRect = await page.locator('[data-mobile-full-map] .leaflet-container').boundingBox();
    const touch = {
      id: 1,
      x: mapRect.x + mapRect.width / 2 + 45,
      y: mapRect.y + mapRect.height / 2 + 40
    };
    const camera = () => page.locator('[data-mobile-full-map] [data-map-controlled-center]').getAttribute('data-map-controlled-center');
    const start = await camera();
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [touch]
    });
    for (let n = 1; n <= 6; n++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{
          ...touch,
          x: touch.x + 50 * n / 6,
          y: touch.y - 35 * n / 6
        }]
      });
      await page.waitForTimeout(24);
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
    await page.waitForTimeout(300);
    const panned = await camera();
    await page.waitForTimeout(600);
    report.cases.push({
      name: profile + ' fullscreen native pan remains settled',
      passed: panned !== start && panned === (await camera())
    });
    const fullMap = page.locator('[data-mobile-full-map]');
    const middle = { x: mapRect.x + mapRect.width / 2, y: mapRect.y + mapRect.height / 2 };
    const fingers = angle => [
      { id: 1, x: middle.x - 45 * Math.cos(angle), y: middle.y - 45 * Math.sin(angle) },
      { id: 2, x: middle.x + 45 * Math.cos(angle), y: middle.y + 45 * Math.sin(angle) }
    ];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(0) });
    for (let n = 1; n <= 6; n++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(Math.PI * n / 24) });
      await page.waitForTimeout(24);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    const fullBearing = () => fullMap.locator('.leaflet-rotate-pane').evaluate(pane => pane.style.transform);
    report.cases.push({ name: profile + ' two-finger rotation remains available', passed: (await fullBearing()).includes('rotate(') });
    const readFull = () => fullMap.locator('[data-map-controlled-zoom]').getAttribute('data-map-controlled-zoom');
    const zoomBeforeNorth = await readFull(), centerBeforeNorth = await camera();
    await fullMap.getByRole('button', { name: 'Reset to north', exact: true }).tap();
    await page.waitForTimeout(300);
    report.cases.push({ name: profile + ' North leaves the fullscreen camera and panel intact',
      passed: await fullMap.count() === 1 && await camera() === centerBeforeNorth && await readFull() === zoomBeforeNorth
        && await fullBearing() === '' });
    const exposed = await page.evaluate(() => {
      const b = document.querySelector('button[aria-label="Open map controls"]');
      const r = b.getBoundingClientRect(),
        h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return b === h || b.contains(h);
    });
    report.cases.push({
      name: profile + ' menu remains accessible after panning',
      passed: exposed
    });
    if (layout.menuExposed) {
      await page.getByRole('button', {
        name: 'Open map controls',
        exact: true
      }).click();
      await page.waitForTimeout(300);
      report.cases.push({
        name: profile + ' fullscreen menu opens and is usable',
        passed: (await page.locator('body').innerText()).includes('Map options')
      });
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.getByRole('button', {
      name: 'Back to list',
      exact: true
    }).click();
    await page.waitForTimeout(500);
    report.cases.push({
      name: profile + ' closing fullscreen restores header and body',
      passed: await page.evaluate(() => !document.body.hasAttribute('data-owner-fullscreen-map-header') && document.body.style.overflow !== 'hidden')
    });
    await page.screenshot({
      path: out + '/' + profile + '.png'
    });
    await page.close();
  }
} catch (e) {
  report.failure = e.stack;
} finally {
  await browser?.close();
  await server.close();
  report.passed = report.cases.every(c => c.passed) && !report.errors.length && !report.writes.length && !report.failure;
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    out,
    ...report
  }));
  if (!report.passed) process.exitCode = 1;
}
