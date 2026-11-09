/** Browser acceptance of actual main.jsx -> EmbeddedApp / App, using fictional transport. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildRegionalDiscoveryResponse } from '../../client/functions/embed/maps/[token]/regional-discovery.js';
import { translateUi } from '../../client/src/lib/i18n.js';
import { startRegionalFixture, sourceBindings, sha, token } from '../fixtures/regional-discovery/runtime.mjs';
const out = process.argv.find(x => x.startsWith('--out='))?.slice(6);
assert.ok(out && path.isAbsolute(out), 'Pass --out=ABS_PATH');
await fs.mkdir(out, {
  recursive: true
});
await fs.copyFile(new URL(import.meta.url), path.join(out, 'harness.mjs'));
await fs.copyFile(new URL('../fixtures/regional-discovery/runtime.mjs', import.meta.url), path.join(out, 'runtime.mjs'));
const selected = process.argv.find(x => x.startsWith('--case='))?.slice(7);
const report = {
  boundary: 'Actual current main.jsx/App browser with fictional local APIs and synthetic map pixels. Frozen guest artifacts remain byte-exact; controlled transport errors/delays are explicit fault injection. Not device, live routing, framing deployment or production proof.',
  cases: [],
  sourceBefore: await sourceBindings()
};
let fixture, browser;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, message) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    if (await fn()) return;
    await sleep(30);
  }
  throw Error(message);
}
const root = page => page.locator('.regional-discovery');
const postal = page => root(page).locator('input[inputmode="numeric"]');
const article = (page, name) => root(page).locator('article').filter({
  hasText: name
});
const views = page => root(page).getByRole('button', {
  name: 'View service',
  exact: true
});
const evalCount = state => state.requests.filter(x => x.path.endsWith('/evaluate')).length;
async function evaluate(page, value) {
  await postal(page).fill(value);
  await root(page).locator('button[type=submit]').click();
  await until(async () => !(await root(page).locator('button[type=submit]').isDisabled()), 'evaluation did not finish');
}
async function camera(page) {
  return page.evaluate(() => [...window.__qa.maps].filter(m => m.getContainer().isConnected).map(m => ({
    id: m._leaflet_id,
    lat: m.getCenter().lat,
    lng: m.getCenter().lng,
    zoom: m.getZoom()
  })));
}
function sameCamera(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    assert.equal(actual[i].id, expected[i].id);
    assert.equal(actual[i].zoom, expected[i].zoom);
    for (const axis of ['lat', 'lng']) assert.ok(Math.abs(actual[i][axis] - expected[i][axis]) < 1e-8, `camera ${axis} changed: ${actual[i][axis]} vs ${expected[i][axis]}`);
  }
}
async function ready(page) {
  await root(page).locator('article').first().waitFor();
  await until(() => page.evaluate(() => [...window.__qa.maps].some(m => m.getContainer().isConnected)), 'map not mounted');
}
async function noOverflow(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'document horizontal overflow');
}
async function guestPrivacy(page, state) {
  assert.ok(state.requests.every(request => request.origin === new URL(fixture.base).origin));
  assert.ok(state.requests.every(request => !request.cookiePresent && !request.authorizationPresent));
  assert.deepEqual(state.unexpected, []);
  assert.deepEqual(state.external, []);
  assert.deepEqual(state.errors, []);
  assert.deepEqual(await page.evaluate(() => window.__qa.storage), []);
  assert.deepEqual(await page.evaluate(() => window.__qa.geolocation), []);
  assert.ok(state.requests.every(x => /^\/api\/shared-maps\/[^/]+\/embed\/regional-discovery(?:\/evaluate)?$/.test(x.path)));
  assert.ok(state.requests.every(x => x.method === 'GET' || x.method === 'POST' && x.path.endsWith('/evaluate')));
}
async function compactSearchRestoration(page, row) {
  const search = page.getByPlaceholder('Search this map', {
    exact: true
  });
  await until(() => page.locator('.leaflet-marker-icon').count().then(count => count === 1), 'compact genuine grouped pin mounted');
  await sleep(250);
  const initial = await camera(page);
  const mappedLabel = (await page.locator('header').innerText()).match(/\d+ mapped resources/)[0];
  row.initialMappedLabel = mappedLabel;
  await search.fill('home service A');
  await until(() => page.locator('.leaflet-marker-icon').count().then(count => count === 0), 'unmapped search removes mapped results');
  row.filtered = await page.locator('body').innerText();
  assert.match(row.filtered, /0 mapped resources/);
  await search.fill('');
  await until(() => page.locator('.leaflet-marker-icon').count().then(count => count === 1), 'clear search restores grouped marker');
  await page.getByText(mappedLabel, {
    exact: true
  }).waitFor();
  row.restoredMappedLabel = mappedLabel;
  return initial;
}
async function compactPanReset(page, row, initial) {
  const selectedCamera = await camera(page);
  const box = await page.locator('.leaflet-container').boundingBox();
  await page.mouse.move(box.x + box.width - 100, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 220, box.y + 145, {
    steps: 10
  });
  await page.mouse.up();
  await sleep(300);
  const panned = await camera(page);
  assert.ok(Math.abs(panned[0].lng - selectedCamera[0].lng) > 1e-5, 'real compact drag changes camera');
  await page.getByRole('button', {
    name: 'Reset map view',
    exact: true
  }).first().click();
  await until(async () => (await camera(page))[0]?.id !== panned[0].id, 'compact reset remounts default renderer');
  await sleep(300);
  const reset = await camera(page);
  assert.equal(reset[0].zoom, initial[0].zoom);
  assert.ok(Math.abs(reset[0].lat - initial[0].lat) < 1e-8);
  assert.ok(Math.abs(reset[0].lng - initial[0].lng) < 1e-8);
  assert.equal(await page.getByRole('link', {
    name: 'Open resource',
    exact: true
  }).count(), 0, 'reset clears default selection');
  assert.equal(await page.getByPlaceholder('Search this map', {
    exact: true
  }).inputValue(), '');
  assert.equal(await page.locator('.leaflet-marker-icon').count(), 1);
  row.compactAcceptance = {
    filteredMarkers: 0,
    restoredMarkers: 1,
    initial,
    selectedCamera,
    panned,
    reset,
    selectionCleared: true
  };
}
async function run(name, fn, options = {}) {
  if (selected && !selected.split(',').some(part => name.includes(part))) return;
  const context = await browser.newContext({
    viewport: options.viewport || {
      width: 1280,
      height: 900
    },
    hasTouch: !!options.touch,
    isMobile: !!options.touch,
    reducedMotion: options.reduced ? 'reduce' : 'no-preference'
  });
  if (!options.owner && !options.surface) {
    await context.addCookies([{
      name: 'fictional_ambient',
      value: 'qa-only',
      url: fixture.base
    }]);
    assert.ok((await context.cookies(fixture.base)).some(cookie => cookie.name === 'fictional_ambient'), 'fictional ambient cookie seeded');
  }
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const state = await fixture.install(page, options);
  const row = {
    name,
    profile: options,
    ambientCookieSeeded: !options.owner && !options.surface,
    passed: false
  };
  try {
    await page.goto(new URL(options.surface === 'ordinary' ? '/discover' : options.surface === 'compact' ? `/embed/maps/${token}` : options.surface === 'governed' ? `/embed/governed-maps/${token}` : options.surface === 'fallback' ? '/embed/maps/missing/unknown' : options.owner ? '/my-directory/maps/9' + (options.v2 ? '?ui=v2' : '?ui=stable') : `/embed/maps/${token}/regional-discovery`, fixture.base).href);
    if (!options.owner && !options.surface) await ready(page);
    await fn(page, state, row);
    await noOverflow(page);
    if (!options.owner && !options.surface) await guestPrivacy(page, state);else {
      assert.deepEqual(state.errors, []);
      assert.deepEqual(state.unexpected, []);
      assert.deepEqual(state.external, options.expectedBlockedExternal || []);
    }
    row.passed = true;
  } catch (error) {
    row.error = error.stack;
    await fs.writeFile(path.join(out, name + '-failure-dom.txt'), await page.locator('body').innerText()).catch(() => {});
  } finally {
    row.screenshot = path.join(out, name + (row.passed ? '' : '-failure') + '.png');
    await page.screenshot({
      path: row.screenshot
    }).catch(() => {});
    row.requests = state.requests;
    row.chronology = state.chronology;
    row.faultInjection = state.faults;
    row.unexpected = state.unexpected;
    row.pageErrors = state.errors;
    row.consoleErrors = state.consoleErrors;
    row.external = state.external;
    row.observed = await page.evaluate(() => ({
      storage: window.__qa?.storage,
      geolocation: window.__qa?.geolocation,
      events: window.__qa?.events,
      pointerEvents: window.__qa?.pointerEvents,
      publishOptions: window.__qa?.publishOptions
    })).catch(() => null);
    report.cases.push(row);
    await context.close();
    await state.close();
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(name + ': ' + (row.passed ? 'PASS' : row.error.split('\n')[0]));
  }
}
try {
  fixture = await startRegionalFixture(out);
  report.frozenManifest = {
    sha256: sha(await fs.readFile(new URL('../fixtures/regional-discovery/server-dto/manifest.json', import.meta.url))),
    artifacts: fixture.manifest.serializedArtifacts,
    sources: fixture.manifest.sources
  };
  assert.equal(JSON.parse(fixture.raw['inside-s1']).snapshotRevision, JSON.parse(fixture.raw['inside-s2']).snapshotRevision);
  browser = await chromium.launch({
    headless: true
  });
  report.runtime = {
    node: process.version,
    chromium: browser.version(),
    baselineOwnerPage: false
  };
  await run('fixture_rejects_unexpected_api_origin', async (page, state, row) => {
    await ready(page);
    const origin = 'https://unexpected-fixture.example.invalid';
    const pathname = `/api/shared-maps/${token}/embed/regional-discovery`;
    row.faultInjectionBoundary = 'Deliberate unexpected-origin API fetch; must be aborted before any allowed-route response or network access.';
    const result = await page.evaluate(async url => {
      try {
        await fetch(url, {
          credentials: 'omit'
        });
        return 'unexpected success';
      } catch {
        return 'blocked';
      }
    }, origin + pathname);
    assert.equal(result, 'blocked');
    const blocked = state.requests.find(request => request.origin === origin);
    assert.ok(blocked);
    assert.equal(blocked.responseCompletedOrder, undefined);
    assert.deepEqual(state.external, [{
      origin,
      path: pathname
    }]);
  }, {
    surface: 'guard-probe',
    expectedBlockedExternal: [{
      origin: 'https://unexpected-fixture.example.invalid',
      path: `/api/shared-maps/${token}/embed/regional-discovery`
    }]
  });
  await run('unmapped_service_is_keyboard_reachable', async (page, state, row) => {
    const button = article(page, 'Fictional home service A').getByRole('button', {
      name: 'View service',
      exact: true
    });
    await button.focus();
    const scrollBefore = await root(page).locator('section.regional-pane>div').first().evaluate(el => el.scrollTop);
    await page.keyboard.press('Enter');
    await root(page).getByRole('heading', {
      name: 'Fictional home service A',
      exact: true
    }).waitFor();
    assert.equal(await root(page).locator('a[href^="mailto:"]').count(), 0);
    await root(page).getByRole('button', {
      name: 'Back',
      exact: true
    }).click();
    assert.equal(await button.evaluate(el => el === document.activeElement), true);
    assert.equal(await root(page).locator('section.regional-pane>div').first().evaluate(el => el.scrollTop), scrollBefore);
    assert.equal(await root(page).locator('article').count(), 4);
    row.camera = await camera(page);
  });
  await run('stale_contact_is_never_actionable', async (page, state, row) => {
    await evaluate(page, '000001');
    await article(page, 'Fictional home service A').getByRole('button', {
      name: 'View service',
      exact: true
    }).click();
    const old = 'mailto:enquiry91001@example.invalid';
    await root(page).locator(`a[href="${old}"]`).waitFor();
    await postal(page).focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('000002', {
      delay: 45
    });
    assert.equal(await postal(page).inputValue(), '000002', 'multi-character draft retained with locked detail');
    assert.ok(await postal(page).evaluate(el => el === document.activeElement), 'postal focus survives retirement');
    assert.equal(await root(page).locator(`a[href="${old}"]`).count(), 0, 'old recipient gone before response');
    assert.equal(evalCount(state), 1, 'typing must not evaluate');
    await root(page).locator('button[type=submit]').click();
    await root(page).locator('a[href="mailto:enquiry91002@example.invalid"]').waitFor();
    row.camera = await camera(page);
  });
  await run('same_snapshot_late_response_clear_retry_withdrawal', async (page, state, row) => {
    state.enqueue({
      hold: true,
      profile: 'inside-s1',
      label: 'Deferred genuine S1 transport'
    });
    await postal(page).fill('000001');
    await root(page).locator('button[type=submit]').click();
    await until(() => state.pending.length === 1, 'S1 held');
    await evaluate(page, '000002');
    await article(page, 'Fictional home service A').getByRole('button', {
      name: 'View service',
      exact: true
    }).click();
    await root(page).locator('a[href="mailto:enquiry91002@example.invalid"]').waitFor();
    await state.resolve();
    await sleep(150);
    assert.equal(await root(page).locator('a[href="mailto:enquiry91001@example.invalid"]').count(), 0);
    await root(page).getByRole('button', {
      name: 'Clear postal',
      exact: true
    }).click();
    assert.equal(await postal(page).inputValue(), '');
    assert.deepEqual(await root(page).locator('article button[aria-pressed] .font-semibold').allTextContents(), JSON.parse(fixture.raw.base).entries.map(e => e.name));
    state.enqueue({
      status: 503,
      label: 'Fault injection evaluation error'
    });
    await evaluate(page, '000001');
    await root(page).getByRole('alert').waitFor();
    assert.equal(await root(page).locator('a[href^="mailto:enquiry"]').count(), 0);
    await page.getByRole('button', {
      name: 'Retry',
      exact: true
    }).click();
    await until(() => evalCount(state) === 4, 'retry request');
    await until(() => root(page).getByText('Recommended for this location', {
      exact: true
    }).count(), 'retry restores current evaluation');
    state.enqueue({
      profile: 'contact-withdrawn',
      label: 'Genuine live contact withdrawal response'
    });
    await evaluate(page, '000001');
    await article(page, 'Fictional home service A').getByRole('button', {
      name: 'View service',
      exact: true
    }).click();
    assert.equal(await root(page).locator('a[href^="mailto:"]').count(), 0);
    assert.equal(await root(page).locator('a[href^="tel:"]').count(), 0);
    state.enqueue({
      status: 404,
      label: 'Fault injection unavailable publication'
    });
    await evaluate(page, '000001');
    await root(page).getByRole('alert').waitFor();
    assert.equal(await root(page).locator('article').count(), 0);
    assert.equal(await root(page).locator('a[href]').count(), 0);
  });
  await run('fine_pointer_initial_keyboard_without_activation', async (page, state, row) => {
    assert.equal(await root(page).getByRole('button', {
      name: 'Tap to interact',
      exact: true
    }).count(), 0);
    assert.ok(await page.evaluate(() => document.activeElement === document.body));
    const marker = root(page).locator('.leaflet-marker-icon').first();
    for (let index = 0; index < 24 && !(await marker.evaluate(el => el === document.activeElement)); index++) await page.keyboard.press('Tab');
    assert.ok(await marker.evaluate(el => el === document.activeElement), 'initial map marker is in native Tab order');
    await page.keyboard.press('Enter');
    await root(page).getByRole('heading', {
      name: 'Services at this location',
      exact: true
    }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await root(page).locator('article').count(), 4);
    assert.equal(await root(page).getByRole('button', {
      name: 'Tap to interact',
      exact: true
    }).count(), 0);
    row.initialKeyboard = 'Tab to marker, Enter selects, Escape dismisses with no nonexistent guard focus';
  });
  await run('marker_keyboard_hover_lock_back_camera', async (page, state, row) => {
    if (process.argv.includes('--diagnostic-marker-pointer-css')) {
      state.faults.push({
        label: 'DIAGNOSTIC ONLY regional marker descendant pointer-events:none CSS injected by test'
      });
      await page.addStyleTag({
        content: '.regional-discovery .leaflet-marker-icon *{pointer-events:none}'
      });
    }
    assert.equal(await root(page).getByRole('button', {
      name: 'Tap to interact',
      exact: true
    }).count(), 0, 'fine pointer is interactive on untouched initial page');
    assert.ok(await page.evaluate(() => document.activeElement === document.body), 'no initial autofocus');
    row.finePointer = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
    assert.equal(row.finePointer, true);
    assert.equal(await page.evaluate(() => [...window.__qa.maps].find(m => m.getContainer().isConnected).scrollWheelZoom.enabled()), false);
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.style.height = '1200px';
      document.body.append(spacer);
    });
    const wheelBox = await root(page).locator('.leaflet-container').boundingBox();
    const beforeWheel = await camera(page);
    await page.mouse.move(wheelBox.x + 25, wheelBox.y + 25);
    await page.mouse.wheel(0, 200);
    await until(() => page.evaluate(() => scrollY > 0), 'fine pointer wheel scrolls host');
    sameCamera(await camera(page), beforeWheel);
    row.hostWheelScroll = await page.evaluate(() => scrollY);
    await page.evaluate(() => scrollTo(0, 0));
    const marker = root(page).locator('.leaflet-marker-icon').first();
    assert.equal(await marker.locator('a,button,input,select,textarea,[tabindex]').count(), 0, 'regional marker descendants are decorative');
    const oldIcon = await marker.elementHandle();
    await marker.hover();
    row.markerAfterHover = {
      connected: await oldIcon.evaluate(el => el.isConnected),
      same: await marker.evaluate((el, old) => el === old, oldIcon)
    };
    await root(page).getByRole('heading', {
      name: 'Services at this location',
      exact: true
    }).waitFor();
    await page.mouse.move(10, 10);
    row.markerDiagnostics = await marker.evaluate(el => {
      const m = [...window.__qa.maps].find(m => m.getContainer().isConnected),
        layer = Object.values(m._layers).find(l => l._icon === el);
      return {
        active: document.activeElement?.className,
        targets: Object.keys(m._targets),
        stamp: el._leaflet_id,
        eventNames: Object.keys(layer?._events || {}),
        mouseOutListeners: layer?._events?.mouseout?.length,
        events: window.__qa.pointerEvents.slice(-8)
      };
    });
    await until(() => root(page).locator('article').count().then(n => n === 4), 'immediate leave restores list');
    await marker.hover();
    await root(page).getByRole('heading', {
      name: 'Services at this location',
      exact: true
    }).waitFor();
    const mapBox = await root(page).locator('.leaflet-container').boundingBox();
    await page.mouse.move(mapBox.x + 20, mapBox.y + 20);
    await until(() => root(page).locator('article').count().then(n => n === 4), 'leave into blank map restores list');
    await marker.hover();
    await root(page).getByRole('heading', {
      name: 'Services at this location',
      exact: true
    }).waitFor();
    row.clickTarget = await marker.evaluate(el => ({
      box: el.getBoundingClientRect().toJSON(),
      hit: document.elementFromPoint(el.getBoundingClientRect().x + el.getBoundingClientRect().width / 2, el.getBoundingClientRect().y + el.getBoundingClientRect().height / 2)?.outerHTML
    }));
    const activationsBeforeClick = await page.evaluate(() => window.__qa.events.filter(event => event.type === 'PIN_ACTIVATE').length);
    await marker.click();
    assert.equal(await page.evaluate(() => window.__qa.events.filter(event => event.type === 'PIN_ACTIVATE').length), activationsBeforeClick + 1);
    await page.mouse.move(10, 10);
    await root(page).getByRole('heading', {
      name: 'Services at this location',
      exact: true
    }).waitFor();
    assert.equal(await root(page).locator('article').count(), 2, 'initial desktop click locks grouped chooser');
    row.nativeClick = await page.evaluate(() => window.__qa.pointerEvents.filter(event => ['mousedown', 'mouseup', 'click'].includes(event.type)).slice(-3));
    assert.deepEqual(row.nativeClick.map(event => event.type), ['mousedown', 'mouseup', 'click']);
    await page.mouse.click(mapBox.x + 20, mapBox.y + 20);
    assert.equal(await root(page).locator('article').count(), 4, 'blank map click still dismisses selection');
    for (const key of ['Enter', 'Space']) {
      // Existing shared renderer deduplicates mousedown/click activation for 300ms.
      await sleep(320);
      const before = await page.evaluate(() => window.__qa.events.filter(e => e.type === 'PIN_ACTIVATE').length);
      await marker.focus();
      await page.keyboard.press(key);
      await root(page).getByRole('heading', {
        name: 'Services at this location',
        exact: true
      }).waitFor();
      assert.equal(await root(page).locator('article').count(), 2);
      assert.equal(await page.evaluate(() => window.__qa.events.filter(e => e.type === 'PIN_ACTIVATE').length), before + 1);
      await marker.dispatchEvent('keydown', {
        key: key === 'Space' ? ' ' : key,
        repeat: true
      });
      assert.equal(await page.evaluate(() => window.__qa.events.filter(e => e.type === 'PIN_ACTIVATE').length), before + 1);
      await root(page).locator('article').first().getByRole('button', {
        name: 'View service',
        exact: true
      }).click();
      await sleep(350);
      const locked = await camera(page);
      await marker.hover();
      await page.mouse.move(10, 10);
      assert.equal(await root(page).locator('article').count(), 1);
      await root(page).getByRole('button', {
        name: 'Back',
        exact: true
      }).click();
      assert.equal(await root(page).locator('article').count(), 2);
      sameCamera(await camera(page), locked);
      await root(page).getByRole('button', {
        name: 'Back',
        exact: true
      }).click();
      assert.equal(await root(page).locator('article').count(), 4);
    }
    await article(page, 'Fictional shared venue').locator('button[aria-pressed]').click();
    assert.equal(await root(page).locator('article').count(), 4);
    assert.equal(await article(page, 'Fictional shared venue').locator('button[aria-pressed]').getAttribute('aria-pressed'), 'true');
    const count = evalCount(state);
    const mapBox2 = await root(page).locator('.leaflet-container').boundingBox();
    const orderBefore = await root(page).locator('article button[aria-pressed] .font-semibold').allTextContents();
    await page.mouse.move(mapBox2.x + 60, mapBox2.y + 70);
    await page.mouse.down();
    await page.mouse.move(mapBox2.x + 160, mapBox2.y + 110, {
      steps: 8
    });
    await page.mouse.up();
    await sleep(250);
    assert.deepEqual(await root(page).locator('article button[aria-pressed] .font-semibold').allTextContents(), orderBefore);
    assert.equal(evalCount(state), count);
    const before = await camera(page);
    await root(page).locator('select').selectOption('services');
    assert.equal(evalCount(state), count);
    sameCamera(await camera(page), before);
    row.camera = before;
  });
  await run('coarse_marker_tap_activates_after_guard', async (page, state, row) => {
    await root(page).getByRole('button', {
      name: 'Map',
      exact: true
    }).click();
    await root(page).getByRole('button', {
      name: 'Tap to interact',
      exact: true
    }).click();
    const marker = root(page).locator('.leaflet-marker-icon').first();
    const box = await marker.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await root(page).getByRole('heading', {
      name: 'Services at this location',
      exact: true
    }).waitFor();
    await until(async () => (await camera(page))[0]?.zoom >= 15, 'touch selection camera committed');
    await sleep(350);
    assert.equal(await root(page).locator('article').count(), 2, 'touch chooser remains locked after camera moves');
    row.camera = await camera(page);
    row.events = await page.evaluate(() => window.__qa.events);
    assert.equal(row.events.filter(event => event.type === 'PIN_ACTIVATE').length, 1);
    assert.equal(row.events.filter(event => event.type === 'PIN_ENTER').length, 0);
  }, {
    viewport: {
      width: 390,
      height: 844
    },
    touch: true,
    reduced: true
  });
  await run('filtered_reset_fits_current_pin_and_row_escape_releases_lock', async (page, state, row) => {
    const initial = await camera(page);
    await root(page).locator('select').selectOption('services');
    sameCamera(await camera(page), initial);
    await root(page).getByRole('button', {name:'Reset map',exact:true}).click();
    await sleep(200);
    const reset = await camera(page);
    assert.equal(reset[0].id,initial[0].id);
    assert.equal(reset[0].zoom,16);
    assert.ok(Math.abs(reset[0].lat-1.31)<0.0001 && Math.abs(reset[0].lng-103.81)<0.0001);
    assert.equal(await root(page).locator('article').count(),3);
    await root(page).locator('select').selectOption('');
    sameCamera(await camera(page),reset);
    const button=article(page,'Fictional shared venue').locator('button[aria-pressed]');
    await button.focus(); await page.keyboard.press('Enter');
    assert.equal(await button.getAttribute('aria-pressed'),'true');
    await page.keyboard.press('Escape');
    assert.equal(await button.getAttribute('aria-pressed'),'false','Escape dismisses list-pane map lock');
    assert.ok(await button.evaluate(el=>el===document.activeElement));
    sameCamera(await camera(page),reset);
    await root(page).locator('.leaflet-marker-icon').first().hover();
    await root(page).getByRole('heading',{name:'Services at this location',exact:true}).waitFor();
    sameCamera(await camera(page),reset);
    row.camera={initial,reset};
  }, {reduced:true});
  await run('row_escape_releases_map_only_lock', async (page, state, row) => {
    const button=article(page,'Fictional shared venue').locator('button[aria-pressed]');
    await button.focus(); await page.keyboard.press('Enter');
    await sleep(200);
    const locked=await camera(page);
    assert.equal(await button.getAttribute('aria-pressed'),'true');
    await page.keyboard.press('Escape');
    assert.equal(await button.getAttribute('aria-pressed'),'false','Escape dismisses list-pane map lock');
    assert.ok(await button.evaluate(el=>el===document.activeElement));
    await root(page).locator('.leaflet-marker-icon').first().hover();
    await root(page).getByRole('heading',{name:'Services at this location',exact:true}).waitFor();
    sameCamera(await camera(page),locked);
    row.camera=locked;
  }, {reduced:true});
  await run('zero_pin_reset_keeps_regional_basemap', async (page, state, row) => {
    assert.equal(await root(page).locator('.leaflet-marker-icon').count(), 0);
    const before = await camera(page);
    await root(page).getByRole('button', {
      name: 'Reset map',
      exact: true
    }).click();
    await sleep(200);
    sameCamera(await camera(page), before);
    assert.equal(await root(page).locator('article').count(), 4);
    row.camera = before;
  }, {
    profile: 'all-unplotted',
    reduced: true
  });
  for (const viewport of [{
    width: 390,
    height: 844
  }, {
    width: 844,
    height: 390
  }, {
    width: 1470,
    height: 900
  }]) await run('tap_guard_preserves_host_scroll_' + viewport.width, async (page, state, row) => {
    if (viewport.width < 768) await root(page).getByRole('button', {
      name: 'Map',
      exact: true
    }).click();
    const guard = root(page).getByRole('button', {
      name: 'Tap to interact',
      exact: true
    });
    assert.ok(!(await guard.evaluate(el => el === document.activeElement)));
    await page.evaluate(() => {
      const space = document.createElement('div');
      space.style.height = '1200px';
      space.id = 'fictional-host-spacer';
      document.body.append(space);
    });
    const box = await guard.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    if (viewport.width < 1000) {
      const session = await page.context().newCDPSession(page),
        x = Math.round(box.x + box.width / 2),
        y = Math.round(box.y + box.height * .75);
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{
          x,
          y
        }]
      });
      for (let step = 1; step <= 6; step++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{
            x,
            y: y - step * 25
          }]
        });
        await sleep(25);
      }
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
      await session.detach();
      row.hostScrollInput = 'Chromium CDP touch swipe on guarded map';
    } else {
      await page.mouse.wheel(0, 250);
      row.hostScrollInput = 'Browser wheel over guarded map';
    }
    await until(() => page.evaluate(() => scrollY > 0), 'guard prevents host scroll');
    row.hostScroll = await page.evaluate(() => scrollY);
    await page.evaluate(() => scrollTo(0, 0));
    await guard.click();
    const wrapper = root(page).locator('[tabindex="-1"]').filter({
      has: page.locator('.leaflet-container')
    });
    assert.ok(await wrapper.evaluate(el => el === document.activeElement));
    assert.equal(await wrapper.getAttribute('inert'), null);
    await root(page).getByRole('button', {
      name: 'Done',
      exact: true
    }).click();
    assert.ok(await guard.evaluate(el => el === document.activeElement));
    await guard.click();
    await page.keyboard.press('Escape');
    assert.ok(await guard.evaluate(el => el === document.activeElement));
    if (viewport.width < 768) await root(page).getByRole('button', {
      name: 'List',
      exact: true
    }).click();
    await article(page, 'Fictional home service A').getByRole('button', {
      name: 'View service',
      exact: true
    }).click();
    await root(page).getByRole('heading', {
      name: 'Fictional home service A',
      exact: true
    }).waitFor();
  }, {
    viewport,
    touch: true,
    reduced: true
  });
  await run('outside_only_explicit_new_tab_handoff', async (page, state) => {
    for (const code of ['000003', '000004']) {
      await evaluate(page, code);
      assert.equal(await page.locator('a[target="_blank"][href^="/discover"]').count(), 0);
    }
    await evaluate(page, '000009');
    const link = page.locator('a[target="_blank"][href^="/discover"]');
    assert.equal(await link.getAttribute('href'), '/discover?postal=000009');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
    await postal(page).fill('00000');
    assert.equal(await link.count(), 0);
  });
  for (const locale of ['en', 'zh-CN', 'ms', 'ta']) await run('four_locale_contact_headings_' + locale, async (page, state, row) => {
    await page.locator('nav select').selectOption(locale);
    await evaluate(page, '000001');
    await article(page, 'Fictional home service A').getByRole('button').last().click();
    const href = 'mailto:enquiry91001@example.invalid';
    await root(page).locator(`a[href="${href}"]`).waitFor();
    row.text = await root(page).innerText();
    assert.ok(!row.text.includes('regionalDiscovery'));
    assert.equal(await root(page).locator('a[href^="mailto:"]').count(), 1);
    assert.equal(await page.locator('div[lang]').first().getAttribute('lang'), locale);
    assert.ok(row.text.includes(translateUi(locale, 'regionalDiscoveryLocationEmail')));
    assert.ok(row.text.includes(translateUi(locale, 'regionalDiscoveryLocationPhone')));
    // 200% root text, not device-pixel emulation. Controls remain scroll-reachable.
    await page.addStyleTag({
      content: 'html{font-size:200%!important}'
    });
    await root(page).getByRole('button').filter({
      hasText: /./
    }).first().scrollIntoViewIfNeeded();
    await noOverflow(page);
    row.locale = locale;
  });
  await run('token_retirement_atomic_validation_current_membership', async (page, state, row) => {
    await evaluate(page, '000001');
    await article(page, 'Fictional home service A').getByRole('button', {
      name: 'View service',
      exact: true
    }).click();
    await root(page).locator('a[href="mailto:enquiry91001@example.invalid"]').waitFor();
    state.enqueue({
      hold: true,
      profile: 'inside-s2',
      label: 'Deferred old-token response'
    });
    await postal(page).fill('000002');
    await root(page).locator('button[type=submit]').click();
    await until(() => state.pending.length === 1, 'held old-token');
    state.profile = 'resource-withdrawn';
    await page.evaluate(() => {
      history.pushState({}, '', location.pathname.replace('fictional-regional-token', 'fictional-new-token'));
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await ready(page);
    assert.equal(await root(page).locator('article').count(), 3);
    await state.resolve();
    await sleep(100);
    assert.equal(await root(page).locator('article').count(), 3);
    assert.equal(await root(page).locator('a[href^="mailto:enquiry"]').count(), 0);
    await postal(page).fill('000001');
    assert.equal(await root(page).locator('article').count(), 3);
    assert.deepEqual(await root(page).locator('article button[aria-pressed] .font-semibold').allTextContents(), JSON.parse(fixture.raw['resource-withdrawn']).entries.map(x => x.name));
    state.enqueue({
      profile: 'inside-s1',
      invalid: true,
      label: 'FAULT INJECTION whole DTO unknown private field'
    });
    await root(page).locator('button[type=submit]').click();
    await root(page).getByRole('alert').waitFor();
    assert.equal(await root(page).locator('article').count(), 3);
    assert.equal(await root(page).locator('a[href^="mailto:enquiry"]').count(), 0);
    assert.ok(!(await root(page).innerText()).includes('CONTROLLED FAULT'));
  });
  await run('compact_default_multiresource_preview_baseline', async (page, state, row) => {
    await page.getByPlaceholder('Search this map', {
      exact: true
    }).waitFor();
    const initial = await compactSearchRestoration(page, row);
    await page.locator('.leaflet-marker-icon').first().click();
    await page.getByText('Fictional shared venue', {
      exact: true
    }).filter({
      visible: true
    }).first().waitFor();
    await page.getByText('Fictional co-located service', {
      exact: true
    }).filter({
      visible: true
    }).first().waitFor();
    assert.equal(await page.getByRole('link', {
      name: 'Open resource',
      exact: true
    }).count(), 2);
    assert.equal(await root(page).count(), 0);
    await compactPanReset(page, row, initial);
    row.boundary = 'Unenriched genuine compact controller: default category-bubble, one selected place with two resource rows. Distinct from two-place category-icon chooser cohort.';
  }, {
    surface: 'compact'
  });
  await run('compact_saved_category_icon_internal_chooser_reset', async (page, state, row) => {
    await page.getByPlaceholder('Search this map', {
      exact: true
    }).waitFor();
    assert.equal(await root(page).count(), 0);
    assert.equal(await page.locator('input[inputmode="numeric"]').count(), 0);
    row.baseline = await page.locator('body').innerText();
    assert.ok(row.baseline.includes('Fictional'));
    assert.equal(state.requests.filter(x => x.path.includes('regional-discovery')).length, 0);
    assert.ok(await page.evaluate(() => window.__qa.storage.some(x => x.name === 'getItem' && x.args[0] === 'sc_hc')));
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('high-contrast')));
    const initial = await compactSearchRestoration(page, row);
    const marker = page.locator('.leaflet-marker-icon').first();
    await marker.click();
    const chooser = page.locator('[class~="z-[600]"]');
    await chooser.waitFor();
    row.chooserText = await chooser.innerText();
    assert.match(row.chooserText, /Fictional shared venue/);
    assert.match(row.chooserText, /Fictional compact second venue/);
    row.compactProducerEvidence = state.compactProducerEvidence;
    assert.deepEqual([...state.compactProducerEvidence.selectedPlaceKeys].sort(), ['hard-101', 'hard-104']);
    await chooser.getByRole('button').filter({
      hasText: 'Fictional shared venue'
    }).click();
    await page.getByText('Fictional shared venue', {
      exact: true
    }).filter({
      visible: true
    }).first().waitFor();
    assert.equal(await chooser.count(), 0, 'existing internal chooser closes on member selection');
    row.selectedText = await page.locator('body').innerText();
    assert.match(row.selectedText, /Open resource/);
    await compactPanReset(page, row, initial);
    assert.equal(await chooser.count(), 0);
    row.compactAcceptance.chooserMembers = 2;
    row.storage = await page.evaluate(() => window.__qa.storage);
  }, {
    surface: 'compact',
    compactGrouped: true,
    preferences: {
      sc_hc: 'true',
      sc_zoom: '0.9',
      carearound_locale: 'en'
    }
  });
  for (const surface of ['governed', 'fallback']) await run('legacy_' + surface + '_persistent_provider_baseline', async (page, state, row) => {
    await page.waitForTimeout(300);
    row.storage = await page.evaluate(() => window.__qa.storage);
    assert.ok(row.storage.some(x => x.name === 'getItem' && x.args[0] === 'sc_hc'));
    assert.ok(row.storage.some(x => x.name === 'getItem' && x.args[0] === 'carearound_locale'));
    assert.equal(await root(page).count(), 0);
    assert.equal(state.requests.filter(x => x.path.includes('regional-discovery')).length, 0);
  }, {
    surface,
    preferences: {
      sc_hc: 'true',
      sc_zoom: '0.9',
      carearound_locale: 'ms'
    }
  });
  await run('ordinary_discovery_baseline_ranking_search', async (page, state, row) => {
    await page.getByText('Fictional Alpha centre', {
      exact: true
    }).first().waitFor();
    await page.getByText('Fictional Beta centre', {
      exact: true
    }).first().waitFor();
    row.text = await page.locator('body').innerText();
    assert.equal(await root(page).count(), 0);
    assert.equal(state.requests.filter(x => x.path.includes('regional-discovery')).length, 0);
    const search = page.getByPlaceholder('Search by name, service, tag, or address', {
      exact: true
    }).filter({
      visible: true
    }).first();
    await search.fill('Fictional Beta');
    await page.waitForTimeout(400);
    assert.equal(await page.getByText('Fictional Alpha centre', {
      exact: true
    }).filter({
      visible: true
    }).count(), 0);
    await search.fill('');
    await page.getByText('Fictional Alpha centre', {
      exact: true
    }).filter({
      visible: true
    }).first().waitFor();
    row.inputs = await page.locator('input').evaluateAll(els => els.map(e => ({
      placeholder: e.placeholder,
      type: e.type
    })));
    assert.ok(row.text.indexOf('Fictional Alpha centre') < row.text.indexOf('Fictional Beta centre'));
    row.boundary = 'Ordinary App default ranking on two explicit synthetic public-resource rows; not a controller-provenance or live ranking claim.';
  }, {
    owner: true,
    surface: 'ordinary'
  });
  for (const v2 of [false, true]) await run('owner_save_preview_cas_publish_' + (v2 ? 'v2' : 'stable'), async (page, state, row) => {
    await page.getByText('Fictional regional directory', {
      exact: true
    }).first().waitFor({
      state: 'attached'
    });
    await page.getByRole('button', {
      name: 'Share',
      exact: true
    }).click();
    const settings = page.locator('[data-regional-discovery-settings]');
    await settings.locator('summary').click();
    const preview = settings.getByRole('button', {
        name: 'Preview saved regional directory',
        exact: true
      }),
      publish = settings.getByRole('button', {
        name: 'Publish saved regional directory',
        exact: true
      });
    await settings.getByLabel('West', {
      exact: true
    }).fill('103.61');
    assert.ok(await preview.isDisabled());
    assert.ok(await publish.isDisabled());
    await settings.getByRole('button', {
      name: 'Save regional settings',
      exact: true
    }).click();
    await settings.getByText('Settings saved. The published directory has not changed.', {
      exact: true
    }).waitFor();
    await preview.click();
    await ready(page);
    await page.evaluate(() => {
      window.__qa.ownerInitial = window.__qa.hooks.get('owner:9:2');
    });
    assert.equal(state.requests.filter(x => x.method === 'POST' && x.path.endsWith('/share')).length, 0);
    assert.deepEqual(state.requests.filter(x => x.path.endsWith('/preview')).map(x => x.body), [{
      revision: 2
    }]);
    const initial = await camera(page);
    await evaluate(page, '000001');
    await article(page, 'Fictional home service A').getByRole('button', {
      name: 'View service',
      exact: true
    }).click();
    await root(page).locator('a[href="mailto:enquiry91001@example.invalid"]').waitFor();
    await postal(page).fill('000002');
    assert.equal(await root(page).locator('a[href="mailto:enquiry91001@example.invalid"]').count(), 0);
    await root(page).locator('button[type=submit]').click();
    await root(page).locator('a[href="mailto:enquiry91002@example.invalid"]').waitFor();
    assert.deepEqual((await camera(page)).map(x => x.id), initial.map(x => x.id));
    await root(page).getByRole('heading', {
      name: 'Fictional home service A',
      exact: true
    }).focus();
    await page.keyboard.press('Escape');
    assert.equal(await root(page).locator('article').count(), 4);
    assert.ok(await settings.isVisible(), 'handled preview Escape must not close outer modal');
    assert.ok(await page.evaluate(() => {
      const h = window.__qa.hooks.get('owner:9:2'),
        old = window.__qa.ownerInitial;
      return h.controller === old.controller && h.initialPayload === old.initialPayload && h.evaluateImpl === old.evaluateImpl;
    }), 'stable injected owner references');
    await root(page).getByRole('button', {
      name: 'Clear postal',
      exact: true
    }).click();
    await page.evaluate(() => window.__qa.hooks.get('owner:9:2').controller.retry());
    assert.deepEqual(state.requests.filter(x => x.path.endsWith('/preview')).at(-1).body, {
      revision: 2
    });
    row.emptyContextRetry = 'Actual mounted hook callback observed/invoked imperatively; no separate UI action exists after Clear.';
    assert.ok(state.requests.filter(x => x.path.endsWith('/preview')).every(x => x.body.revision === 2));
    assert.equal(state.requests.filter(x => x.path.startsWith('/api/shared-maps/') && x.path.includes('/regional-discovery')).length, 0);
    await settings.getByLabel('West', {
      exact: true
    }).fill('103.62');
    assert.equal(await root(page).count(), 0, 'edit retires saved preview');
    await state.concurrentSave();
    await settings.getByRole('button', {
      name: 'Save regional settings',
      exact: true
    }).click();
    await settings.getByText(/changed in another session/).waitFor();
    assert.equal(await settings.getByLabel('West', {
      exact: true
    }).inputValue(), '103.62');
    assert.ok(await preview.isDisabled());
    await settings.getByRole('button', {
      name: 'Reload saved settings (discard draft)',
      exact: true
    }).click();
    await until(() => settings.getByLabel('West', {
      exact: true
    }).inputValue().then(x => x === '103.61'), 'saved reload');
    await preview.click();
    await ready(page);
    assert.equal(state.requests.filter(x => x.path.endsWith('/preview')).at(-1).body.revision, 3);
    await publish.click();
    await settings.getByText(/Publication updated/).waitFor();
    const publication = state.requests.filter(x => x.method === 'POST' && x.path.endsWith('/share'));
    assert.equal(publication.length, 1);
    assert.deepEqual(publication[0].body.embeddedView, {
      mode: 'regional-discovery',
      revision: 3
    });
    await settings.getByLabel('Published regional URL', {
      exact: true
    }).waitFor();
    await settings.getByRole('button', {
      name: 'Copy regional embed code',
      exact: true
    }).click();
    row.regionalCode = await page.evaluate(() => window.__qa.clipboard.at(-1));
    assert.match(row.regionalCode, /width="100%" height="720"/);
    await page.getByRole('button', {
      name: 'Update shared link',
      exact: true
    }).click();
    await until(() => state.requests.filter(x => x.method === 'POST' && x.path.endsWith('/share')).length === 2, 'legacy publish');
    assert.equal(Object.hasOwn(state.requests.filter(x => x.method === 'POST' && x.path.endsWith('/share')).at(-1).body, 'embeddedView'), false);
    row.options = await page.evaluate(() => window.__qa.publishOptions);
    assert.deepEqual(Object.keys(row.options.at(-1)).sort(), ['hasNoteImagesRevision', 'includeAnnotations', 'noteImagesRevision'].sort());
    assert.equal(row.options.at(-1).hasNoteImagesRevision, true);
    await page.getByRole('checkbox', {
      name: /Enable website embed/
    }).uncheck();
    await page.getByRole('button', {
      name: 'Save embed settings',
      exact: true
    }).click();
    await until(() => settings.getByLabel('Published regional URL', {
      exact: true
    }).count().then(n => n === 0), 'disabled URL retires');
    await page.getByRole('checkbox', {
      name: /Enable website embed/
    }).check();
    await page.getByRole('button', {
      name: 'Save embed settings',
      exact: true
    }).click();
    await settings.getByLabel('Published regional URL', {
      exact: true
    }).waitFor();
    await page.getByRole('button', {
      name: 'Unpublish',
      exact: true
    }).click();
    await until(() => settings.getByLabel('Published regional URL', {
      exact: true
    }).count().then(n => n === 0), 'unpublished URL retires');
    row.controllerState = 'Disposable PGlite owner controller operations; ordinary map auxiliary DTOs are explicit local stubs.';
  }, {
    owner: true,
    v2
  });
  for (const failure of ['studio', 'annotation']) await run('owner_' + failure + (failure === 'studio' ? '_load_failure_blocks_publication' : '_flush_failure_blocks_publication'), async (page, state, row) => {
    await page.getByText('Fictional regional directory', {
      exact: true
    }).first().waitFor({
      state: 'attached'
    });
    await page.getByRole('button', {
      name: 'Share',
      exact: true
    }).click();
    if (failure === 'annotation') await page.getByRole('checkbox', {
      name: /Include annotations/
    }).check();
    await page.getByRole('button', {
      name: 'Update shared link',
      exact: true
    }).click();
    await page.waitForTimeout(400);
    assert.equal(state.requests.filter(x => x.path.endsWith('/share') && x.method === 'POST').length, 0);
    row.text = await page.getByRole('dialog').innerText();
    assert.match(row.text, /could not|failed|save|Save/i);
  }, {
    owner: true,
    annotations: true,
    ...(failure === 'studio' ? {
      studioFailure: true
    } : {
      annotationFailure: 'write'
    })
  });
  for (const fails of [true, false]) await run('owner_studio_pending_write_' + (fails ? 'failure_blocks_publication' : 'success_precedes_publication'), async (page, state, row) => {
    await page.getByRole('button', {
      name: 'Rename',
      exact: true
    }).first().waitFor();
    state.holdStudioWrite = true;
    state.studioError = fails ? 'write' : false;
    state.faults.push({
      label: 'Controlled held Studio PUT' + (fails ? ' then 503 failure' : ' then genuine controller success')
    });
    await page.getByRole('button', {
      name: 'Rename',
      exact: true
    }).first().click();
    const name = 'Fictional saved Studio revision';
    await page.locator('#map-studio-view-name-9').fill(name);
    await page.locator('form').filter({
      has: page.locator('#map-studio-view-name-9')
    }).getByRole('button', {
      name: 'Rename',
      exact: true
    }).click();
    await until(() => state.pending.length === 1, 'actual mounted Studio edit starts held PUT');
    const write = state.requests.find(request => request.path.endsWith('/studio') && request.method === 'PUT');
    assert.ok(write.body.views.some(view => view.name === name), 'edited Studio name reaches actual PUT');
    assert.equal(write.responseCompletedOrder, undefined);
    await page.getByRole('button', {
      name: 'Share',
      exact: true
    }).click();
    const settings = page.locator('[data-regional-discovery-settings]');
    await settings.locator('summary').click();
    await settings.getByRole('button', {
      name: 'Publish saved regional directory',
      exact: true
    }).click();
    await until(() => page.evaluate(() => window.__qa.publishOptions.length === 1), 'explicit publish attempted while Studio save is pending');
    await sleep(150);
    assert.equal(state.requests.filter(request => request.path.endsWith('/share') && request.method === 'POST').length, 0, 'no publication while Studio PUT pending');
    await state.resolve();
    if (fails) {
      await page.getByText('Save Map Studio changes before updating the shared link.', {
        exact: true
      }).waitFor();
      assert.equal(write.responseStatus, 503);
      assert.equal(state.requests.filter(request => request.path.endsWith('/share') && request.method === 'POST').length, 0, 'failed pending Studio save prevents publication');
    } else {
      await settings.getByText(/Publication updated/).waitFor();
      const publication = state.requests.find(request => request.path.endsWith('/share') && request.method === 'POST');
      assert.equal(write.responseStatus, 200);
      assert.equal(write.responseRevision, 2);
      assert.ok(write.responseCompletedOrder < publication.requestOrder, 'successful Studio response completed before share request');
      assert.equal(publication.studioRevisionAtPublish, 2);
      assert.ok(publication.studioNamesAtPublish.includes(name));
      assert.deepEqual(publication.body.embeddedView, {
        mode: 'regional-discovery',
        revision: 1
      });
      assert.equal(publication.body.studioViewId, 'view-default');
      row.savedStudioBeforePublication = {
        writeCompleted: write.responseCompletedOrder,
        shareRequested: publication.requestOrder,
        savedStudioRevision: publication.studioRevisionAtPublish,
        regionalRevision: publication.body.embeddedView.revision
      };
    }
  }, {
    owner: true
  });
  await run('owner_settings_error_cancellation_and_readback_failure', async (page, state, row) => {
    await page.getByRole('button', {
      name: 'Share',
      exact: true
    }).waitFor();
    await page.getByRole('button', {
      name: 'Share',
      exact: true
    }).click();
    const settings = page.locator('[data-regional-discovery-settings]');
    await settings.locator('summary').click();
    await settings.getByLabel('Published regional URL', {
      exact: true
    }).waitFor();
    state.holdPreview = true;
    state.faults.push({
      label: 'Deferred owner preview transport cancelled by outer Close'
    });
    await settings.getByRole('button', {
      name: 'Preview saved regional directory',
      exact: true
    }).click();
    await until(() => state.pending.length === 1, 'held owner preview');
    await page.getByRole('button', {
      name: 'Close',
      exact: true
    }).last().click();
    await state.resolve();
    assert.equal(await root(page).count(), 0);
    assert.equal(await settings.count(), 0);
    state.holdPreview = false;
    state.settingsError = true;
    state.faults.push({
      label: 'Controlled owner settings/readback 503'
    });
    await page.getByRole('button', {
      name: 'Share',
      exact: true
    }).click();
    await settings.locator('summary').click();
    await settings.getByText(/could not load/).waitFor();
    assert.equal(await settings.getByLabel('Published regional URL', {
      exact: true
    }).count(), 0);
    await page.getByRole('button', {
      name: 'Update shared link',
      exact: true
    }).click();
    await until(() => state.requests.some(x => x.path.endsWith('/share') && x.method === 'POST'), 'legacy publish independent of settings error');
    assert.equal(Object.hasOwn(state.requests.filter(x => x.path.endsWith('/share') && x.method === 'POST').at(-1).body, 'embeddedView'), false);
  }, {
    owner: true
  });
  await run('owner_saved_revision_survives_availability_refresh_failure', async (page, state, row) => {
    await page.getByRole('button',{name:'Share',exact:true}).click();
    const settings=page.locator('[data-regional-discovery-settings]');
    await settings.locator('summary').click();
    await settings.getByLabel('Published regional URL',{exact:true}).waitFor();
    const published=await settings.getByLabel('Published regional URL',{exact:true}).inputValue();
    await settings.getByLabel('West',{exact:true}).fill('103.61');
    state.settingsError=true;
    state.faults.push({label:'PUT succeeds through actual controller; subsequent availability GET returns controlled 503'});
    await settings.getByRole('button',{name:'Save regional settings',exact:true}).click();
    await settings.getByText('Settings saved. The published directory has not changed.',{exact:true}).waitFor();
    await until(()=>settings.getByRole('button',{name:'Preview saved regional directory',exact:true}).isEnabled(),'save completed despite refresh failure');
    assert.equal(await settings.getByText('Regional settings could not be completed. Check your choices and try again.',{exact:true}).count(),0);
    await settings.getByText('Approval availability could not refresh. Reload saved settings to check it again.',{exact:true}).waitFor();
    assert.equal(await settings.getByText(/Original email: approved availability confirmed/).count(),0);
    assert.equal(await settings.getByLabel('Published regional URL',{exact:true}).inputValue(),published);
    await settings.getByRole('button',{name:'Preview saved regional directory',exact:true}).click();
    await ready(page);
    assert.deepEqual(state.requests.filter(x=>x.path.endsWith('/preview')).map(x=>x.body),[{revision:2}]);
    assert.equal(state.requests.filter(x=>x.path.endsWith('/share')&&x.method==='POST').length,0);
    row.savedRevision=2; row.publicationUnchanged=true;
  }, {owner:true});
  await run('owner_annotation_flush_success_before_explicit_publication', async (page, state, row) => {
    await page.getByRole('button', {
      name: 'Share',
      exact: true
    }).waitFor();
    await page.getByRole('button', {
      name: 'Share',
      exact: true
    }).click();
    await page.getByRole('checkbox', {
      name: /Include annotations/
    }).check();
    const settings = page.locator('[data-regional-discovery-settings]');
    await settings.locator('summary').click();
    await settings.getByRole('button', {
      name: 'Publish saved regional directory',
      exact: true
    }).click();
    await settings.getByText(/Publication updated/).waitFor();
    const i = state.requests.findIndex(x => x.method === 'POST' && x.path.endsWith('/share')),
      a = state.requests.findIndex(x => x.method === 'PUT' && x.path.endsWith('/print-annotations'));
    assert.ok(a >= 0 && a < i);
    assert.deepEqual(state.requests[i].body.embeddedView, {
      mode: 'regional-discovery',
      revision: 1
    });
    row.order = {
      annotationWrite: a,
      publication: i
    };
  }, {
    owner: true,
    annotations: true
  });
  await run('owner_print_export_scope_and_default_renderer', async (page, state, row) => {
    await page.goto(new URL('/my-directory/maps/9?view=print&studioView=view-default', fixture.base).href);
    await page.locator('.leaflet-container').first().waitFor();
    await page.waitForTimeout(350);
    row.text = await page.locator('body').innerText();
    assert.equal(await root(page).count(), 0);
    assert.doesNotMatch(row.text, /Fictional other public venue|PRIVATE VENUE ADDRESS/);
    row.maps = await camera(page);
    assert.ok(row.maps.length >= 1);
    assert.equal(state.requests.filter(x => x.method !== 'GET').length, 0);
    row.boundary = 'Actual Print/Export route and scoped native markers; no PNG download or physical print proof.';
  }, {
    owner: true
  });
  for (const scenario of ['approved', 'disallowed', 'disabled', 'config-error']) await run('browser_framing_' + scenario, async (page, state, row) => {
    const approved = scenario === 'approved';
    const host = scenario === 'disallowed' ? 'https://wrong.example.invalid' : 'https://host.example.invalid';
    let responseHeaders;
    await page.route('https://**.example.invalid/**', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'embed.example.invalid') {
        const response = await buildRegionalDiscoveryResponse({
          params: {
            token
          },
          request: new Request(url),
          env: {
            CAREAROUND_EMBED_API_BASE_URL: 'https://fictional-api.example.invalid/api',
            ASSETS: {
              fetch: async () => new Response('<!doctype html><html><body><main id="framing-sentinel">Fictional regional shell</main></body></html>', {
                headers: {
                  'Content-Type': 'text/html',
                  'X-Frame-Options': 'DENY'
                }
              })
            }
          }
        }, async () => scenario === 'config-error' ? new Response('{}', {
          status: 503
        }) : scenario === 'disabled' ? new Response('{}', {
          status: 404
        }) : new Response(fixture.raw['framing-config'], {
          headers: {
            'Content-Type': 'application/json'
          }
        }));
        responseHeaders = Object.fromEntries(response.headers);
        return route.fulfill({
          status: response.status,
          headers: responseHeaders,
          body: Buffer.from(await response.arrayBuffer())
        });
      }
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><body><h1>Fictional host</h1><iframe title="Regional framing" src="https://embed.example.invalid/embed/maps/fictional-regional-token/regional-discovery"></iframe></body></html>'
      });
    });
    await page.goto(host + '/');
    await until(() => Boolean(responseHeaders), 'framing response');
    assert.equal(responseHeaders['cache-control'], 'no-store');
    assert.equal(responseHeaders['x-robots-tag'], 'noindex, nofollow');
    assert.equal(responseHeaders['x-frame-options'], undefined);
    if (approved) await page.frameLocator('iframe').locator('#framing-sentinel').waitFor();else {
      await page.waitForTimeout(300);
      assert.equal(await page.frameLocator('iframe').locator('#framing-sentinel').count(), 0);
    }
    row.headers = responseHeaders;
    row.boundary = 'Actual Chromium enforcement of current Pages response-builder CSP over intercepted HTTPS hosts and a sentinel asset shell. Separate from actual-App mounted cases and from Wrangler/workerd/deployed Pages proof.';
  }, {
    surface: 'framing'
  });
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  report.sourceAfter = await sourceBindings();
  report.sourceUnchanged = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
  report.summary = {
    passed: report.cases.filter(x => x.passed).length,
    failed: report.cases.filter(x => !x.passed).length
  };
  if (report.failure || report.summary.failed || !report.sourceUnchanged) process.exitCode = 1;
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await fixture?.server.close();
  console.log(JSON.stringify({
    out,
    summary: report.summary,
    failure: report.failure,
    sourceUnchanged: report.sourceUnchanged
  }));
}
