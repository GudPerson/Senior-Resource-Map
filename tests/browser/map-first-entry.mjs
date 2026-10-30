// Actual application routes with fictional APIs and synthetic pixels. Never use production credentials.
// Run from the repository: node tests/browser/map-first-entry.mjs [--out=PATH] [--port=4417] [--case=NAME]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const out = arg('out') || await fs.mkdtemp(path.join(os.tmpdir(), 'carearound-map-first-entry-'));
await fs.mkdir(out, { recursive: true });
const report = { boundary: 'Actual App/router/providers. Fictional intercepted auth/resources/maps, synthetic pixels, desktop and phone/tablet emulation. No production access, physical-device, Android PWA, heap or image-quality claim.', cases: [], cameraComparisons: [], ownerHeaderChecks: [], errors: [], unexpectedWrites: [], expectedDraftSaveAttempts: [], screenshots: [] };
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
const asset = { id: 82001, name: 'Fictional Alpha Centre', category: 'Fixture support', subCategory: 'Fixture centre', type: 'hard', resourceType: 'hard', resourceId: 82001, status: 'active', visibility: 'public', address: 'Fictional address', postalCode: '680001', lat: 1.38, lng: 103.75 };
const secondAsset = { ...asset, id: 82002, resourceId: 82002, name: 'Fictional Beta Centre', lat: 1.381, lng: 103.751 };
const resources = [asset, secondAsset, ...Array.from({ length: 10 }, (_, index) => ({ ...secondAsset, id: 82003 + index, resourceId: 82003 + index, name: `Fictional support resource ${index + 3}` }))];
const mapId = 91261012;
const documentFor = (gray = false) => {
  const value = createMapStudioDocument();
  value.revision = 1;
  value.views[0].revision = 1;
  value.views[0].design.camera = { mode: 'fixed', view: { center: [1.38, 103.75], zoom: 16 } };
  value.views[0].design.layout.preset = 'balanced';
  if (gray) value.views[0].design.basemap.style = 'gray';
  return value;
};
function directoryFor(kind = 'mixed', shared = false) {
  const makeRow = (id, mapped) => ({ rowKey: `personal:${id}`, assetKey: `personal:${id}`, resourceType: 'personal', resourceId: id, personalPlaceId: id, name: mapped ? 'Fictional mapped resource' : 'Fictional list-only resource', personalPlaceCategory: 'home', subCategory: 'Personal place', address: 'Fictional address', lat: mapped ? 1.38 : null, lng: mapped ? 103.75 : null, isPersonalPlace: true, saveEligible: false, status: 'active', mapShortDescriptors: [], notes: [{ id: `note-${id}`, text: 'Fictional stored owner note', isShared: false }] });
  const rows = kind === 'empty' ? [] : kind === 'list-only' ? [makeRow(91262, false)] : kind === 'mapped' ? [makeRow(91261, true)] : [makeRow(91261, true), makeRow(91262, false)];
  const mapped = rows.filter(row => Number.isFinite(row.lat));
  const directory = { id: mapId, name: 'Fictional Care Map', description: 'Entry-state regression fixture', categoryOrder: [], summary: { resourceCount: rows.length, savedResourceCount: 0, personalPlaceCount: rows.length, placeCount: rows.length, mappablePlaceCount: mapped.length }, share: { isShared: shared, shareToken: shared ? 'fictional-map-first' : null, embedEnabled: false, embedAllowedOrigins: [] }, assets: [], personalPlaces: rows.map(row => ({ ...row, shortDescription: '', shortDescriptors: [] })), places: rows.map(row => ({ pinKey: row.assetKey, placeKey: row.assetKey, title: row.name, name: row.name, address: row.address, lat: row.lat, lng: row.lng, hasCoordinates: Number.isFinite(row.lat), openProgrammeServiceCount: 0, rows: [row] })), pins: mapped.map(row => ({ pinKey: row.assetKey, placeKey: row.assetKey, title: row.name, lat: row.lat, lng: row.lng, curatedCount: 0, previewResourceNames: [] })), viewer: { isAuthenticated: !shared, isOwner: !shared, canSaveCopy: shared, canSaveResources: !shared } };
  if (kind === 'mixed') {
    const group = { rowKey:'soft-91263:group', assetKey:'soft-91263', resourceType:'soft', resourceId:91263, name:'Fictional list-only Group', subCategory:'Group', assetMode:'group', status:'list_only', mapFocusPlaceKeys:['personal:91261'], mapShortDescriptors:[] };
    directory.assets.push(group);
    directory.places.push({placeKey:'fallback-soft-91263',placeId:null,name:group.name,address:null,postalCode:'',lat:null,lng:null,hasCoordinates:false,rows:[group]});
    directory.summary.resourceCount++;
    directory.summary.savedResourceCount++;
    directory.summary.placeCount++;
  }
  return directory;
}
const metadata = Object.fromEntries(await Promise.all(['native-index', 'native-w01', 'overview-index', 'overview-sg14'].map(async key => [key, gunzipSync(await fs.readFile(path.join(repo, 'tests/fixtures/care-map-export-zoom', `${key}.json.gz`))).toString()])));
let server;
let browser;
let base;
{
  server = await createServer({
    configFile: path.join(repo, 'tests/fixtures/care-map-view-controls/vite.config.mjs'),
    root: path.join(repo, 'client'), cacheDir: path.join(out, 'vite-cache'),
    server: { host: '127.0.0.1', port: Number(arg('port') || 4417), strictPort: true, fs: { allow: [repo] } },
    plugins: [{ name: 'map-first-entry-observer', enforce: 'pre', transform(source, id) {
      if (id.endsWith('/features/discover/DiscoverDetailedBasemap.jsx')) return source.replaceAll('const map = useMap();', 'const map = useMap(); window.__registerMapFirst?.(map);');
      if (id.endsWith('/components/DirectoryMap.jsx')) return source.replace('mapInstanceRef.current = map;', 'mapInstanceRef.current = map; if (map) window.__registerMapFirst?.(map);');
    } }],
    define: {
      'import.meta.env.VITE_API_URL': '"/api"',
      'import.meta.env.VITE_SUPPORT_INBOX_ENABLED': '"true"',
      'import.meta.env.VITE_TOWN_MAP_PROOF_ENABLED': '"true"',
      'import.meta.env.VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED': '"true"',
      ...Object.fromEntries([['ASSET_BASE_URL', 'v2/native-scale-20260722/default'], ['GRAY_ASSET_BASE_URL', 'v2/native-scale-20260722/gray'], ['OVERVIEW_ASSET_BASE_URL', 'v3/zoom14-atlas-20260730/default'], ['GRAY_OVERVIEW_ASSET_BASE_URL', 'v3/zoom14-atlas-20260730/gray']].map(([key, value]) => [`import.meta.env.VITE_TOWN_MAP_${key}`, JSON.stringify(`/__carearound-town-maps/${value}`)])),
    },
  });
  await server.listen();
  base = server.resolvedUrls.local[0];
}
async function install(page, { owner = true, kind = 'mixed', shared = false, fontScale = 1, gray = false, saved = false } = {}) {
  const directory = directoryFor(kind, shared);
  page.on('pageerror', error => report.errors.push({ url: page.url(), message: error.message }));
  await page.addInitScript(scale => {
    localStorage.clear(); sessionStorage.clear();
    window.__mapFirstMaps = new Set();
    window.__mapFirstEvents = [];
    window.__registerMapFirst = map => {
      if (window.__mapFirstMaps.has(map)) return;
      window.__mapFirstMaps.add(map);
      map.on('zoomstart zoomend movestart moveend resize', event => window.__mapFirstEvents.push({ type: event.type, id: map._leaflet_id, zoom: map.getZoom(), at: performance.now() }));
    };
    const apply = () => document.documentElement.style.setProperty('--font-scale', String(scale));
    if (document.documentElement) apply(); else addEventListener('DOMContentLoaded', apply, { once: true });
  }, fontScale);
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith('/__carearound-town-maps/')) {
      const overview = url.pathname.includes('zoom14-atlas');
      if (url.pathname.endsWith('.json')) {
        const index = !url.pathname.includes('/surfaces/');
        return route.fulfill({ body: metadata[overview ? index ? 'overview-index' : 'overview-sg14' : index ? 'native-index' : 'native-w01'], contentType: 'application/json' });
      }
      return route.fulfill({ body: pixel, contentType: 'image/png' });
    }
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/discovery/location-indicators' && request.method() === 'POST') return route.fulfill({ json: { indicators: {} } }); // Existing read-only POST lookup.
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        const attempt = { method: request.method(), path: url.pathname };
        if (request.method() === 'PATCH' && new RegExp(`^/api/my-maps/${mapId}/(?:assets/(?:hard|soft)/[0-9]+|personal-places/[0-9]+)/notes$`).test(url.pathname)) {
          report.expectedDraftSaveAttempts.push(attempt);
          return route.fulfill({ status: 503, json: { error: 'Fictional save held to retain an unfinished draft.' } });
        }
        report.unexpectedWrites.push(attempt);
        return route.fulfill({ status: 409, json: { error: 'Unexpected fixture write.' } });
      }
      if (url.pathname === '/api/platform-access') return route.fulfill({ json: { settings: { publicDirectoryMode: 'open', publicRegistrationMode: 'open', publicLoginMode: 'open' } } });
      if (url.pathname.startsWith('/api/auth/')) return route.fulfill({ json: { user: owner ? { id: 91261, name: 'Fictional owner', role: 'standard', locale: 'en' } : null } });
      if (url.pathname.endsWith(`/my-maps/${mapId}`) || url.pathname.endsWith('/shared-maps/fictional-map-first')) return route.fulfill({ json: directory });
      if (url.pathname.endsWith(`/my-maps/${mapId}/studio`)) return route.fulfill({ json: { mapId, document: documentFor(gray), updatedAt: null } });
      if (url.pathname.endsWith(`/my-maps/${mapId}/print-annotations`)) return route.fulfill({ json: { mapId, schemaVersion: 1, annotations: [], revision: 1 } });
      if (url.pathname === '/api/favorites') return route.fulfill({ json: saved ? [{ ...asset, resourceType: 'hard', resourceId: asset.id }] : [] });
      if (url.pathname === '/api/hard-assets') return route.fulfill({ json: resources });
      if (url.pathname === '/api/sub-categories') return route.fulfill({ json: [{ id: 82001, name: 'Fixture centre', type: 'hard', color: '#0f766e' }] });
      return route.fulfill({ json: [] });
    }
    if (url.origin === new URL(base).origin) return route.continue();
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: '', contentType: 'text/css' });
    if (/onemap\.gov\.sg|maps\.carearound\.sg/.test(url.hostname)) return route.fulfill({ body: pixel, contentType: 'image/png' });
    return route.abort();
  });
}
async function shot(page, name) {
  const target = path.join(out, `${name}.png`);
  await page.screenshot({ path: target, fullPage: false });
  report.screenshots.push(target);
}
async function viewportMetrics(page, name) {
  const metrics = await page.locator(`[data-map-first="${name}"]`).evaluate(root => {
    const r = root.getBoundingClientRect();
    const map = root.querySelector('[data-map-first-map]')?.getBoundingClientRect();
    return { shell: { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }, map: map && { x: map.x, y: map.y, width: map.width, height: map.height, bottom: map.bottom }, viewport: { width: innerWidth, height: innerHeight }, overflowX: document.documentElement.scrollWidth - innerWidth, offenders: [...document.querySelectorAll('body *')].filter(e => e.getClientRects().length && !e.closest('[inert], [aria-hidden="true"]')).map(e => ({tag:e.tagName, className:typeof e.className==='string'?e.className:'',x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.x < -2 || e.right > innerWidth+2).slice(0,20) };
  });
  (report.viewportMetrics ||= []).push({case:page.__fixtureCase,name,...metrics});
  return metrics;
}
function assertViewport(metrics) {
  assert.ok(metrics.shell.width >= metrics.viewport.width - 3, 'shell spans app-window width');
  assert.ok(Math.abs(metrics.shell.bottom - metrics.viewport.height) <= 3, 'shell reaches viewport bottom');
  assert.ok(metrics.map?.height >= metrics.viewport.height * .55, 'map retains useful full-window area');
  assert.ok(metrics.overflowX <= 2, `no page horizontal overflow: ${JSON.stringify(metrics)}`);
}
const camera = page => page.evaluate(() => [...(window.__mapFirstMaps || [])].filter(map => map.getContainer()?.isConnected).map(map => {
  const element = map.getContainer(), r = element.getBoundingClientRect();
  const exposed = [[.5,.5],[.75,.25],[.9,.75]].some(([x,y]) => {
    const hit = document.elementFromPoint(r.left + r.width*x, r.top + r.height*y);
    return hit?.closest('.leaflet-container') === element;
  });
  return { id: map._leaflet_id, containerId: element._leaflet_id, exposed, width: r.width, height: r.height, center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom(), images: element.querySelectorAll('.leaflet-image-layer').length, liveTiles: element.querySelectorAll('.leaflet-tile-pane img').length };
}).filter(map => map.exposed && map.width && map.height));
async function checkHiddenTabOrder(page, shell) {
  const toggle = shell.locator('[data-map-first-resources-toggle]').first();
  await toggle.focus();
  for (let index = 0; index < 16; index++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-map-first-resources]'))), false, 'closed resource controls are skipped by keyboard');
  }
  await toggle.focus();
}
async function toggleResources(page, shell, { preserveSearch = true } = {}) {
  const toggle = shell.locator('[data-map-first-resources-toggle]').first();
  const panel = shell.locator('[data-map-first-resources]').first();
  if (!(await panel.isVisible())) await toggle.click();
  await panel.waitFor({ state: 'visible' });
  let search = panel.locator('input[type="search"], input[placeholder*="Search" i]').first();
  const query = 'Fictional';
  const hasSearch = preserveSearch && await search.count() > 0 && await search.isVisible();
  if (hasSearch) await search.fill(query);
  await page.waitForTimeout(450);
  const before = await camera(page);
  await toggle.click();
  await panel.waitFor({ state: 'hidden' });
  await checkHiddenTabOrder(page, shell);
  await toggle.click();
  await panel.waitFor({ state: 'visible' });
  if (hasSearch) assert.equal(await search.inputValue(), query, 'resource search survives close/reopen');
  await page.waitForTimeout(500);
  const after = await camera(page);
  report.cameraComparisons.push({ case: page.__fixtureCase, kind: await shell.getAttribute('data-map-first'), before, after, events: await page.evaluate(() => window.__mapFirstEvents?.slice(-30)) });
  if (before.length && after.length) {
    assert.ok(Math.abs(before[0].zoom - after[0].zoom) < 1e-8, `resource overlay preserves zoom: ${JSON.stringify({before,after})}`);
    assert.ok(before[0].center.every((value, i) => Math.abs(value - after[0].center[i]) < 1e-8), 'resource overlay preserves map center');
  }
  return { before, after, searchPreserved: hasSearch };
}
async function assertEssentialControlsExposed(page) {
  const observations = await page.locator('[data-map-first-map]').evaluate(root => {
    const candidates = [...root.querySelectorAll('.leaflet-control-zoom-in, .leaflet-control-zoom-out, .leaflet-control-attribution, [data-map-zoom-action], button[title], button[aria-label]')];
    return candidates.filter(element => element.matches('.leaflet-control-zoom-in, .leaflet-control-zoom-out, .leaflet-control-attribution, [data-map-zoom-action]') || /zoom|north|full map|back to list|return to map|expand map/i.test(element.getAttribute('title') || element.getAttribute('aria-label') || '')).map(element => {
      const r = element.getBoundingClientRect();
      const shown = r.width > 0 && r.height > 0 && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none';
      const hit = shown && document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      return { tag: element.tagName, label: element.getAttribute('aria-label') || element.getAttribute('title') || element.className, shown, exposed: Boolean(hit && (element === hit || element.contains(hit))), box: { x: r.x, y: r.y, width: r.width, height: r.height } };
    }).filter(element => element.shown);
  });
  assert.ok(observations.every(element => element.exposed), `essential controls and map credit exposed: ${JSON.stringify(observations.filter(element => !element.exposed))}`);
  const buttons = observations.filter(element => element.tag === 'BUTTON' || element.tag === 'A');
  for (let a=0; a<buttons.length; a++) for (let b=a+1; b<buttons.length; b++) {
    const left=buttons[a].box, right=buttons[b].box;
    const overlap=Math.max(0,Math.min(left.x+left.width,right.x+right.width)-Math.max(left.x,right.x))*Math.max(0,Math.min(left.y+left.height,right.y+right.height)-Math.max(left.y,right.y));
    assert.ok(overlap<=1, `map controls do not overlap: ${buttons[a].label}/${buttons[b].label}`);
  }
  return observations;
}
async function assertResourceGeometry(page, shell) {
  const panel=shell.locator('[data-map-first-resources]').first();
  if (!(await panel.isVisible())) await shell.locator('[data-map-first-resources-toggle]').click();
  const metrics=await panel.evaluate(element => ({ width: element.getBoundingClientRect().width, viewport: innerWidth, overflow: element.scrollWidth-element.clientWidth }));
  if (metrics.viewport<640) assert.ok(metrics.width/metrics.viewport>=.88, 'phone Resources is a near-full-width bottom sheet');
  assert.ok(metrics.overflow<=2, 'resource content has no horizontal overflow');
}
async function assertOwnerContext(page) {
  const header=page.locator('[data-owner-map-mobile-header="true"]');
  await header.waitFor({state:'visible'});
  const headerState=await header.evaluate(element=>({inert:element.inert||Boolean(element.closest('[inert]')),bottom:element.getBoundingClientRect().bottom}));
  const shellTop=await page.locator('[data-map-first="care-map"]').evaluate(element=>element.getBoundingClientRect().top);
  report.ownerHeaderChecks.push({...headerState,shellTop,gap:shellTop-headerState.bottom});
  assert.equal(headerState.inert,false,'owner header remains interactive in both V2 and classic');
  assert.ok(Math.abs(shellTop-headerState.bottom)<=1,'fixed map shell meets owner header without exposing underlying page');
  const name=header.getByText('Fictional Care Map',{exact:true});
  const titleExposed=await name.evaluate(element=>{const r=element.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return Boolean(hit&&(element===hit||element.contains(hit)));});
  assert.ok(titleExposed,'owner map name is visible above the map');
  await header.getByRole('button').first().click();
  const menu=page.getByRole('dialog').filter({visible:true}).last();
  await menu.waitFor({state:'visible'});
  assert.ok(await menu.getByRole('button').count()>0,'existing owner menu actions reachable');
  await page.keyboard.press('Escape');
  await menu.waitFor({state:'hidden'});
}
async function assertResultScrollCamera(page, shell) {
  const panel=shell.locator('[data-map-first-resources]').first();
  const before=await camera(page);
  const box=await panel.boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.8);
  await page.mouse.wheel(0,700);
  await page.waitForTimeout(600);
  const scroll=await panel.evaluate(root=>[root,...root.querySelectorAll('*')].filter(element=>element.scrollHeight>element.clientHeight+10&&/auto|scroll/.test(getComputedStyle(element).overflowY)).map(element=>({top:element.scrollTop,height:element.clientHeight,total:element.scrollHeight})));
  assert.ok(scroll.some(element=>element.top>0),'actual resource panel scroll occurred');
  const after=await camera(page);
  report.cameraComparisons.push({case:page.__fixtureCase,kind:'discover-result-scroll',before,after,scroll,events:await page.evaluate(()=>window.__mapFirstEvents.slice(-30))});
  assert.deepEqual(after.map(({id,center,zoom,width,height})=>({id,center,zoom,width,height})),before.map(({id,center,zoom,width,height})=>({id,center,zoom,width,height})),'resource scrolling preserves settled map instance/camera/frame');
}
async function assertOwnerDraftPreserved(page, shell) {
  const panel = shell.locator('[data-map-first-resources]').first();
  const toggle = shell.locator('[data-map-first-resources-toggle]').first();
  if (!(await panel.isVisible())) await toggle.click();
  await panel.getByRole('button', { name: /map notes/i }).first().click();
  let dialog = page.getByRole('dialog').last();
  await dialog.waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  assert.ok(await panel.isVisible(),'closing the notes dialog does not also dismiss Resources');
  await panel.getByRole('button',{name:/map notes/i}).first().click();
  dialog=page.getByRole('dialog').last();
  await dialog.getByRole('button', { name: /Fictional mapped resource/ }).first().click();
  const textarea = dialog.locator('textarea').first();
  await textarea.waitFor({ state: 'visible' });
  const draft = 'Unfinished fictional owner note retained across resource visibility.';
  await textarea.fill(draft);
  // The notes dialog intentionally covers the Resources button. Dispatch the
  // real button's DOM action to verify this parent visibility transition while
  // the local draft is unfinished; the server fixture stays unchanged and any
  // note save is refused. This is explicitly synthetic UI evidence.
  await toggle.evaluate(element => element.click());
  assert.equal(await textarea.inputValue(), draft, 'unfinished note survives resource hide');
  await toggle.evaluate(element => element.click());
  assert.equal(await textarea.inputValue(), draft, 'unfinished note survives resource reopen');
  await page.waitForTimeout(700);
  assert.equal(await textarea.inputValue(), draft, 'unfinished local draft is not replaced by the server fixture');
  await shot(page, 'desktop-owner-unfinished-note-preserved');
}
async function assertMapControlReturn(page, shell) {
  const before = await camera(page);
  const control = shell.locator('[data-map-first-map]').getByRole('button', { name: /back to list|return to.*list/i }).first();
  await control.click();
  await shell.waitFor({ state: 'hidden' });
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', 'map return restores page scrolling');
  await page.getByRole('button', { name: /full map|expand.*map/i }).filter({ visible: true }).first().click();
  await shell.waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
  const after = await camera(page);
  assert.equal(after.length, 1, 'return/re-entry keeps one visible map');
  if (before.length) {
    assert.ok(Math.abs(before[0].zoom - after[0].zoom) < 1e-8, 'map control return/re-entry retains zoom');
    assert.ok(before[0].center.every((value, index) => Math.abs(value-after[0].center[index]) < 1e-5), 'map control return/re-entry retains camera');
  }
}
async function runCase(label, options, fn) {
  if (arg('case') && !label.includes(arg('case'))) return;
  const context = await browser.newContext({ viewport: options.viewport, hasTouch: options.touch || false, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.__fixtureCase = label;
  page.setDefaultTimeout(12000);
  try {
    await install(page, options);
    await fn(page);
    report.cases.push({ name: label, passed: true });
  } catch (error) {
    report.cases.push({ name: label, passed: false, error: error.stack });
    await shot(page, `${label}-FAILED`).catch(() => {});
    const exit = page.locator('[data-map-first-exit="true"]');
    if (await exit.isVisible().catch(() => false)) {
      await exit.click().catch(() => {});
      (report.failureExitMetrics ||= []).push(await page.evaluate(label => ({case:label,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,navbarWidth:document.querySelector('.navbar-controls')?.getBoundingClientRect().width,navbarRight:document.querySelector('.navbar-controls')?.getBoundingClientRect().right}),label));
    }
  } finally { await context.close(); }
}
try {
  browser = await chromium.launch({ headless: true });
  const layouts = [{ name: 'desktop', viewport: { width: 1440, height: 900 } }, { name: 'phone', viewport: { width: 390, height: 844 }, touch: true }, { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: true, gray: true }];
  for (const layout of layouts) {
    await runCase(`${layout.name}-discover-empty-guest`, { ...layout, owner: false }, async page => {
      await page.goto(new URL('/discover?keep=fixture', base).href);
      const shell = page.locator('[data-map-first="discover"]');
      await shell.waitFor({ state: 'visible' });
      assertViewport(await viewportMetrics(page, 'discover'));
      const panel = shell.locator('[data-map-first-resources]').first();
      await panel.waitFor({ state: 'visible' });
      const search = shell.locator('input[type="search"]').first();
      await search.waitFor({ state: 'visible' });
      await search.fill('Fictional Alpha');
      await page.waitForTimeout(700);
      await panel.getByText('Fictional Alpha Centre', { exact: true }).first().waitFor();
      assert.equal(await panel.getByText('Fictional Beta Centre', { exact: true }).count(), 0, 'resource search narrows cards without saved pins');
      assert.ok(new URL(page.url()).searchParams.get('keep') === 'fixture', 'unrelated URL parameter retained');
      await shot(page, `${layout.name}-discover-empty-search`);
      await assertEssentialControlsExposed(page);
      await assertResourceGeometry(page,shell);
      await toggleResources(page, shell, { preserveSearch: false });
      assert.equal(await search.inputValue(), 'Fictional Alpha', 'compact search survives resource overlay toggle');
      await shell.locator('[data-map-first-exit]').first().click();
      await shell.waitFor({ state: 'hidden' });
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', 'exit restores body scrolling');
    });
    await runCase(`${layout.name}-discover-saved-pin`, { ...layout, owner: true, saved: true }, async page => {
      await page.goto(new URL('/discover', base).href);
      const shell = page.locator('[data-map-first="discover"]');
      await shell.waitFor({ state: 'visible' });
      await shell.locator('.leaflet-container').first().waitFor();
      await shell.locator('.leaflet-marker-icon').first().waitFor();
      await page.waitForTimeout(1400);
      const box = await shell.locator('.leaflet-container').boundingBox();
      await page.mouse.move(box.x + box.width*.75, box.y + box.height*.5);
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(650);
      assertViewport(await viewportMetrics(page, 'discover'));
      await toggleResources(page, shell);
      await assertResultScrollCamera(page,shell);
      await assertResourceGeometry(page,shell);
      await assertEssentialControlsExposed(page);
      await shot(page, `${layout.name}-discover-saved-pin-resources`);
    });
    for (const kind of ['mixed', 'list-only', 'empty']) {
      await runCase(`${layout.name}-owner-${kind}`, { ...layout, owner: true, kind }, async page => {
        await page.goto(new URL(`/my-directory/maps/${mapId}`, base).href);
        const shell = page.locator('[data-map-first="care-map"]');
        await shell.waitFor({ state: 'visible' });
        await page.waitForTimeout(1000);
        assertViewport(await viewportMetrics(page, 'care-map'));
        await assertOwnerContext(page);
        if (kind === 'mixed') {
          await page.waitForFunction(() => document.querySelectorAll('[data-map-first="care-map"] .leaflet-image-layer').length > 0);
          const active = await camera(page);
          assert.equal(active.length, 1, 'one visible owner map camera');
          assert.ok(active[0].images > 0, 'fixed Detailed chunks are active');
          assert.equal(active[0].liveTiles, 0, 'Detailed has no live map tiles');
          if (layout.gray) assert.ok(await page.locator('[data-map-first="care-map"] .leaflet-image-layer').first().getAttribute('src').then(src => src.includes('/gray/')), 'Gray fixed source retained');
        }
        await toggleResources(page, shell);
        const panel = shell.locator('[data-map-first-resources]').first();
        if (kind === 'mixed') {
          await panel.getByText('Fictional list-only Group',{exact:true}).first().waitFor();
          const text=await panel.textContent();
          const mapped=text.indexOf('Fictional mapped resource'), group=text.indexOf('Fictional list-only Group');
          assert.ok(layout.name==='desktop'?mapped<group:group<mapped,'desktop preserves its order; mobile retains Group-first order');
        }
        if (kind !== 'empty') await panel.getByText(kind === 'list-only' ? 'Fictional list-only resource' : 'Fictional mapped resource', { exact: true }).first().waitFor();
        await shot(page, `${layout.name}-owner-${kind}-resources`);
        if (kind !== 'empty') {
          const title=panel.getByText(kind==='list-only'?'Fictional list-only resource':'Fictional mapped resource',{exact:true}).first();
          await title.scrollIntoViewIfNeeded();
          assert.ok(await title.evaluate(element=>{const r=element.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return Boolean(hit&&(element===hit||element.contains(hit)));}),'resource title is reachable through panel scrolling');
        }
        await assertEssentialControlsExposed(page);
        await assertResourceGeometry(page,shell);
        if (layout.name === 'phone' && kind === 'mixed') {
          await assertMapControlReturn(page,shell);
          await page.setViewportSize({width:844,height:390});
          await page.waitForTimeout(900);
          await assertOwnerContext(page);
          await toggleResources(page,shell);
          await assertEssentialControlsExposed(page);
          await shot(page,'phone-owner-short-landscape-resources');
          await page.setViewportSize(layout.viewport);
          await page.evaluate(()=>{document.documentElement.style.setProperty('--font-scale','1.4');document.documentElement.style.fontSize='22.4px';});
          await page.waitForTimeout(700);
          await assertOwnerContext(page);
          await assertResourceGeometry(page,shell);
          await assertEssentialControlsExposed(page);
          assertViewport(await viewportMetrics(page,'care-map'));
          await shot(page,'phone-owner-large-text-resources');
          await page.evaluate(()=>{document.documentElement.style.setProperty('--font-scale','1');document.documentElement.style.fontSize='';});
          await page.waitForTimeout(400);
        }
        if (layout.name === 'tablet' && kind === 'empty') {
          for (const width of [640, 768, 1023]) {
            await page.setViewportSize({width,height:1024});
            await page.waitForTimeout(250);
            assertViewport(await viewportMetrics(page,'care-map'));
            const nav = await page.locator('nav.navbar-static-scale').evaluate(root => ({
              brandCompact:getComputedStyle(root.querySelector('.brand-lockup > div')).display==='none',
              actions:[...root.querySelectorAll('button,select,a')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:e.id||e.getAttribute('aria-label'),width:r.width,inside:r.x>=0&&r.right<=innerWidth,exposed:Boolean(hit&&(e===hit||e.contains(hit)))}}),
            }));
            (report.compactNavbarChecks ||= []).push({width,...nav});
            assert.ok(nav.brandCompact,'tablet workspace uses compact brand');
            assert.ok(nav.actions.every(action=>action.inside&&action.exposed),'all existing navigation actions remain inside the viewport and reachable');
          }
          await page.setViewportSize(layout.viewport);
          await page.waitForTimeout(250);
        }
        await shell.locator('[data-map-first-exit]').first().click();
        await shell.waitFor({ state: 'hidden' });
        if (layout.name === 'tablet' && kind === 'empty') {
          assert.equal(await page.locator('[data-map-first]').count(),0,'active workspace marker is removed on exit');
          assert.notEqual(await page.locator('nav .brand-lockup > div').evaluate(e=>getComputedStyle(e).display),'none','legacy tablet wordmark restores after exit');
          report.legacyTabletNavbarAfterExit = await page.evaluate(()=>({width:innerWidth,overflowX:document.documentElement.scrollWidth-innerWidth}));
        }
        assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', 'owner exit restores body scrolling');
        await page.goto(new URL('/discover', base).href);
        await page.locator('[data-map-first="discover"]').waitFor({ state: 'visible' });
        await page.goBack();
        await page.locator('[data-map-first="care-map"]').waitFor({ state: 'visible' });
        assert.equal(new URL(page.url()).pathname, `/my-directory/maps/${mapId}`, 'browser Back restores owner route');
        if (layout.name === 'desktop' && ['mixed','empty'].includes(kind)) {
          await page.goto(new URL(`/my-directory/maps/${mapId}?ui=stable`,base).href);
          const classic=page.locator('[data-map-first="care-map"]');
          await classic.waitFor({state:'visible'});
          assert.equal(await page.locator('[data-my-map-ui="v2"]').count(),0,'explicit stable route selects the classic owner branch');
          await assertOwnerContext(page);
          await toggleResources(page,classic);
          await assertResourceGeometry(page,classic);
          await assertEssentialControlsExposed(page);
          await shot(page,`desktop-owner-classic-${kind}-resources`);
          await classic.locator('[data-map-first-exit]').click();
          await classic.waitFor({state:'hidden'});
          assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden','classic exit restores scrolling');
          await page.locator('[data-map-first-enter]').click();
          await classic.waitFor({state:'visible'});
          await page.goto(new URL(`/my-directory/maps/${mapId}`,base).href);
          await page.locator('[data-map-first="care-map"]').waitFor({state:'visible'});
        }
        if (layout.name === 'desktop' && kind === 'mixed') await assertOwnerDraftPreserved(page, page.locator('[data-map-first="care-map"]'));
      });
    }
  }
  for (const [name, route, shared] of [['shared', '/shared/maps/fictional-map-first', true], ['export', `/my-directory/maps/${mapId}?view=print&studioView=view-default`, false]]) {
    await runCase(`${name}-default-opt-out`, { viewport: { width: 1440, height: 900 }, owner: !shared, shared }, async page => {
      await page.goto(new URL(route, base).href);
      await page.locator('.leaflet-container').first().waitFor();
      assert.equal(await page.locator('[data-map-first]').count(), 0, `${name} retains prior default`);
      await shot(page, `${name}-baseline-default`);
    });
  }
  assert.ok(report.cases.length>0,'at least one case matches the requested filter');
  assert.equal(report.errors.length, 0, 'no application page errors');
  assert.equal(report.unexpectedWrites.length, 0, 'no unexpected fictional writes');
  assert.ok(report.cases.every(test => test.passed), 'all map-first entry cases pass');
  report.passed = true;
} catch (error) { report.passed = false; report.failure = error.stack; process.exitCode = 1; }
finally {
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await server?.close();
  console.log(JSON.stringify({ out, passed: report.passed, cases: report.cases.length, failed: report.cases.filter(test => !test.passed).map(test => ({ name: test.name, error: test.error?.split('\n')[0] })), errors: report.errors, unexpectedWrites: report.unexpectedWrites }));
}
