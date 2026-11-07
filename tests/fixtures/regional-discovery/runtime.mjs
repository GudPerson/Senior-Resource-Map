/** Actual main.jsx/App loopback runtime. Fictional transport only; never starts the API server. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { validateFrozenRegionalDiscoveryFixtures } from './serialize.mjs';
import { createRegionalDiscoveryServerFixture, fixtureOwner, fixtureFetch, fixtureToken } from './server-fixture.mjs';
import { getRegionalDiscoveryDocument, replaceRegionalDiscoveryDocument, previewRegionalDiscovery } from '../../../server/src/controllers/regionalDiscoveryController.js';
import { getMyMapDetail, publishMyMap, unpublishMyMap, updateMyMapEmbedSettings } from '../../../server/src/controllers/myMapsController.js';
import { getPrintAnnotationDocument, replacePrintAnnotationDocument } from '../../../server/src/controllers/printAnnotationsController.js';
import { getMapStudioDocument, replaceMapStudioDocument } from '../../../server/src/controllers/mapStudioController.js';
import { getEmbeddedMapDirectory } from '../../../server/src/controllers/sharedMapsController.js';
import { createStudio, createAnnotations } from '../care-map-floating-canvas/data.mjs';
export const repo = fileURLToPath(new URL('../../../', import.meta.url));
export const token = fixtureToken;
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO48OwDAAUwAqemVUSMAAAAAElFTkSuQmCC', 'base64');
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export async function sourceBindings() {
  const paths = [];
  async function visit(dir) {
    for (const entry of await fs.readdir(path.join(repo, dir), {
      withFileTypes: true
    })) {
      const name = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(name);else if (/\.(jsx?|mjs|css|json)$/.test(name)) paths.push(name);
    }
  }
  for (const dir of ['client/src', 'client/functions', 'shared', 'server/src']) await visit(dir);
  paths.push('tests/fixtures/care-map-floating-canvas/data.mjs', 'tests/fixtures/care-map-view-controls/vite.config.mjs', 'client/tailwind.config.js', 'tests/browser/regional-discovery.mjs', 'tests/fixtures/regional-discovery/runtime.mjs', 'tests/fixtures/regional-discovery/server-dto/manifest.json');
  return Object.fromEntries(await Promise.all(paths.sort().map(async name => {
    const b = await fs.readFile(path.join(repo, name));
    return [name, {
      bytes: b.length,
      sha256: sha(b)
    }];
  })));
}
export async function startRegionalFixture(out) {
  const manifest = await validateFrozenRegionalDiscoveryFixtures();
  assert.equal(manifest.serializedArtifacts.length, 12);
  assert.equal(manifest.sources.length, 90);
  const raw = Object.fromEntries(await Promise.all(manifest.serializedArtifacts.map(async x => [path.basename(x.path, '.json'), await fs.readFile(path.join(repo, x.path))])));
  const server = await createServer({
    configFile: path.join(repo, 'tests/fixtures/care-map-view-controls/vite.config.mjs'),
    root: path.join(repo, 'client'),
    cacheDir: path.join(out, 'vite-cache'),
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      fs: {
        allow: [repo]
      }
    },
    plugins: [{
      name: 'regional-qa-observers',
      enforce: 'pre',
      transform(source, id) {
        if (id.endsWith('/components/DirectoryMap.jsx')) return source.replace('mapInstanceRef.current = map;', 'mapInstanceRef.current = map; if(map)window.__qa.maps.add(map);');
        if (id.endsWith('/features/regional-discovery/RegionalDiscoveryView.jsx')) return source.replace('function event(next) {', 'function event(next) { window.__qa.events.push(next);');
        if (id.endsWith('/features/regional-discovery/useRegionalDiscovery.js')) return source.replace('const snapshot = useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);', 'const snapshot = useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot); window.__qa.hooks.set(token,{controller,initialPayload,evaluateImpl});');
        if (id.endsWith('/pages/MyMapDetailPage.jsx')) return source.replace('async function handlePublishShare(options = {}) {', 'async function handlePublishShare(options = {}) { window.__qa.publishOptions.push({...options,hasNoteImagesRevision:Object.hasOwn(options,"noteImagesRevision")});');
      }
    }],
    define: {
      'import.meta.env.VITE_API_URL': '"/api"',
      'import.meta.env.VITE_SUPPORT_INBOX_ENABLED': '"false"',
      'import.meta.env.VITE_MAP_FIRST_EXPERIMENT_ENABLED': '"false"',
      'import.meta.env.VITE_OWNER_MAP_WORKSPACE_ENABLED': '"false"',
      'import.meta.env.VITE_TOWN_MAP_PROOF_ENABLED': '"false"'
    }
  });
  await server.listen();
  const base = server.resolvedUrls.local[0];
  async function install(page, {
    owner = false,
    profile = 'base',
    surface = 'regional',
    compactGrouped = false,
    preferences = {},
    annotations = false,
    studioFailure = false,
    annotationFailure = false
  } = {}) {
    const db = owner || surface === 'compact' ? await createRegionalDiscoveryServerFixture() : null;
    let compactProducerEvidence = null;
    if (surface === 'compact' && compactGrouped) {
      // Only this disposable compact DB gains a second selected public place.
      // The existing one-place/two-row fixture and frozen regional artifacts remain unchanged.
      await db.pg.exec(`UPDATE hard_assets SET postal_code='000001' WHERE id=101;
        INSERT INTO hard_assets(id,name,lat,lng,address,postal_code,partner_id,subregion_id,phone)
        VALUES(104,'Fictional compact second venue',1.31,103.81,'Fictional compact address','000001',2,91001,'60001004');
        INSERT INTO my_map_assets(map_id,resource_type,resource_id,snapshot,private_note)
        VALUES(9,'hard',104,NULL,NULL);`);
      const studio = createStudio();
      studio.views[0].design.pins.style = 'category-icon';
      await replaceMapStudioDocument(db.db, fixtureOwner, 9, {
        ...studio,
        revision: 0
      });
      await publishMyMap(db.db, fixtureOwner, 9, null, {
        studioViewId: 'view-default'
      });
      const compact = await getEmbeddedMapDirectory(db.db, token);
      assert.equal(compact.embeddedPresentation.pinStyle, 'category-icon');
      const mapped = compact.places.filter(place => place.hasCoordinates);
      assert.deepEqual(mapped.map(place => place.placeKey).sort(), ['hard-101', 'hard-104']);
      assert.ok(mapped.every(place => place.postalCode === '000001'));
      assert.ok(mapped.every(place => Number(place.lat) === 1.31 && Number(place.lng) === 103.81));
      assert.ok(!JSON.stringify(compact).includes('PRIVATE VENUE ADDRESS'));
      compactProducerEvidence = {
        source: 'actual publishMyMap and getEmbeddedMapDirectory on disposable compact-only DB',
        responseSha256: sha(Buffer.from(JSON.stringify(compact))),
        selectedPlaceKeys: mapped.map(place => place.placeKey),
        postalCode: '000001',
        frozenRegionalArtifactsChanged: false
      };
    }
    if (db && !compactGrouped) await replaceMapStudioDocument(db.db, fixtureOwner, 9, {
      ...createStudio(),
      revision: 0
    });
    if (db && annotations) {
      const a = createAnnotations().slice(0, 1).map(a => ({
        ...a,
        style: {
          ...a.style,
          weight: 4
        }
      }));
      await replacePrintAnnotationDocument(db.db, fixtureOwner, 9, {
        schemaVersion: 1,
        revision: 0,
        annotations: a
      });
    }
    const state = {
      compactProducerEvidence,
      requests: [],
      chronology: [],
      sequence: 0,
      unexpected: [],
      external: [],
      errors: [],
      consoleErrors: [],
      faults: [],
      pending: [],
      evaluationQueue: [],
      profile,
      settingsError: false,
      previewError: false,
      studioError: studioFailure,
      annotationError: annotationFailure,
      studio: createStudio(),
      annotations: annotations ? createAnnotations().slice(0, 1) : [],
      annotationRevision: 0,
      db
    };
    state.concurrentSave = async () => {
      const current = await getRegionalDiscoveryDocument(db.db, fixtureOwner, 9);
      return replaceRegionalDiscoveryDocument(db.db, fixtureOwner, 9, {
        revision: current.revision,
        config: current.config
      });
    };
    state.enqueue = fault => {
      state.faults.push({
        ...fault
      });
      state.evaluationQueue.push(fault);
    };
    state.resolve = async (index = 0) => {
      const pending = state.pending.splice(index, 1)[0];
      assert.ok(pending, 'held response exists');
      await pending();
    };
    page.on('pageerror', e => state.errors.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error') state.consoleErrors.push(m.text());
    });
    await page.addInitScript(({
      preferences
    }) => {
      for (const [k, v] of Object.entries(preferences)) localStorage.setItem(k, v);
      window.__qa = {
        maps: new Set(),
        hooks: new Map(),
        events: [],
        publishOptions: [],
        pointerEvents: [],
        storage: [],
        geolocation: [],
        clipboard: []
      };
      for (const name of ['localStorage', 'sessionStorage']) {
        const descriptor = Object.getOwnPropertyDescriptor(window, name);
        Object.defineProperty(window, name, {
          ...descriptor,
          get() {
            window.__qa.storage.push({
              name: 'access',
              args: [name]
            });
            return descriptor.get.call(window);
          }
        });
      }
      for (const type of ['mouseover', 'mouseout', 'mousedown', 'mouseup', 'click']) document.addEventListener(type, e => window.__qa.pointerEvents.push({
        type,
        x: e.clientX,
        y: e.clientY,
        timeStamp: e.timeStamp,
        target: e.target.className?.baseVal ?? e.target.className,
        related: e.relatedTarget?.className?.baseVal ?? e.relatedTarget?.className
      }), true);
      for (const name of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) {
        const original = Storage.prototype[name];
        Storage.prototype[name] = function (...args) {
          window.__qa.storage.push({
            name,
            args
          });
          return original.apply(this, args);
        };
      }
      for (const name of ['getCurrentPosition', 'watchPosition']) navigator.geolocation[name] = (...args) => {
        window.__qa.geolocation.push(name);
        args[1]?.({
          code: 1,
          message: 'Fictional guard'
        });
      };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async text => {
            window.__qa.clipboard.push(text);
          }
        }
      });
    }, {
      preferences
    });
    await page.route('**/*', async route => {
      const request = route.request(),
        u = new URL(request.url()),
        method = request.method();
      let record;
      async function fulfill(json, status = 200) {
        await route.fulfill({
          status,
          json,
          headers: {
            'Cache-Control': 'no-store'
          }
        });
        if (record) {
          record.responseStatus = status;
          record.responseRevision = json?.revision ?? json?.document?.revision ?? null;
          record.responseCompletedOrder = ++state.sequence;
          state.chronology.push({
            phase: 'response-completed',
            order: record.responseCompletedOrder,
            method,
            path: u.pathname,
            status,
            revision: record.responseRevision
          });
        }
      }
      const bytes = name => route.fulfill({
        body: raw[name],
        contentType: 'application/json',
        headers: {
          'Cache-Control': 'no-store'
        }
      });
      if (u.pathname.startsWith('/api/')) {
        const headers = await request.allHeaders();
        record = {
          origin: u.origin,
          cookiePresent: Object.hasOwn(headers, 'cookie'),
          authorizationPresent: Object.hasOwn(headers, 'authorization'),
          requestOrder: ++state.sequence,
          method,
          path: u.pathname,
          body: request.postData() ? request.postDataJSON() : null,
          frameUrl: request.frame().url()
        };
        state.requests.push(record);
        state.chronology.push({
          phase: 'request',
          order: record.requestOrder,
          method,
          path: u.pathname
        });
        if (u.origin !== new URL(base).origin) {
          state.external.push({
            origin: u.origin,
            path: u.pathname
          });
          return route.abort();
        }
        try {
          if (!owner && surface === 'compact' && method === 'GET' && /^\/api\/shared-maps\/[^/]+\/embed$/.test(u.pathname)) return fulfill(await getEmbeddedMapDirectory(db.db, u.pathname.split('/')[3]));
          if (!owner && /^\/api\/shared-maps\/[^/]+\/embed\/regional-discovery(?:\/evaluate)?$/.test(u.pathname)) {
            assert.equal(record.cookiePresent, false, 'regional guest request omits ambient cookies');
            assert.equal(record.authorizationPresent, false, 'regional guest request omits authorization');
          }
          if (!owner && new RegExp('^/api/shared-maps/[^/]+/embed/regional-discovery$').test(u.pathname) && method === 'GET') return bytes(state.profile);
          if (!owner && new RegExp('^/api/shared-maps/[^/]+/embed/regional-discovery/evaluate$').test(u.pathname) && method === 'POST') {
            assert.deepEqual(Object.keys(record.body), ['postalCode']);
            assert.match(record.body.postalCode, /^\d{6}$/);
            const fault = state.evaluationQueue.shift();
            const selected = fault?.profile || {
              '000001': 'inside-s1',
              '000002': 'inside-s2',
              '000003': 'coverage-unconfirmed',
              '000004': 'postal-unresolved',
              '000009': 'outside'
            }[record.body.postalCode];
            assert.ok(selected || fault?.status, 'Only fictional postal inputs allowed');
            const send = () => fault?.invalid ? fulfill({
              ...JSON.parse(raw[selected]),
              unexpectedPrivateField: 'CONTROLLED FAULT'
            }) : fault?.status ? fulfill({
              error: 'Controlled fictional response failure'
            }, fault.status) : bytes(selected);
            if (fault?.hold) {
              await new Promise(resolve => state.pending.push(async () => {
                await send().catch(() => {});
                resolve();
              }));
              return;
            }
            return send();
          }
          if (owner) {
            const {
              db: database
            } = db;
            if (surface === 'ordinary' && method === 'POST' && u.pathname === '/api/discovery/location-indicators') {
              assert.deepEqual(record.body, {
                resources: [{
                  type: 'hard',
                  id: 501
                }, {
                  type: 'hard',
                  id: 502
                }]
              });
              return fulfill({
                indicators: {}
              });
            }
            if (surface === 'ordinary' && method === 'GET' && u.pathname === '/api/public/discovery-cache/all') return fulfill([]);
            if (surface === 'ordinary' && method === 'GET' && u.pathname === '/api/hard-assets') return fulfill([{
              id: 501,
              name: 'Fictional Alpha centre',
              subCategory: 'Active Ageing Centres',
              lat: 1.31,
              lng: 103.81,
              address: 'Fictional Alpha address',
              status: 'active'
            }, {
              id: 502,
              name: 'Fictional Beta centre',
              subCategory: 'Active Ageing Centres',
              lat: 1.32,
              lng: 103.82,
              address: 'Fictional Beta address',
              status: 'active'
            }]);
            if (surface === 'ordinary' && method === 'GET' && ['/api/soft-assets', '/api/subregions'].includes(u.pathname)) return fulfill([]);
            if (method === 'GET' && /^\/api\/shared-maps\/[^/]+\/embed$/.test(u.pathname)) return fulfill(await getEmbeddedMapDirectory(database, u.pathname.split('/')[3]));
            if (method === 'GET' && u.pathname === '/api/auth/me') return fulfill({
              user: {
                ...fixtureOwner,
                name: 'Fictional curator',
                locale: 'en'
              }
            });
            if (method === 'GET' && u.pathname === '/api/platform-access') return fulfill({
              settings: {
                publicDirectoryMode: 'open',
                publicRegistrationMode: 'open',
                publicLoginMode: 'open'
              }
            });
            if (method === 'GET' && /^\/api\/soft-assets\/(201|202|203)$/.test(u.pathname)) return fulfill({
              id: Number(u.pathname.split('/').pop()),
              name: 'Fictional service',
              locations: []
            });
            if (u.pathname === '/api/my-maps/9' && method === 'GET') return fulfill(await getMyMapDetail(database, fixtureOwner, 9));
            if (u.pathname === '/api/my-maps/9/regional-discovery') {
              if (method === 'GET') return state.settingsError ? fulfill({
                error: 'Controlled readback failure'
              }, 503) : fulfill(await getRegionalDiscoveryDocument(database, fixtureOwner, 9));
              if (method === 'PUT') return fulfill(await replaceRegionalDiscoveryDocument(database, fixtureOwner, 9, record.body));
            }
            if (u.pathname === '/api/my-maps/9/regional-discovery/preview' && method === 'POST') {
              const send = async () => state.previewError ? fulfill({
                error: 'Controlled preview failure'
              }, 503) : fulfill(await previewRegionalDiscovery(database, fixtureOwner, 9, record.body, {
                fetchImpl: fixtureFetch
              }));
              if (state.holdPreview) {
                await new Promise(resolve => state.pending.push(async () => {
                  await send().catch(() => {});
                  resolve();
                }));
                return;
              }
              return send();
            }
            if (u.pathname === '/api/my-maps/9/share') {
              if (method === 'POST') {
                const savedStudio = await getMapStudioDocument(database, fixtureOwner, 9);
                record.studioRevisionAtPublish = savedStudio.document.revision;
                record.studioNamesAtPublish = savedStudio.document.views.map(view => view.name);
                return fulfill(await publishMyMap(database, fixtureOwner, 9, null, record.body));
              }
              if (method === 'DELETE') return fulfill(await unpublishMyMap(database, fixtureOwner, 9));
            }
            if (u.pathname === '/api/my-maps/9/embed' && method === 'PATCH') return fulfill(await updateMyMapEmbedSettings(database, fixtureOwner, 9, record.body));
            if (u.pathname === '/api/my-maps/9/studio') {
              async function respondStudio() {
                if (state.studioError && (state.studioError !== 'write' || method === 'PUT')) {
                  return fulfill({
                    error: 'Controlled fictional Studio failure'
                  }, 503);
                }
                if (method === 'GET') return fulfill(await getMapStudioDocument(database, fixtureOwner, 9));
                if (method === 'PUT') return fulfill(await replaceMapStudioDocument(database, fixtureOwner, 9, record.body));
              }
              if (method === 'PUT' && state.holdStudioWrite) {
                await new Promise(resolve => state.pending.push(async () => {
                  await respondStudio();
                  resolve();
                }));
                return;
              }
              if (method === 'GET' || method === 'PUT') return respondStudio();
            }
            if (u.pathname === '/api/my-maps/9/print-annotations') {
              if (state.annotationError && (state.annotationError !== 'write' || method === 'PUT')) return fulfill({
                error: 'Controlled fictional annotation failure'
              }, 503);
              if (method === 'PUT') return fulfill(await replacePrintAnnotationDocument(database, fixtureOwner, 9, record.body));
              if (method === 'GET') return fulfill(await getPrintAnnotationDocument(database, fixtureOwner, 9));
            }
            // Explicit auxiliary read allowlist; every observed endpoint is recorded. No unknown-GET fallback.
            if (method === 'GET' && ['/api/favorites', '/api/personal-places/categories', '/api/sub-categories', '/api/personal-places', '/api/personal-place-categories', '/api/my-maps', '/api/my-directory', '/api/notifications', '/api/notifications/unread-count'].includes(u.pathname)) return fulfill([]);
          }
          state.unexpected.push(record);
          return fulfill({
            error: 'Unexpected fictional API request'
          }, 418);
        } catch (error) {
          return fulfill({
            error: error.message
          }, error.status || 500);
        }
      }
      if (u.origin === new URL(base).origin) return route.continue();
      if (owner && u.hostname === 'accounts.google.com' && u.pathname === '/gsi/client') return route.fulfill({
        body: '',
        contentType: 'application/javascript'
      });
      if (method === 'GET' && (request.resourceType() === 'stylesheet' || owner && request.resourceType() === 'fetch') && u.hostname === 'fonts.googleapis.com' && u.pathname === '/css2') return route.fulfill({
        body: '',
        contentType: 'text/css'
      });
      if (method === 'GET' && request.resourceType() === 'image' && u.hostname === 'mobile.onemap.gov.sg' && u.pathname === '/web/2025/images/icons/onemap_logo.svg') return route.fulfill({
        body: pixel,
        contentType: 'image/png'
      });
      if (method === 'GET' && (request.resourceType() === 'image' || owner && request.resourceType() === 'fetch') && /^\/maps\/tiles\/[^/]+\/\d+\/\d+\/\d+\.png$/.test(u.pathname) && ['www.onemap.gov.sg', 'onemap.gov.sg', 'maps-a.onemap.sg', 'maps-b.onemap.sg', 'maps-c.onemap.sg', 'maps.carearound.sg'].includes(u.hostname)) return route.fulfill({
        body: pixel,
        contentType: 'image/png'
      });
      state.external.push({
        origin: u.origin,
        path: u.pathname
      });
      return route.abort();
    });
    state.close = async () => {
      while (state.pending.length) await state.resolve();
      await db?.close();
    };
    return state;
  }
  return {
    server,
    base,
    install,
    manifest,
    raw
  };
}
