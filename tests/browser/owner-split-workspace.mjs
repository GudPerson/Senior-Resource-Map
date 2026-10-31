// Actual App with fictional intercepted owner APIs and synthetic map pixels.
// node tests/browser/owner-split-workspace.mjs [--out=PATH] [--port=4427] [--case=NAME]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createMapStudioDocument } from '../../client/src/lib/mapStudioState.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const out = arg('out') || await fs.mkdtemp(path.join(os.tmpdir(), 'carearound-owner-split-'));
await fs.mkdir(out, { recursive: true });
const report = { boundary: 'Actual App/router/providers; fictional APIs, intercepted writes and synthetic pixels. Browser-emulated responsive/keyboard and controlled HTTP failure/concurrency. No real backend, production, private content, physical gestures or device/PWA proof.', workspaceFlag: arg('workspace-flag') ?? 'absent/source-default', cases: [], assertions: [], screenshots: [], errors: [], unexpectedWrites: [], expectedNoteFailures: [] };
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
const mapId = 91261031;
const owner = { id: 91261, name: 'Fictional workspace owner', role: 'standard', locale: 'en', postalCode: '680001' };
const clone = value => JSON.parse(JSON.stringify(value));
async function sourceFingerprint() {
  const sourcePaths = [...new Set([
    ...execFileSync('git', ['diff', '--name-only', '--', 'client/src'], { cwd: repo, encoding: 'utf8' }).trim().split('\n'),
    ...execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'client/src'], { cwd: repo, encoding: 'utf8' }).trim().split('\n'),
  ].filter(Boolean))].sort();
  return { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    files: Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, createHash('sha256').update(await fs.readFile(path.join(repo, file))).digest('hex')]))),
    harnessSha256: createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex') };
}
report.sourceBefore = await sourceFingerprint();
function documentFor({ viewCount = 2, longViewNames = false } = {}) {
  const value = createMapStudioDocument();
  value.revision = 1;
  value.views[0].revision = 1;
  value.views[0].design.camera = { mode: 'fixed', view: { center: [1.38, 103.75], zoom: 16 } };
  value.views[0].design.layout.preset = 'balanced';
  value.views.push({ ...clone(value.views[0]), id: 'fixture-second-view', name: 'Fictional second view' });
  for (let index = 2; index < viewCount; index++) value.views.push({ ...clone(value.views[0]), id: `fixture-view-${index + 1}`, name: `Fictional view ${index + 1}` });
  if (longViewNames) value.views.forEach((view, index) => { view.name = `Fictional detailed neighbourhood support planning view ${index + 1} with a long name`; });
  return value;
}
function directoryFor(kind = 'mixed', shared = false) {
  const rows = kind === 'empty' ? [] : Array.from({ length: kind === 'list-only' ? 1 : 24 }, (_, i) => ({
    rowKey: `personal:${91270 + i}`, assetKey: `personal:${91270 + i}`, resourceType: 'personal', resourceId: 91270 + i,
    personalPlaceId: 91270 + i, name: `Fictional workspace place ${i + 1}`, personalPlaceCategory: 'home', subCategory: 'Personal place',
    address: 'Fictional address', lat: kind === 'list-only' ? null : 1.377 + Math.floor(i / 6) * .0016, lng: kind === 'list-only' ? null : 103.745 + (i % 6) * .0018,
    isPersonalPlace: true, saveEligible: false, status: 'active', mapShortDescriptors: [],
    notes: [{ id: `note-${91270 + i}`, text: 'Fictional private owner note', isShared: false }],
  }));
  const mapped = rows.filter(row => Number.isFinite(row.lat));
  return { id: mapId, name: 'Fictional split Care Map', description: 'Independent split workspace fixture', categoryOrder: [],
    summary: { resourceCount: rows.length, savedResourceCount: 0, personalPlaceCount: rows.length, placeCount: rows.length, mappablePlaceCount: mapped.length },
    share: { isShared: shared, shareToken: shared ? 'fictional-split' : null, embedEnabled: false, embedAllowedOrigins: [] }, assets: [],
    personalPlaces: rows.map(row => ({ ...row, shortDescription: '', shortDescriptors: [] })),
    places: rows.map(row => ({ pinKey: row.assetKey, placeKey: row.assetKey, title: row.name, name: row.name, address: row.address, lat: row.lat, lng: row.lng, hasCoordinates: Number.isFinite(row.lat), openProgrammeServiceCount: 0, rows: [row] })),
    pins: mapped.map(row => ({ pinKey: row.assetKey, placeKey: row.assetKey, title: row.name, lat: row.lat, lng: row.lng, curatedCount: 0, previewResourceNames: [] })),
    viewer: { isAuthenticated: !shared, isOwner: !shared, canSaveCopy: shared, canSaveResources: !shared } };
}
const metadata = Object.fromEntries(await Promise.all(['native-index', 'native-w01', 'overview-index', 'overview-sg14'].map(async key => [key, gunzipSync(await fs.readFile(path.join(repo, 'tests/fixtures/care-map-export-zoom', `${key}.json.gz`))).toString()])));
let base;
const server = await createServer({
  configFile: path.join(repo, 'tests/fixtures/care-map-view-controls/vite.config.mjs'), root: path.join(repo, 'client'), cacheDir: path.join(out, 'vite-cache'),
  server: { host: '127.0.0.1', port: Number(arg('port') || 4427), strictPort: true, fs: { allow: [repo] } },
  plugins: [{ name: 'independent-owner-workspace-observer', enforce: 'pre', transform(source, id) {
    if (id.endsWith('/components/DirectoryMap.jsx')) return source.replace('mapInstanceRef.current = map;', 'mapInstanceRef.current = map; if (map) window.__qaMaps?.add(map);');
    if (id.endsWith('/components/MapStudioViewsPanel.jsx')) return source.replace('const defaultsRef = useRef(', `const qaInstance = useRef(null); if (!qaInstance.current) qaInstance.current = ++window.__qaStudioSequence;
      useEffect(() => { window.__qaStudioEvents.push({type:'mount',id:qaInstance.current}); return () => window.__qaStudioEvents.push({type:'unmount',id:qaInstance.current}); }, []);
      const defaultsRef = useRef(`).replace('onOwnerSessionChange?.(snapshot);', 'window.__qaStudioSessions.push({id:qaInstance.current,snapshot}); onOwnerSessionChange?.(snapshot);')
      .replace('useImperativeHandle(ref, () => ({', 'useImperativeHandle(ref, () => (window.__qaStudioImperative = {');
  } }],
  define: { 'import.meta.env.VITE_API_URL': '"/api"', 'import.meta.env.VITE_SUPPORT_INBOX_ENABLED': '"true"',
    'import.meta.env.VITE_OWNER_MAP_WORKSPACE_ENABLED': arg('workspace-flag') === undefined ? 'undefined' : JSON.stringify(arg('workspace-flag')), 'import.meta.env.VITE_TOWN_MAP_PROOF_ENABLED': '"true"', 'import.meta.env.VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED': '"true"',
    ...Object.fromEntries([['ASSET_BASE_URL', 'v2/native-scale-20260722/default'], ['GRAY_ASSET_BASE_URL', 'v2/native-scale-20260722/gray'], ['OVERVIEW_ASSET_BASE_URL', 'v3/zoom14-atlas-20260730/default'], ['GRAY_OVERVIEW_ASSET_BASE_URL', 'v3/zoom14-atlas-20260730/gray']].map(([key, value]) => [`import.meta.env.VITE_TOWN_MAP_${key}`, JSON.stringify(`/__carearound-town-maps/${value}`)])) },
});
await server.listen();
base = server.resolvedUrls.local[0];
let browser;
async function fixture(page, options = {}) {
  const state = { document: documentFor(options), studioLoads: 0, puts: [], nextResponse: 'success', nextLoadResponse: options.studioLoad || 'success', holds: [], loadHolds: [], directory: directoryFor(options.kind, options.shared) };
  if (options.longTitle) state.directory.name = 'Fictional neighbourhood community care and support planning map with a deliberately long accessible title';
  page.on('pageerror', error => report.errors.push({ case: page.__case, message: error.message }));
  await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); window.__qaMaps = new Set(); window.__qaStudioSequence = 0; window.__qaStudioEvents = []; window.__qaStudioSessions = []; window.__qaStudioImperative = null; });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith('/__carearound-town-maps/')) {
      if (url.pathname.endsWith('.json')) { const overview = url.pathname.includes('zoom14-atlas'), index = !url.pathname.includes('/surfaces/'); return route.fulfill({ body: metadata[overview ? index ? 'overview-index' : 'overview-sg14' : index ? 'native-index' : 'native-w01'], contentType: 'application/json' }); }
      return route.fulfill({ body: pixel, contentType: 'image/png' });
    }
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname.endsWith(`/my-maps/${mapId}/studio`)) {
        if (request.method() === 'GET') {
          state.studioLoads++;
          const success = () => route.fulfill({ json: { mapId, document: clone(state.document), updatedAt: null } });
          if (state.nextLoadResponse === 'error') return route.fulfill({ status: 503, json: { error: 'Fictional initial Studio load failure' } });
          if (state.nextLoadResponse === 'hold') return new Promise(resolve => state.loadHolds.push({ release: async () => { await success(); resolve(); } }));
          return success();
        }
        if (request.method() === 'PUT') {
          const payload = request.postDataJSON();
          const record = { payload: clone(payload), response: state.nextResponse, at: Date.now() }; state.puts.push(record);
          const success = async () => { assert.equal(payload.revision, state.document.revision, 'fixture receives current conditional revision'); state.document = { ...clone(payload), revision: state.document.revision + 1 }; return route.fulfill({ json: { mapId, document: clone(state.document), updatedAt: null } }); };
          if (state.nextResponse === 'hold') { state.nextResponse = 'success'; return new Promise(resolve => state.holds.push({ release: async () => { await success(); resolve(); } })); }
          if (state.nextResponse === 'error') return route.fulfill({ status: 503, json: { error: 'Fictional controlled Studio network failure' } });
          if (state.nextResponse === 'conflict') return route.fulfill({ status: 409, json: { error: 'Fictional controlled Studio revision conflict' } });
          return success();
        }
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        if (request.method() === 'PATCH' && new RegExp(`^/api/my-maps/${mapId}/personal-places/[0-9]+/notes$`).test(url.pathname)) { report.expectedNoteFailures.push({ case: page.__case, method: request.method(), path: url.pathname }); return route.fulfill({ status: 503, json: { error: 'Fictional notes failure retains unfinished draft' } }); }
        report.unexpectedWrites.push({ case: page.__case, method: request.method(), path: url.pathname }); return route.fulfill({ status: 409, json: { error: 'Unexpected fictional mutation' } });
      }
      if (url.pathname === '/api/platform-access') return route.fulfill({ json: { settings: { publicDirectoryMode: 'open', publicRegistrationMode: 'open', publicLoginMode: 'open' } } });
      if (url.pathname.startsWith('/api/auth/')) return route.fulfill({ json: { user: options.shared || options.guest ? null : owner } });
      if (url.pathname.endsWith(`/my-maps/${mapId}`) || url.pathname.endsWith('/shared-maps/fictional-split')) return route.fulfill({ json: state.directory });
      if (url.pathname.endsWith(`/my-maps/${mapId}/print-annotations`)) return route.fulfill({ json: { mapId, schemaVersion: 1, annotations: [], revision: 1 } });
      if (url.pathname === '/api/sub-categories') return route.fulfill({ json: [{ id: 91270, name: 'Personal place', type: 'hard', color: '#0f766e' }] });
      return route.fulfill({ json: [] });
    }
    if (url.origin === new URL(base).origin) return route.continue();
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: '', contentType: 'text/css' });
    if (/onemap\.gov\.sg|maps\.carearound\.sg/.test(url.hostname)) return route.fulfill({ body: pixel, contentType: 'image/png' });
    return route.abort();
  });
  return state;
}
async function shot(page, name) {
  await page.waitForFunction(() => [...document.querySelectorAll('[data-owner-workspace-tool]')].every(e => e.getAnimations().every(animation => animation.playState !== 'running')), null, { timeout: 3000 });
  const target = path.join(out, `${name}.png`); await page.screenshot({ path: target, fullPage: false, animations: 'disabled' }); report.screenshots.push(target);
}
async function waitUntil(fn, message, timeout = 10000) { const started = Date.now(); while (Date.now() - started < timeout) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 80)); } throw new Error(message); }
async function camera(page) { return page.evaluate(() => [...window.__qaMaps].filter(map => map.getContainer()?.isConnected).map(map => { const r = map.getContainer().getBoundingClientRect(); return { id: map._leaflet_id, containerId: map.getContainer()._leaflet_id, center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom(), frame: { x: r.x, y: r.y, width: r.width, height: r.height } }; }).filter(map => map.frame.width && map.frame.height)); }
async function settledCamera(page) { let last = '', stable = 0; for (let n = 0; n < 50; n++) { const value = await camera(page), key = JSON.stringify(value); stable = last === key ? stable + 1 : 0; last = key; if (value.length === 1 && stable >= 3) return value; await page.waitForTimeout(100); } throw new Error('One map did not settle'); }
async function openSplit(page, query = '') {
  await page.goto(new URL(`/my-directory/maps/${mapId}?keep=fixture&workspace=split${query}`, base).href);
  const shell = page.locator('[data-owner-workspace="split"]'); await shell.waitFor({ state: 'visible' });
  if (!['empty', 'list-only'].includes(page.__kind)) { await shell.locator('.leaflet-container').first().waitFor(); await settledCamera(page); }
  return shell;
}
const tool = (shell, name) => shell.locator(`[data-owner-workspace-tool="${name}"]`).first();
const panel = (shell, name) => shell.locator(`[data-owner-workspace-panel="${name}"]`).first();
const headerSelect = shell => shell.locator('[data-owner-workspace-view-select]');
async function statusLabel(shell) { const status = shell.locator('[data-owner-workspace-status]'); return await status.getAttribute('aria-label') || await status.textContent(); }
async function mode(shell) { const chip = shell.locator('[data-owner-workspace-mode]'); return await chip.count() ? await chip.getAttribute('data-owner-workspace-mode') : /Design/.test(await shell.locator('.owner-workspace-title').textContent()) ? 'design' : 'explore'; }
async function studio(page, shell) { const p = panel(shell, 'studio'); if (!await p.isVisible()) await tool(shell, 'studio').click(); await p.waitFor({ state: 'visible' }); await p.locator('[data-map-studio-design-controls]').waitFor({ state: 'visible' }); return p; }
async function activeStudioIdentity(page) { return page.evaluate(() => ({ events: window.__qaStudioEvents, active: window.__qaStudioEvents.reduce((set, event) => { if (event.type === 'mount') set.add(event.id); else set.delete(event.id); return set; }, new Set()).size, sequence: window.__qaStudioSequence, session: window.__qaStudioSessions.at(-1) })); }
async function unchangedController(page, initial, state, loads) { const now = await activeStudioIdentity(page); assert.deepEqual(now.events, initial.events, 'panel transitions do not unmount/remount the Studio controller'); assert.equal(now.active, 1, 'one live Studio controller'); assert.equal(state.studioLoads, loads, 'panel transitions do not reload Studio document'); assert.ok(now.session?.snapshot, 'live controller callback still publishes non-null session'); }
async function geometry(page, shell) {
  const result = await shell.evaluate(root => {
    const rect = node => { if (!node || !node.getClientRects().length || getComputedStyle(node).visibility === 'hidden') return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const resources = rect(root.querySelector('[data-owner-workspace-resources]')), inspector = rect(root.querySelector('.owner-workspace-inspector:not([hidden])'));
    const header = root.querySelector('[data-owner-workspace-header]') || root.querySelector('.owner-workspace-identity');
    return { viewport: { width: innerWidth, height: innerHeight }, fontSize: parseFloat(getComputedStyle(document.documentElement).fontSize), header: rect(header), overflow: document.documentElement.scrollWidth - innerWidth, resources, inspector,
      headerControls: [...root.querySelectorAll('[data-owner-workspace-view-select],[data-owner-workspace-status]')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(), dx = Math.min(8, r.width / 4), dy = Math.min(8, r.height / 4); const points = [[r.x + r.width / 2, r.y + r.height / 2], [r.x + dx, r.y + dy], [r.right - dx, r.y + dy], [r.x + dx, r.bottom - dy], [r.right - dx, r.bottom - dy]].map(([x, y]) => { const hit = document.elementFromPoint(x, y); return { x, y, exposed: Boolean(hit && (e === hit || e.contains(hit))) }; }); return { tag: e.tagName, label: e.getAttribute('aria-label'), rect: rect(e), exposed: points.every(point => point.exposed), points }; }),
      search: [...root.querySelectorAll('[data-owner-workspace-search] input,[data-owner-workspace-search] button')].filter(e => e.getClientRects().length).map(e => {
        const r = e.getBoundingClientRect(), dx = Math.min(8, r.width / 4), dy = Math.min(8, r.height / 4);
        const points = [[r.x + r.width / 2, r.y + r.height / 2], [r.x + dx, r.y + dy], [r.right - dx, r.y + dy], [r.x + dx, r.bottom - dy], [r.right - dx, r.bottom - dy]].map(([x, y]) => { const hit = document.elementFromPoint(x, y); return { x, y, exposed: Boolean(hit && (e === hit || e.contains(hit))), hit: hit?.outerHTML.slice(0, 300) }; });
        return { label: e.getAttribute('aria-label') || e.placeholder, rect: rect(e), exposed: points.every(point => point.exposed), points };
      }),
      credits: [...root.querySelectorAll('.leaflet-control-attribution,span,img')].filter(e => e.matches('.leaflet-control-attribution') || (e.tagName === 'SPAN' && e.childElementCount === 0 && e.textContent.includes('Singapore Land Authority')) || (e.tagName === 'IMG' && /OneMap/.test(e.alt))).map(e => {
        const r = e.getBoundingClientRect(), pointerHost = e.closest('[data-map-provider-credit]'), previous = pointerHost?.style.pointerEvents;
        // The existing badge ignores pointer events. Temporarily probe its
        // painted occlusion with pointer hit-testing; restore immediately.
        if (pointerHost) pointerHost.style.pointerEvents = 'auto';
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (pointerHost) pointerHost.style.pointerEvents = previous;
        return { text: e.textContent || e.alt, rect: rect(e), display: getComputedStyle(e).display, pointerProbe: Boolean(pointerHost), exposed: Boolean(r.width && r.height && hit && (e === hit || e.contains(hit))), hit: hit?.outerHTML.slice(0, 400) };
      }),
      controls: [...root.querySelectorAll('.leaflet-control button,.leaflet-control a')].filter(e => !e.closest('[hidden],[inert]') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => { const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, hit = document.elementFromPoint(x, y); return { name: e.getAttribute('aria-label') || e.title || e.textContent, rect: rect(e), exposed: Boolean(hit && (e === hit || e.contains(hit))), hitStack: document.elementsFromPoint(x, y).slice(0, 6).map(el => ({ tag: el.tagName, className: typeof el.className === 'string' ? el.className : '', label: el.getAttribute('aria-label'), data: { ...el.dataset } })) }; }), mobileActions: [...root.querySelectorAll('[data-mobile-map-actions]')].map(e => ({ rect: rect(e), data: { ...e.dataset }, html: e.outerHTML.slice(0, 1000) })) };
  });
  report.assertions.push({ case: page.__case, geometry: result }); assert.ok(result.overflow <= 2, `no horizontal overflow: ${JSON.stringify(result)}`);
  assert.ok(result.header && result.headerControls.length === 2, 'compact header retains one real view selector and save indicator');
  assert.ok(result.headerControls.every(control => control.rect.width >= 44 && control.rect.height >= 44 && control.exposed), `header view/save targets stay reachable at44px: ${JSON.stringify(result.headerControls)}`);
  if (result.viewport.width >= 1440 && result.fontSize <= 16.1) assert.ok(result.header.height <= 56, `normal desktop map header stays compact: ${JSON.stringify(result.header)}`);
  assert.ok(result.search.length >= 2 && result.search.every(x => x.exposed), `Search and adjacent map design entry stay reachable: ${JSON.stringify(result.search)}`);
  if (result.inspector) for (const control of result.search) {
    const intersection = { width: Math.max(0, Math.min(control.rect.right, result.inspector.right) - Math.max(control.rect.x, result.inspector.x)), height: Math.max(0, Math.min(control.rect.bottom, result.inspector.bottom) - Math.max(control.rect.y, result.inspector.y)) };
    assert.ok(intersection.width <= 1 || intersection.height <= 1, `whole Search/design target clears actual inspector: ${JSON.stringify({ control, inspector: result.inspector, intersection })}`);
  }
  assert.ok(result.controls.every(x => x.exposed), `map navigation hit targets remain reachable: ${JSON.stringify(result.controls)}`);
  if (result.controls.length) assert.ok(result.credits.some(credit => credit.text.includes('Singapore Land Authority') && credit.exposed), `existing map provider credit stays exposed: ${JSON.stringify(result.credits)}`);
  if (result.resources && result.inspector && result.viewport.width >= 1440) assert.ok(result.inspector.x - result.resources.right >= 360, `both panels leave a readable map corridor: ${JSON.stringify(result)}`);
  return result;
}
async function columns(page, shell, state) {
  const resources = shell.locator('[data-owner-workspace-resources]');
  if (!await resources.isVisible()) await tool(shell, 'resources').click();
  const grid = resources.locator('[data-map-first-card-grid]').first(); await grid.waitFor({ state: 'visible' });
  const expand = shell.locator('[data-map-first-columns-expand]'), shrink = shell.locator('[data-map-first-columns-shrink]');
  const initial = await settledCamera(page), savedLayout = clone(state.document.views[0].design.layout), puts = state.puts.length;
  const handles = await grid.evaluateHandle(root => [...root.children]);
  assert.ok(await handles.evaluate(nodes => nodes.length >= 3), 'wide-grid fixture has enough real resource groups');
  for (const expected of [1, 2, 3, 2, 1]) {
    const current = Number(await shell.getAttribute('data-map-first-columns'));
    if (expected > current) { await expand.focus(); await page.keyboard.press('Enter'); }
    if (expected < current) { await shrink.focus(); await page.keyboard.press('Space'); }
    await page.waitForTimeout(150);
    assert.equal(Number(await shell.getAttribute('data-map-first-columns')), expected, 'edge arrows change one column at a time');
    const actual = await grid.evaluate(root => [...root.children].slice(0, 3).map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width }; }));
    assert.equal(new Set(actual.slice(0, expected).map(rect => Math.round(rect.x))).size, expected, 'actual resource cards occupy requested columns');
    assert.ok(actual.every(rect => rect.width >= 240), 'resource columns remain readable');
    assert.ok(await handles.evaluate((nodes, root) => nodes.every((node, i) => node === root.children[i] && node.isConnected), await grid.elementHandle()), 'column changes retain resource card nodes');
    assert.deepEqual(await settledCamera(page), initial, 'column changes retain map/camera/frame');
    await geometry(page, shell); report.assertions.push({ case: page.__case, columns: expected, actual });
    await shot(page, `split-wide-${expected}-columns`);
  }
  assert.deepEqual(state.document.views[0].design.layout, savedLayout, 'workspace columns do not change saved view layout');
  assert.equal(state.puts.length, puts, 'workspace columns do not enqueue Studio save');
}
async function runCase(name, options, fn) {
  if (arg('case') && !arg('case').split(',').some(filter => name.includes(filter))) return;
  const context = await browser.newContext({ viewport: options.viewport || { width: 1728, height: 1000 }, hasTouch: options.touch || false });
  const page = await context.newPage(); page.__case = name; page.__kind = options.kind; page.setDefaultTimeout(12000);
  const state = await fixture(page, options);
  try { await fn(page, state); report.cases.push({ name, passed: true, studioPuts: state.puts, studioLoads: state.studioLoads }); }
  catch (error) { console.error(name, error.stack); report.cases.push({ name, passed: false, error: error.stack, studioPuts: state.puts, studioLoads: state.studioLoads, ui: await page.locator('body').innerText().catch(() => '') }); await shot(page, `${name}-FAILED`).catch(() => {}); }
  finally { for (const hold of [...state.holds.splice(0), ...state.loadHolds.splice(0)]) await hold.release().catch(() => {}); await context.close(); }
}

try {
  browser = await chromium.launch({ headless: true });
  if (arg('workspace-flag') === 'false') await runCase('release-false-default-policy', {}, async (page, state) => {
    await page.goto(new URL(`/my-directory/maps/${mapId}`, base).href); await page.locator('[data-map-first="care-map"]').waitFor();
    assert.equal(await page.locator('[data-owner-workspace="split"]').count(), 0, 'explicit false selects Current for a no-query owner route');
    await page.goto(new URL(`/my-directory/maps/${mapId}?workspace=split`, base).href); await page.locator('[data-owner-workspace="split"]').waitFor();
    assert.ok(await headerSelect(page.locator('[data-owner-workspace="split"]')).isVisible(), 'explicit split opt-in retains existing priority over false default');
    await page.goto(new URL(`/my-directory/maps/${mapId}?workspace=current`, base).href); await page.locator('[data-map-first="care-map"]').waitFor();
    assert.equal(await page.locator('[data-owner-workspace="split"]').count(), 0, 'explicit Current override remains authoritative'); assert.equal(state.puts.length, 0, 'presentation policy writes no Studio data');
  });
  if (arg('workspace-flag') !== 'false') {
    for (const classic of [false, true]) for (const kind of ['mixed', 'empty', 'list-only']) await runCase(`release-default-${classic ? 'classic' : 'v2'}-${kind}`, { kind }, async (page, state) => {
      await page.goto(new URL(`/my-directory/maps/${mapId}${classic ? '?ui=stable' : ''}`, base).href);
      const shell = page.locator('[data-owner-workspace="split"]'); await shell.waitFor();
      assert.equal(new URL(page.url()).searchParams.has('workspace'), false, 'normal owner entry has no workspace opt-in query');
      assert.equal(await page.locator('[data-my-map-ui="v2"]').count(), classic ? 0 : 1, 'no-query default covers the actual V2/classic branch');
      await waitUntil(async () => await headerSelect(shell).inputValue() === state.document.defaultViewId, 'default workspace uses actual loaded view');
      assert.equal(await mode(shell), 'explore', 'normal default entry does not enter Design');
      if (kind === 'mixed') await settledCamera(page);
      await geometry(page, shell); assert.equal(state.puts.length, 0, 'default entry changes no saved design'); await shot(page, `release-default-${classic ? 'classic' : 'v2'}-${kind}`);
      if (kind === 'mixed') { await headerSelect(shell).selectOption('fixture-second-view'); await waitUntil(async () => await headerSelect(shell).inputValue() === 'fixture-second-view', 'default header selects a real nondefault view'); }
      await tool(shell, 'more').click(); await panel(shell, 'more').getByRole('button', { name: 'Use current layout', exact: true }).click();
      await page.waitForURL(url => url.searchParams.get('workspace') === 'current'); await page.locator('[data-map-first="care-map"]').waitFor();
      assert.equal(await page.locator('[data-owner-workspace="split"]').count(), 0, 'guarded fallback exposes retained Current layout');
      if (kind === 'mixed') { await page.locator('[data-map-first-exit]').first().click(); assert.equal(await page.locator('[data-map-studio-owner-panel] select[id^="map-studio-view-"]').inputValue(), 'fixture-second-view', 'default-to-Current fallback retains nondefault selection'); }
      assert.equal(state.puts.length, 0, 'default and fallback are presentation-only');
    });
    await runCase('release-default-discover-exclusion', {}, async (page, state) => {
      await page.goto(new URL('/discover', base).href); await page.locator('[data-map-first="discover"]').waitFor();
      assert.equal(await page.locator('[data-owner-workspace="split"]').count(), 0, 'Discover retains its released shell'); assert.equal(state.studioLoads, 0, 'Discover does not mount an owner Studio controller'); assert.equal(state.puts.length, 0);
    });
    await runCase('release-default-shared-exclusion', { shared: true }, async (page, state) => {
      await page.goto(new URL('/shared/maps/fictional-split', base).href); await page.getByRole('heading', { name: 'Fictional split Care Map', exact: true }).first().waitFor();
      assert.equal(await page.locator('[data-owner-workspace="split"]').count(), 0, 'public Shared map does not inherit owner default'); assert.equal(await page.locator('[data-map-studio-owner-panel]').count(), 0, 'public Shared map has no owner controller UI'); assert.equal(state.studioLoads, 0, 'public Shared map makes no owner Studio request'); assert.equal(state.puts.length, 0);
    });
    await runCase('release-default-print-exclusion', {}, async (page, state) => {
      await page.goto(new URL(`/my-directory/maps/${mapId}?view=print&studioView=view-default`, base).href); await page.getByRole('button', { name: 'Save PDF', exact: true }).waitFor();
      assert.equal(await page.locator('[data-owner-workspace="split"]').count(), 0, 'Print/Export does not inherit interactive owner default'); assert.equal(await page.locator('[data-owner-workspace-header]').count(), 0, 'Print output has no floating workspace header'); assert.equal(state.puts.length, 0);
    });
  }
  await runCase('compact-header-clean-view-selection', {}, async (page, state) => {
    const shell = await openSplit(page), select = headerSelect(shell), controller = await activeStudioIdentity(page), loads = state.studioLoads;
    await select.waitFor(); await waitUntil(async () => await select.inputValue() === state.document.defaultViewId, 'header receives actual loaded default view');
    assert.equal(await mode(shell), 'explore', 'header starts in ordinary Explore'); assert.equal(await panel(shell, 'studio').isVisible(), false, 'real header selector works while Studio is closed');
    const before = await settledCamera(page); await select.selectOption('fixture-second-view');
    await waitUntil(async () => await select.inputValue() === 'fixture-second-view', 'clean header selection uses actual Studio view switch');
    assert.equal(await mode(shell), 'explore', 'clean header selection does not enter Design'); assert.equal(state.puts.length, 0, 'clean selection does not save a design or camera');
    assert.deepEqual(await settledCamera(page), before, 'equal-framing view selection preserves map instance/frame/camera'); await unchangedController(page, controller, state, loads);
    await geometry(page, shell); await shot(page, 'compact-header-desktop-browse');
    const headerCapture = path.join(out, 'compact-map-header.png'); await shell.locator('[data-owner-workspace-header]').screenshot({ path: headerCapture, animations: 'disabled' }); report.screenshots.push(headerCapture);
    await tool(shell, 'more').click(); await panel(shell, 'more').getByRole('button', { name: 'Use current layout', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('workspace') === 'current'); await page.locator('[data-map-first="care-map"]').waitFor(); await page.locator('[data-map-first-exit]').first().click();
    assert.equal(await page.locator('[data-map-studio-owner-panel] select[id^="map-studio-view-"]').inputValue(), 'fixture-second-view', 'retained Current presenter receives header-selected nondefault view');
  });
  await runCase('compact-header-queued-view-selection', {}, async (page, state) => {
    const shell = await openSplit(page), p = await studio(page, shell), select = headerSelect(shell), controller = await activeStudioIdentity(page), loads = state.studioLoads;
    const first = await select.inputValue(), before = await settledCamera(page); state.nextResponse = 'hold';
    await p.getByRole('button', { name: 'Numbered pins', exact: true }).click(); await select.selectOption('fixture-second-view');
    await waitUntil(() => state.holds.length === 1, 'header selection flush is held in flight');
    assert.equal(await select.inputValue(), first, 'header retains actual old view until flush succeeds');
    await waitUntil(async () => await select.isDisabled(), 'header mirrors existing view selector busy guard');
    await p.getByRole('button', { name: 'Large', exact: true }).click();
    await shell.locator('.owner-workspace-inspector > header').getByRole('button', { name: 'Close', exact: true }).click();
    assert.match(await statusLabel(shell), /Saving/i, 'small header indicator exposes real in-flight Studio status while panel is closed');
    await state.holds.shift().release();
    await waitUntil(async () => state.document.views[0].design.pins.style === 'numbered' && state.document.views[0].design.pins.size === 'large' && await select.inputValue() === 'fixture-second-view', 'header waits for original and queued design saves before view switch');
    assert.equal(state.puts.length, 2, 'one queued conditional save follows original flush'); assert.equal(await mode(shell), 'design', 'header preserves existing Design mode');
    assert.deepEqual(await settledCamera(page), before, 'header flush/view selection keeps the same map and equal framing'); await unchangedController(page, controller, state, loads);
    await shot(page, 'compact-header-queued-save-complete');
  });
  for (const response of ['error', 'conflict']) await runCase(`compact-header-${response}-view-selection`, {}, async (page, state) => {
    const shell = await openSplit(page), p = await studio(page, shell), select = headerSelect(shell), first = await select.inputValue();
    state.nextResponse = response; await p.getByRole('button', { name: 'Numbered pins', exact: true }).click(); await select.selectOption('fixture-second-view');
    const recovery = p.getByRole('button', { name: response === 'conflict' ? 'Reload latest' : 'Retry save', exact: true }); await recovery.waitFor();
    assert.equal(await select.inputValue(), first, 'failed header flush restores actual previous view selection'); assert.equal(await p.locator('select[id^="map-studio-view-"]').inputValue(), first, 'header and original selector remain in agreement');
    await shell.locator('.owner-workspace-inspector > header').getByRole('button', { name: 'Close', exact: true }).click();
    const status = shell.locator('[data-owner-workspace-status]'); assert.ok(await status.isEnabled(), 'closed-panel save failure is recoverable from compact header'); assert.match(await statusLabel(shell), /fail|error|could not|couldn.t save|not saved/i, 'small indicator has accessible Studio error description');
    await shot(page, `compact-header-${response}-closed-panel`); const previousMode = await mode(shell); await status.click(); await recovery.waitFor(); assert.equal(await mode(shell), previousMode, 'status recovery opens existing Studio without changing mode');
  });
  await runCase('compact-header-load-error-recovery', { studioLoad: 'error' }, async (page, state) => {
    const shell = await openSplit(page), select = headerSelect(shell); assert.ok(await select.isDisabled(), 'unloaded view selector cannot invent a selected view');
    await shell.locator('[data-owner-workspace-status]').click(); const p = panel(shell, 'studio'); await p.waitFor(); const retry = p.getByRole('button', { name: 'Retry views', exact: true }); await retry.waitFor();
    state.nextLoadResponse = 'success'; await retry.click(); await waitUntil(async () => await select.inputValue() === state.document.defaultViewId, 'header recovers actual views after existing load Retry');
    assert.equal(await mode(shell), 'explore', 'status-only error recovery does not enter Design'); assert.equal(await p.locator('[data-map-studio-design-controls]').count(), 0, 'error recovery does not expose editable Design implicitly'); assert.equal(state.puts.length, 0, 'load recovery writes nothing');
    await shot(page, 'compact-header-load-recovered-explore');
  });
  await runCase('compact-header-long-title-many-views', { longTitle: true, longViewNames: true, viewCount: 50 }, async (page, state) => {
    const shell = await openSplit(page), select = headerSelect(shell), controller = await activeStudioIdentity(page), loads = state.studioLoads;
    await waitUntil(async () => await select.locator('option:not([value=""])').count() === 50, 'header contains all fifty real named views');
    const title = shell.locator('[data-owner-workspace-map-name]'); await title.waitFor();
    assert.ok((await title.getAttribute('aria-label') || await title.getAttribute('title') || await title.textContent()).includes(state.directory.name), 'full long map title stays accessible');
    assert.ok((await select.locator('option').last().textContent()).includes(state.document.views.at(-1).name), 'full long view names stay available in native options');
    await select.selectOption(state.document.views.at(-1).id); await waitUntil(async () => await select.inputValue() === state.document.views.at(-1).id, 'last real view remains selectable');
    for (const viewport of [{ width: 1728, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport); await page.evaluate(() => { document.documentElement.style.setProperty('--font-scale', '1'); document.documentElement.style.fontSize = ''; }); await page.waitForTimeout(350); await geometry(page, shell); await shot(page, `compact-header-long-${viewport.width}-normal`);
      await page.evaluate(() => { document.documentElement.style.setProperty('--font-scale', '1.4'); document.documentElement.style.fontSize = '22.4px'; }); await page.waitForTimeout(350); await geometry(page, shell); await shot(page, `compact-header-long-${viewport.width}-large-text`);
      assert.equal(await select.inputValue(), state.document.views.at(-1).id, 'responsive compact header retains actual selected view'); await unchangedController(page, controller, state, loads);
    }
    assert.equal(state.puts.length, 0, 'long-title/many-view header reflow never writes design');
  });
  await runCase('split-initial-studio-load-error-retry', { studioLoad: 'error' }, async (page, state) => {
    const shell = await openSplit(page); await tool(shell, 'studio').click(); const p = panel(shell, 'studio'); await p.waitFor();
    const retry = p.getByRole('button', { name: 'Retry views', exact: true }); await retry.waitFor(); assert.ok(await retry.isEnabled(), 'initial load failure retains reachable Studio retry');
    state.nextLoadResponse = 'success'; await retry.click(); await p.locator('[data-map-studio-design-controls]').waitFor();
    assert.equal(await mode(shell), 'design', 'retry completes deferred direct Design entry');
    assert.equal(state.puts.length, 0, 'load retry does not write a design'); await shot(page, 'split-initial-load-recovered');
  });
  await runCase('split-initial-slow-studio-entry', { studioLoad: 'hold' }, async (page, state) => {
    await page.goto(new URL(`/my-directory/maps/${mapId}?workspace=split`, base).href); const shell = page.locator('[data-owner-workspace="split"]'); await shell.waitFor();
    await waitUntil(() => state.loadHolds.length > 0, 'initial Studio GET held'); await tool(shell, 'studio').click(); const p = panel(shell, 'studio'); await p.waitFor();
    assert.ok(await headerSelect(shell).isDisabled(), 'header view selection is unavailable until actual Studio load completes');
    assert.match(await statusLabel(shell), /Loading views/i, 'early open shows truthful loading rather than saved status');
    state.nextLoadResponse = 'success'; for (const hold of state.loadHolds.splice(0)) await hold.release();
    await p.locator('[data-map-studio-design-controls]').waitFor(); assert.equal(await mode(shell), 'design', 'early Studio intent enters Design after load');
    assert.equal(state.puts.length, 0, 'early entry does not save camera or design');
  });
  await runCase('split-real-tools-and-geometry', {}, async (page, state) => {
    const shell = await openSplit(page), before = await settledCamera(page), controller = await activeStudioIdentity(page), loads = state.studioLoads;
    assert.equal(controller.active, 1, 'one Studio controller on split entry');
    const p = await studio(page, shell); await geometry(page, shell); await shot(page, 'split-desktop-studio');
    const viewActions = p.locator('[data-owner-workspace-view-actions]'); if (await viewActions.count()) await viewActions.locator('summary').click();
    for (const name of ['New view', 'Duplicate', 'Rename', 'Set default', 'Delete']) assert.ok(await p.getByRole('button', { name, exact: true }).count(), `existing Studio command remains present: ${name}`);
    for (const name of ['edit', 'export', 'more']) { await tool(shell, name).click(); await panel(shell, name).waitFor({ state: 'visible' }); await geometry(page, shell); assert.deepEqual(await settledCamera(page), before, `${name} is an overlay-only change`); }
    await unchangedController(page, controller, state, loads);
    assert.equal(state.puts.length, 0, 'opening existing tools does not silently save a design');
    await shot(page, 'split-desktop-tools');
  });
  await runCase('split-studio-queue-and-errors', {}, async (page, state) => {
    const shell = await openSplit(page), p = await studio(page, shell), controller = await activeStudioIdentity(page), loads = state.studioLoads;
    const firstView = await p.locator('select[id^="map-studio-view-"]').inputValue();
    state.nextResponse = 'hold'; await p.getByRole('button', { name: 'Numbered pins', exact: true }).click();
    await waitUntil(() => state.holds.length === 1, 'initial delayed Studio save starts');
    await p.getByRole('button', { name: 'Large', exact: true }).click();
    await tool(shell, 'edit').click(); await panel(shell, 'edit').waitFor({ state: 'visible' });
    assert.match(await statusLabel(shell), /Saving/i, 'hidden Studio in-flight save status is truthful while another patch is queued');
    await state.holds.shift().release();
    await waitUntil(() => state.puts.length >= 2 && state.document.views[0].design.pins.size === 'large', 'queued change is persisted after first response');
    assert.equal(state.document.views[0].design.pins.style, 'numbered', 'first design patch retained');
    await unchangedController(page, controller, state, loads);
    await studio(page, shell); state.nextResponse = 'error'; await p.getByRole('button', { name: 'Extra large', exact: true }).click();
    await p.getByRole('button', { name: /retry save/i }).waitFor();
    const attempts = state.puts.length; await p.locator('select[id^="map-studio-view-"]').selectOption('fixture-second-view');
    await waitUntil(() => state.puts.length > attempts, 'view switch attempts existing flush');
    assert.equal(await p.locator('select[id^="map-studio-view-"]').inputValue(), firstView, 'failed flush retains current view');
    await tool(shell, 'export').click(); const printAction = panel(shell, 'export').getByRole('button', { name: /print|export view/i }).first();
    await printAction.click(); await page.waitForTimeout(300); assert.notEqual(new URL(page.url()).searchParams.get('view'), 'print', 'failed flush prevents Print navigation');
    await tool(shell, 'more').click(); await panel(shell, 'more').getByRole('button', { name: 'Use current layout', exact: true }).click();
    await page.waitForTimeout(300); assert.equal(new URL(page.url()).searchParams.get('workspace'), 'split', 'failed flush blocks Current fallback navigation');
    await studio(page, shell); state.nextResponse = 'success'; await p.getByRole('button', { name: /retry save/i }).click();
    await waitUntil(() => state.document.views[0].design.pins.size === 'extra-large', 'existing retry persists failed design');
    state.nextResponse = 'conflict'; await p.getByRole('button', { name: 'Standard', exact: true }).click();
    await p.getByRole('button', { name: /reload latest/i }).waitFor();
    assert.match(await p.textContent(), /another|conflict|changed/i, '409 exposes conflict recovery');
    await tool(shell, 'edit').click(); assert.equal(await shell.locator('[data-owner-workspace-status]').getAttribute('data-save-status'), 'error', 'closed inspector exposes failed save status');
    await studio(page, shell); await unchangedController(page, controller, state, loads); await shot(page, 'split-studio-conflict');
    state.nextResponse = 'success'; await p.getByRole('button', { name: /reload latest/i }).click();
    const confirm = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /reload|discard/i }) });
    if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button', { name: /reload|discard/i }).last().click();
    await waitUntil(() => state.studioLoads > loads, 'explicit conflict recovery reloads Studio');
  });
  await runCase('split-actual-edit-mode-lifetimes', {}, async (page, state) => {
    const shell = await openSplit(page), before = await settledCamera(page), controller = await activeStudioIdentity(page), loads = state.studioLoads;
    const selectedView = await headerSelect(shell).inputValue();
    await tool(shell, 'edit').click(); await panel(shell, 'edit').getByRole('button', { name: 'Annotate', exact: true }).click();
    await panel(shell, 'edit').locator('[data-print-annotation-toolbar]').waitFor();
    assert.ok(await headerSelect(shell).isDisabled(), 'always-visible header cannot switch views during annotation input ownership');
    assert.equal(await headerSelect(shell).inputValue(), selectedView, 'annotation entry keeps header selection');
    await unchangedController(page, controller, state, loads); assert.deepEqual(await settledCamera(page), before, 'actual annotation entry retains map and frame');
    await panel(shell, 'edit').getByRole('button', { name: 'Draw line', exact: true }).click();
    const mapRect = before[0].frame; await page.mouse.click(mapRect.x + mapRect.width * .5, mapRect.y + mapRect.height * .48);
    await panel(shell, 'edit').getByRole('button', { name: 'Undo last point', exact: true }).waitFor();
    await panel(shell, 'edit').getByRole('button', { name: 'Cancel tool', exact: true }).click();
    assert.equal(await panel(shell, 'edit').getByRole('button', { name: 'Undo last point', exact: true }).count(), 0, 'existing Cancel clears unfinished drawing without a new save');
    await shot(page, 'split-active-annotation');
    await panel(shell, 'edit').getByRole('button', { name: 'Close annotations', exact: true }).click();
    await shell.locator('[data-owner-workspace-resources]').getByRole('button', { name: 'Personal place', exact: true }).click();
    const chooser = page.getByRole('dialog', { name: 'Add personal place to map', exact: true }); await chooser.waitFor();
    await chooser.getByRole('button', { name: 'Choose map location', exact: true }).first().click();
    await panel(shell, 'edit').getByRole('button', { name: 'Cancel personal place', exact: true }).waitFor();
    assert.ok(await headerSelect(shell).isDisabled(), 'always-visible header cannot switch views during personal-place placement');
    assert.equal(await headerSelect(shell).inputValue(), selectedView, 'placement entry keeps header selection');
    await unchangedController(page, controller, state, loads); assert.deepEqual(await settledCamera(page), before, 'actual personal-place placement entry retains map and frame');
    assert.equal(await tool(shell, 'studio').isDisabled(), true, 'incompatible Studio entry disabled during placement');
    await shot(page, 'split-active-place-placement');
    await panel(shell, 'edit').getByRole('button', { name: 'Cancel personal place', exact: true }).click();
    await unchangedController(page, controller, state, loads); assert.equal(state.puts.length, 0, 'enter/cancel modes does not change saved Studio design');
  });
  await runCase('split-current-preserves-selected-saved-view', {}, async (page, state) => {
    const shell = await openSplit(page), p = await studio(page, shell);
    await p.locator('select[id^="map-studio-view-"]').selectOption('fixture-second-view');
    await p.getByRole('button', { name: 'Large', exact: true }).click();
    await waitUntil(() => state.document.views[1].design.pins.size === 'large', 'nondefault view design saved');
    await tool(shell, 'more').click(); await panel(shell, 'more').getByRole('button', { name: 'Use current layout', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('workspace') === 'current');
    await page.locator('[data-map-first="care-map"]').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('keep'), 'fixture', 'fallback preserves unrelated query');
    assert.equal(new URL(page.url()).searchParams.get('workspaceView'), 'fixture-second-view', 'fallback carries selected view identity');
    await page.locator('[data-map-first-exit]').first().click();
    const oldStudio = page.locator('[data-map-studio-owner-panel]'); await oldStudio.waitFor({ state: 'visible' });
    assert.equal(await oldStudio.locator('select[id^="map-studio-view-"]').inputValue(), 'fixture-second-view', 'Current reads selected nondefault view');
    assert.equal(state.document.views[1].design.pins.size, 'large', 'Current fallback does not restore old design/data');
    const count = state.puts.length;
    await page.goto(new URL(`/my-directory/maps/${mapId}?workspace=split&workspaceView=unknown-view`, base).href);
    await page.locator('[data-owner-workspace="split"]').waitFor();
    assert.equal(await page.locator('[data-map-studio-owner-panel] select[id^="map-studio-view-"]').inputValue(), state.document.defaultViewId, 'unknown presentation view falls back to default');
    assert.equal(state.puts.length, count, 'invalid view selector makes no mutation');
  });
  await runCase('split-wide-real-resource-columns', { viewport: { width: 2304, height: 1296 } }, async (page, state) => {
    const shell = await openSplit(page); await studio(page, shell); await columns(page, shell, state);
  });
  await runCase('split-keyboard-modal-and-notes-draft', {}, async (page, state) => {
    const shell = await openSplit(page), p = await studio(page, shell), controller = await activeStudioIdentity(page), loads = state.studioLoads;
    const actions = p.locator('[data-owner-workspace-view-actions]'); await actions.locator('summary').click(); assert.equal(await actions.getAttribute('open'), '', 'native View actions opens');
    await page.keyboard.press('Escape'); assert.equal(await actions.getAttribute('open'), null, 'Escape closes native View actions first'); assert.ok(await p.isVisible(), 'first Escape preserves Studio inspector');
    await page.locator('[data-guide-launcher]').click(); const guide = page.getByRole('dialog', { name: 'CareAround Guide', exact: true }); await guide.waitFor();
    await guide.getByRole('button', { name: 'Expand Guide', exact: true }).click(); await page.keyboard.press('Escape'); await guide.waitFor({ state: 'hidden' }); assert.ok(await p.isVisible(), 'foreground Guide owns Escape before inspector');
    const field = p.locator('select[id^="map-studio-view-"]'); await field.focus(); await page.keyboard.press('Escape'); await p.waitFor({ state: 'hidden' });
    assert.ok(await tool(shell, 'studio').evaluate(e => e === document.activeElement), 'Escape from inspector form returns focus to Studio trigger');
    const resources = shell.locator('[data-owner-workspace-resources]'); if (!await resources.isVisible()) await tool(shell, 'resources').click();
    await resources.getByRole('button', { name: /map notes/i }).first().click(); let dialog = page.getByRole('dialog').last(); await dialog.waitFor();
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); assert.ok(await resources.isVisible(), 'notes modal Escape does not close Resources');
    await resources.getByRole('button', { name: /map notes/i }).first().click(); dialog = page.getByRole('dialog').last();
    await dialog.getByRole('button', { name: /Fictional workspace place 1\b/ }).first().click(); const text = dialog.locator('textarea').first(); await text.waitFor();
    const draft = 'Fictional unfinished notes draft remains owned by its notes editor.'; await text.fill(draft);
    // Explicit synthetic DOM actions behind a foreground notes modal: they test
    // retained editor ownership, not physical reachability through the modal.
    await tool(shell, 'resources').evaluate(e => e.click()); await tool(shell, 'resources').evaluate(e => e.click());
    await page.waitForTimeout(400); assert.equal(await text.inputValue(), draft, 'independent unfinished notes survive resource presentation toggles');
    await unchangedController(page, controller, state, loads); await shot(page, 'split-independent-notes-draft');
  });
  await runCase('split-card-edit-mode-indicator', {}, async (page, state) => {
    const shell = await openSplit(page), controller = await activeStudioIdentity(page), loads = state.studioLoads;
    for (const marker of ['pin-visibility', 'remove-resources']) {
      await tool(shell, 'edit').click(); const edit = panel(shell, 'edit'); await edit.waitFor();
      const mode = edit.locator(`[data-owner-workspace-command="${marker}"]`); await mode.click();
      assert.equal(await mode.getAttribute('aria-pressed'), 'true', 'existing card mode is active');
      await shell.locator('.owner-workspace-inspector > header').getByRole('button', { name: 'Close', exact: true }).click(); await edit.waitFor({ state: 'hidden' });
      assert.equal(await tool(shell, 'edit').getAttribute('aria-pressed'), 'true', 'Edit rail retains active card-mode indicator while inspector is closed');
      await tool(shell, 'edit').click(); await edit.waitFor(); assert.equal(await mode.getAttribute('aria-pressed'), 'true', 'reopening retains same active mode');
      await mode.click(); assert.notEqual(await mode.getAttribute('aria-pressed'), 'true', 'existing mode toggle stops card editing');
      await shell.locator('.owner-workspace-inspector > header').getByRole('button', { name: 'Close', exact: true }).click(); await edit.waitFor({ state: 'hidden' });
      assert.equal(await tool(shell, 'edit').getAttribute('aria-pressed'), 'false', 'stopped mode clears Edit rail when inspector closes');
    }
    await unchangedController(page, controller, state, loads); assert.equal(state.puts.length, 0, 'mode indicator never changes saved Studio document');
  });
  await runCase('split-responsive-controller-draft-lifetime', {}, async (page, state) => {
    const shell = await openSplit(page), p = await studio(page, shell), controller = await activeStudioIdentity(page), loads = state.studioLoads;
    const initial = (await settledCamera(page))[0], saved = clone(state.document);
    await p.locator('[data-owner-workspace-view-actions] summary').click(); await p.getByRole('button', { name: 'Rename', exact: true }).click();
    const draft = 'Fictional view rename draft retained across actual breakpoints'; const input = p.locator('input[id^="map-studio-view-name-"]'); await input.fill(draft);
    for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1728, height: 1000 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(350);
      assert.ok(await p.isVisible(), 'same Studio inspector remains reachable through breakpoint resize'); assert.equal(await input.inputValue(), draft, 'unfinished view-name form survives actual viewport resize');
      const maps = await settledCamera(page); assert.equal(maps.length, 1, 'one connected map after breakpoint'); assert.equal(maps[0].id, initial.id, 'same map instance after actual breakpoint'); assert.equal(maps[0].containerId, initial.containerId, 'same map container after breakpoint');
      await unchangedController(page, controller, state, loads); await geometry(page, shell);
    }
    assert.deepEqual(state.document, saved, 'responsive exploration does not persist saved design/camera'); assert.equal(state.puts.length, 0, 'resizing and unfinished rename create no Studio writes');
    await p.getByRole('button', { name: 'Cancel', exact: true }).click(); await shot(page, 'split-responsive-retained-studio');
  });
  await runCase('split-real-saved-view-commands', {}, async (page, state) => {
    const shell = await openSplit(page), p = await studio(page, shell), controller = await activeStudioIdentity(page), loads = state.studioLoads;
    const choose = async name => { const menu = p.locator('[data-owner-workspace-view-actions]'); if (await menu.getAttribute('open') === null) await menu.locator('summary').click(); await menu.getByRole('button', { name, exact: true }).click(); };
    await choose('Rename'); const form = p.locator('form'), input = form.locator('input[id^="map-studio-view-name-"]'); await input.fill('Fictional renamed default'); await form.locator('button[type="submit"]').click();
    await waitUntil(() => state.document.views[0].name === 'Fictional renamed default', 'real Rename input/submit persists existing view');
    await choose('New view'); await input.fill('Fictional new owner view'); await form.locator('button[type="submit"]').click();
    await waitUntil(() => state.document.views.length === 3, 'real New input/submit creates view');
    const createdId = await p.locator('select[id^="map-studio-view-"]').inputValue(); assert.equal(state.document.views.find(view => view.id === createdId)?.name, 'Fictional new owner view', 'created view is selected');
    await choose('Duplicate'); await waitUntil(() => state.document.views.length === 4, 'real Duplicate persists another view');
    const duplicateId = await p.locator('select[id^="map-studio-view-"]').inputValue(); assert.notEqual(duplicateId, createdId, 'duplicate has independent identity');
    await choose('Set default'); await waitUntil(() => state.document.defaultViewId === duplicateId, 'real Set default persists selected view');
    await choose('Delete'); const dialog = page.locator('[role="dialog"],[role="alertdialog"]').filter({ visible: true }).last(); await dialog.waitFor(); await dialog.getByRole('button').last().click();
    await waitUntil(() => state.document.views.length === 3 && !state.document.views.some(view => view.id === duplicateId), 'real confirmed Delete removes only selected duplicate');
    assert.ok(state.document.views.some(view => view.id === state.document.defaultViewId), 'delete retains valid default view');
    await unchangedController(page, controller, state, loads); await shot(page, 'split-real-saved-view-commands');
  });
  await runCase('split-explicit-explore-mode-flush', {}, async (page, state) => {
    const shell = await openSplit(page), p = await studio(page, shell), controller = await activeStudioIdentity(page), loads = state.studioLoads;
    state.nextResponse = 'error'; await p.getByRole('button', { name: 'Numbered pins', exact: true }).click();
    await p.getByRole('button', { name: 'Explore', exact: true }).click();
    await waitUntil(() => state.puts.length > 0, 'Explore requests the existing pending Studio flush'); await p.getByRole('button', { name: 'Retry save', exact: true }).waitFor();
    assert.equal(await mode(shell), 'design', 'failed Explore flush keeps Design mode');
    assert.ok(await p.locator('[data-map-studio-design-controls]').isVisible(), 'failed Explore flush retains design controls/retry context');
    state.nextResponse = 'hold'; await p.getByRole('button', { name: 'Explore', exact: true }).click();
    await waitUntil(() => state.holds.length === 1, 'successful retry is deliberately held in flight');
    // Test-only observer exposes the actual imperative handle, never a new
    // production hook. This synthetic call verifies its busy guard directly.
    await page.evaluate(() => window.__qaStudioImperative.setMode('explore'));
    assert.equal(await mode(shell), 'design', 'imperative mode switch is blocked during an actual in-flight save');
    assert.ok(await p.locator('[data-map-studio-design-controls]').isVisible(), 'in-flight imperative call cannot leave Design');
    await p.getByRole('button', { name: 'Large', exact: true }).click();
    await state.holds.shift().release();
    await waitUntil(() => state.document.views[0].design.pins.style === 'numbered' && state.document.views[0].design.pins.size === 'large', 'one Explore click flushes both original and queued design patches');
    await waitUntil(async () => await mode(shell) === 'explore', 'successful explicit Explore action changes actual Studio mode');
    assert.equal(await p.locator('[data-map-studio-design-controls]').count(), 0, 'Explore has no editable Design controls');
    await unchangedController(page, controller, state, loads); await shot(page, 'split-explicit-explore-mode');
    await tool(shell, 'edit').click(); await studio(page, shell); await waitUntil(async () => await mode(shell) === 'design', 'explicit Studio reentry returns to Design');
    // Explicitly exercise the same authoritative handle in the retained Current
    // presenter too; these are labelled synthetic imperative safety checks.
    await page.goto(new URL(`/my-directory/maps/${mapId}?workspace=current`, base).href);
    const current = page.locator('[data-map-studio-owner-panel]'); await current.locator('select[id^="map-studio-view-"]').waitFor({ state: 'attached' });
    state.nextResponse = 'hold';
    await page.evaluate(() => { window.__qaStudioImperative.openLayoutSettings(); window.__qaStudioImperative.patchDesign({ pins: { size: 'extra-large' } }); });
    await waitUntil(() => state.holds.length === 1, 'Current presenter save deliberately held');
    await page.evaluate(() => window.__qaStudioImperative.setMode('explore'));
    assert.equal(await current.locator('[data-map-studio-design-controls]').count(), 1, 'Current presenter imperative guard blocks actual in-flight exit');
    const flight = page.evaluate(async () => { const actual = window.__qaStudioImperative; await actual.flushPendingSave(); actual.setMode('explore'); });
    await state.holds.shift().release(); await flight;
    await waitUntil(async () => await current.locator('[data-map-studio-design-controls]').count() === 0, 'Current presenter may exit after real flush completes');
    assert.equal(state.document.views[0].design.pins.size, 'extra-large', 'Current safety replay preserves persisted design');
  });
  for (const [name, viewport, query] of [['classic', { width: 1440, height: 900 }, '&ui=stable'], ['tablet', { width: 768, height: 1024 }, ''], ['phone', { width: 390, height: 844 }, ''], ['narrow-phone', { width: 320, height: 844 }, ''], ['short-landscape', { width: 844, height: 390 }, '']]) {
    await runCase(`split-${name}-responsive`, { viewport, touch: name !== 'classic' }, async (page, state) => {
      const shell = await openSplit(page, query), controller = await activeStudioIdentity(page), loads = state.studioLoads;
      const p = await studio(page, shell); await geometry(page, shell); await shot(page, `split-${name}-studio`);
      if (viewport.width < 640) {
        const rail = await shell.locator('[data-owner-workspace-tool]').evaluateAll(nodes => nodes.filter(e => e.getClientRects().length).map(e => ({ tool: e.dataset.ownerWorkspaceTool, pressed: e.getAttribute('aria-pressed'), background: getComputedStyle(e).backgroundColor, opacity: getComputedStyle(e).opacity, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })));
        report.assertions.push({ case: page.__case, phoneRail: rail }); assert.equal(rail.length, 5, 'phone has five primary tools');
        assert.equal(rail.find(e => e.tool === 'resources').pressed, 'false', 'phone Resources is not selected while Studio owns sheet');
        assert.equal(rail.find(e => e.tool === 'studio').pressed, 'true', 'phone Studio selected while its inspector is visible');
        assert.notEqual(rail.find(e => e.tool === 'resources').background, rail.find(e => e.tool === 'studio').background, 'active Studio is visually distinct from Resources');
        assert.ok(['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)'].includes(rail.find(e => e.tool === 'resources').background), 'inactive Resources is settled transparent or white');
        assert.equal(rail.find(e => e.tool === 'studio').background, 'rgb(0, 139, 133)', 'active Studio reaches settled teal endpoint');
        assert.ok(rail.every(e => e.width >= 44 && e.height >= 44), 'phone tool targets remain at least44px');
        const exposedField = await p.getByRole('button', { name: 'Default', exact: true }).evaluate(e => { const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { rect: { y: r.y, bottom: r.bottom }, exposed: Boolean(hit && (e === hit || e.contains(hit))) }; });
        assert.ok(exposedField.exposed, `initial phone Studio exposes its first real design field: ${JSON.stringify(exposedField)}`);
        await tool(shell, 'more').click(); await panel(shell, 'more').waitFor({ state: 'visible' });
        assert.ok(await panel(shell, 'more').getByRole('button', { name: 'Share', exact: true }).isVisible(), 'phone More keeps Share reachable');
        assert.ok(await panel(shell, 'more').getByRole('button', { name: 'Export', exact: true }).isVisible(), 'phone More keeps Export reachable');
        await shot(page, `split-${name}-more`);
      }
      await tool(shell, 'resources').click(); await geometry(page, shell);
      await page.evaluate(() => { document.documentElement.style.setProperty('--font-scale', '1.4'); document.documentElement.style.fontSize = '22.4px'; }); await page.waitForTimeout(350);
      await geometry(page, shell); await studio(page, shell); await geometry(page, shell); await unchangedController(page, controller, state, loads);
      await shot(page, `split-${name}-large-text`);
    });
  }
  for (const kind of ['empty', 'list-only']) await runCase(`split-${kind}`, { kind }, async page => { const shell = await openSplit(page); await studio(page, shell); await geometry(page, shell); await shot(page, `split-${kind}`); });
  await runCase('split-current-and-public-boundaries', {}, async (page, state) => {
    await page.goto(new URL(`/my-directory/maps/${mapId}?workspace=current&keep=fixture`, base).href);
    await page.locator('[data-map-first="care-map"]').waitFor(); assert.equal(await page.locator('[data-owner-workspace="split"]').count(), 0, 'Current fallback available while compile flag off');
    await page.goto(new URL('/discover?workspace=split', base).href); await page.locator('[data-map-first="discover"]').waitFor(); assert.equal(await page.locator('[data-owner-workspace="split"]').count(), 0, 'Discover ignores owner selector');
    assert.equal(state.puts.length, 0, 'presentation selection does not mutate Studio');
  });
} finally {
  if (browser) await browser.close(); await server.close();
  report.source = await sourceFingerprint();
  report.sourceUnchanged = JSON.stringify(report.source) === JSON.stringify(report.sourceBefore);
  report.passed = report.sourceUnchanged && report.cases.length > 0 && report.cases.every(x => x.passed) && !report.errors.length && !report.unexpectedWrites.length;
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, passed: report.passed, cases: report.cases.map(({ name, passed }) => ({ name, passed })), errors: report.errors, unexpectedWrites: report.unexpectedWrites }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
