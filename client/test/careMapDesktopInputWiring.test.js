import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

let loaded;
async function runtime() {
    if (loaded) return loaded;
    const entry = `
      export { default as RequestedScale } from './components/DirectoryMapRequestedScaleSync.jsx';
      export { default as DesktopControl } from './components/CareMapDesktopInputControl.jsx';
      export { default as NorthButton } from './components/CareMapNorthButton.jsx';
      export { useCareMapGestures as gestures } from './hooks/useCareMapGestures.js';
      export { capture } from 'fixture:capture';
    `;
    const capture = `export const capture={effects:[],attached:[],disposed:0,map:null};`;
    const { outputFiles } = await build({
        stdin: { contents: entry, resolveDir: new URL('../src/', import.meta.url).pathname, loader: 'jsx' },
        bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'silent', jsx: 'automatic',
        plugins: [{ name: 'actual-input-wiring', setup(build) {
            build.onResolve({ filter: /^(react|react\/jsx-runtime|react-leaflet|leaflet|lucide-react|fixture:capture)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
            build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'fixture:capture' ? capture
                : path === 'react' ? `import {capture} from 'fixture:capture';export const useEffect=(fn,deps)=>capture.effects.push({fn,deps});export const useRef=value=>({current:value});export const useMemo=fn=>fn();export const useCallback=fn=>fn;export const useState=value=>[typeof value==='function'?value():value,()=>{}];`
                    : path === 'react/jsx-runtime' ? `export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`
                        : path === 'lucide-react' ? `export const Navigation=()=>null;`
                    : path === 'react-leaflet' ? `import {capture} from 'fixture:capture';export const useMap=()=>capture.map;`
                        : `export default {DomEvent:{getWheelDelta:event=>-event.deltaY}};` }));
            build.onLoad({ filter: /LocaleContext\.jsx$/ }, () => ({ contents: `export const useLocale=()=>({t:key=>key});` }));
            build.onLoad({ filter: /careMapDesktopInputController\.js$/ }, () => ({ contents: `import {capture} from 'fixture:capture';export const attachCareMapDesktopInput=options=>{capture.attached.push(options);return{dispose(){capture.disposed++}}};` }));
        } }],
    });
    const module = { exports: {} };
    new Function('module', 'exports', outputFiles[0].text)(module, module.exports);
    loaded = module.exports; return loaded;
}

class Events {
    callbacks = new Map();
    addEventListener(name, fn) { this.callbacks.set(name, fn); }
    removeEventListener(name, fn) { if (this.callbacks.get(name) === fn) this.callbacks.delete(name); }
    dispatch(name, event) { this.callbacks.get(name)?.(event); }
}

function mapFixture() {
    const container = new Events(), handlers = new Map();
    return { zoom: 13, container, getContainer: () => container, getZoom() { return this.zoom; },
        on(names, fn) { for (const name of names.split(' ')) handlers.set(name, fn); },
        off(names) { for (const name of names.split(' ')) handlers.delete(name); },
        fire(name) { handlers.get(name)?.(); } };
}

test('the normal hook explicitly opts in while Export/other calls retain legacy defaults', async () => {
    const r = await runtime(); r.capture.effects.length = 0;
    assert.equal(r.gestures({ scopeKey: 'export:fictional' }).desktopWheelPolicy, 'legacy');
    const normal = r.gestures({ scopeKey: 'owner:fictional', desktopWheelPolicy: 'page-scroll-pinch', pinchZoomGain: 5 });
    assert.equal(normal.desktopWheelPolicy, 'page-scroll-pinch'); assert.equal(normal.pinchZoomGain, 2);
    assert.equal(normal.scopeKey, 'owner:fictional');
});

test('North hints match the explicit owner policy while defaults keep the legacy hint', async () => {
    const r = await runtime();
    assert.equal(r.NorthButton({ configuration: {} }).props.title, 'careMapResetNorth — careMapGesturesHint');
    assert.equal(r.NorthButton({ configuration: { desktopWheelPolicy: 'page-scroll-pinch' } }).props.title,
        'careMapResetNorth — careMapPageScrollGesturesHint');
    assert.equal(r.NorthButton({ configuration: {}, hint: 'Explicit hint' }).props.title,
        'careMapResetNorth — Explicit hint');
});

test('the thin controller is inactive by default and disposes for camera/scope effect replacement', async () => {
    const r = await runtime(); r.capture.map = mapFixture(); r.capture.effects.length = 0;
    r.capture.attached.length = 0;
    r.DesktopControl({}); assert.equal(r.capture.effects.pop().fn(), undefined); assert.equal(r.capture.attached.length, 0);
    r.DesktopControl({ enabled: true, gain: 1.5, scopeKey: 'a', cameraKey: '13' });
    const first = r.capture.effects.pop(); const cleanup = first.fn();
    assert.equal(r.capture.attached.length, 1); assert.equal(typeof cleanup, 'function');
    cleanup(); assert.ok(r.capture.disposed > 0);
    r.DesktopControl({ enabled: true, gain: 1.5, scopeKey: 'b', cameraKey: '14' });
    const second = r.capture.effects.pop(); assert.notDeepEqual(first.deps, second.deps);
});

test('the actual requested-scale capture shares admission and never books ordinary page scrolling', async () => {
    const r = await runtime(), originalWindow = globalThis.window, originalDocument = globalThis.document;
    const host = new Events(), document = new Events(); let nextTimer = 0;
    host.setTimeout = () => ++nextTimer; host.clearTimeout = () => {};
    globalThis.window = host; globalThis.document = document;
    try {
        for (const policy of ['page-scroll-pinch', 'legacy']) {
            r.capture.effects.length = 0; const map = mapFixture(); r.capture.map = map;
            const preferenceRef = { current: false }, updates = [];
            r.RequestedScale({ enabled: true, preferenceRef, onChange: value => updates.push(value), desktopWheelPolicy: policy });
            const cleanup = r.capture.effects.pop().fn();
            map.container.dispatch('wheel', { deltaY: 20, ctrlKey: false, cancelable: true });
            assert.equal(preferenceRef.current, policy === 'legacy');
            cleanup();
        }
        r.capture.effects.length = 0; const map = mapFixture(); r.capture.map = map;
        const preferenceRef = { current: false };
        r.RequestedScale({ enabled: true, preferenceRef, desktopWheelPolicy: 'page-scroll-pinch' });
        const cleanup = r.capture.effects.pop().fn();
        map.container.dispatch('wheel', { deltaY: 20, ctrlKey: true, cancelable: true });
        assert.equal(preferenceRef.current, true, 'admitted outward pinch preserves its intent before camera movement');
        map.zoom = 12.9; map.fire('gestureend'); assert.equal(preferenceRef.current, true);
        cleanup();
    } finally { globalThis.window = originalWindow; globalThis.document = originalDocument; }
});
