import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundled real editor/hook with a deterministic hook scheduler and inert view
// components. This verifies save isolation/lifecycle, not mounted DOM gestures.
async function runtime() {
    const entry = `export {default as editor} from './hooks/useInteractiveMapAnnotationEditor.jsx';
        export {capture} from 'fixture:hooks';`;
    const scheduler = `export const capture={slots:[],index:0,effects:[],dirty:false};
        const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
        export const useState=initial=>{const i=capture.index++;if(!capture.slots[i])capture.slots[i]={value:typeof initial==='function'?initial():initial};
          return[capture.slots[i].value,next=>{const value=typeof next==='function'?next(capture.slots[i].value):next;if(!Object.is(value,capture.slots[i].value)){capture.slots[i].value=value;capture.dirty=true;}}];};
        export const useMemo=(fn,deps)=>{const i=capture.index++,old=capture.slots[i];if(!old||!equal(old.deps,deps))capture.slots[i]={value:fn(),deps};return capture.slots[i].value;};
        export const useCallback=(fn,deps)=>useMemo(()=>fn,deps);
        export const useEffect=(fn,deps)=>{const i=capture.index++,old=capture.slots[i];if(!old||!equal(old.deps,deps)){capture.effects.push(()=>{old?.cleanup?.();capture.slots[i]={deps,cleanup:fn()};});}};
        capture.render=fn=>{let result,n=0;do{capture.dirty=false;capture.index=0;capture.effects=[];result=fn();for(const effect of capture.effects)effect();if(n++>20)throw new Error('hook fixture did not settle');}while(capture.dirty);return result;};`;
    const { outputFiles } = await build({
        stdin: { contents: entry, resolveDir: new URL('../src/', import.meta.url).pathname, loader: 'jsx' },
        bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'silent', jsx: 'automatic',
        plugins: [{ name: 'measurement-wiring-only', setup(build) {
            build.onResolve({ filter: /^(react|react\/jsx-runtime|fixture:hooks)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
            build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'react/jsx-runtime'
                ? `export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment='fragment';`
                : path === 'react' ? `export * from 'fixture:hooks';` : scheduler }));
            build.onLoad({ filter: /\/components\/(PrintAnnotationLayer|PrintAnnotationToolbar|AnnotationImageUpload|AnnotationResourcePicker|KmlBoundaryImport|TemporaryMapMeasurementLayer)\.jsx$/ }, () => ({ contents: `export default function InertView(){return null;}` }));
            build.onLoad({ filter: /\/components\/boundaries\/(BoundaryLibraryPicker|BoundaryLibrarySaveDialog)\.jsx$/ }, () => ({ contents: `export default function InertView(){return null;}` }));
            build.onLoad({ filter: /AnnotationToolModeControls\.jsx$/ }, () => ({ contents: `export const AnnotationToolModeControls=()=>null;export const TemporaryMapMeasurementControls=()=>null;` }));
        } }],
    });
    const module = { exports: {} };
    new Function('module', 'exports', outputFiles[0].text)(module, module.exports);
    return module.exports;
}

async function fixture(count = 0) {
    const r = await runtime(), writes = [], saves = [], history = [];
    const annotations = Array.from({ length: count }, (_, index) => ({ id: `a${index}`, type: 'circle',
        text: '', points: [[1.3, 103.8], [1.301, 103.8]], style: {} }));
    const props = { mapId: 912, enabled: true, temporaryMeasurementEnabled: true, annotations,
        replaceAnnotations: fn => writes.push(fn(annotations)), saveNow: () => saves.push(true),
        undo: () => history.push('undo'), redo: () => history.push('redo'), canUndo: true, canRedo: true };
    let current;
    const render = () => (current = r.capture.render(() => r.editor(props)));
    render();
    return { props, writes, saves, history, render, get current() { return current; } };
}

test('a temporary radius at full capacity never writes saved annotations or history and clears on Return', async () => {
    const f = await fixture(200);
    assert.equal(f.current.surfaceOverlay.props.creationLimitReached, true);
    f.current.surfaceOverlay.props.modeControls.props.onChange(true); f.render();
    let controls = f.current.surfaceOverlay.props.measurementControls;
    assert.ok(controls);
    controls.props.onKindChange('radius'); f.render();
    f.current.mapOverlay.props.children[1].props.onPoint([1.3, 103.8]); f.render();
    f.current.mapOverlay.props.children[1].props.onPoint([1.301, 103.8]); f.render();
    assert.equal(f.current.mapOverlay.props.children[0].props.editable, false);
    assert.equal(f.current.hasTemporaryMeasurement, true);
    assert.equal(f.current.hasUnfinishedDraft, false, 'temporary result must not block another tool');
    assert.equal(f.current.surfaceOverlay.props.measurementControls.props.measurement.points.length, 2);
    assert.deepEqual(f.writes, []); assert.deepEqual(f.saves, []); assert.deepEqual(f.history, []);
    f.props.temporaryMeasurementEnabled = false; f.render();
    assert.equal(f.current.hasTemporaryMeasurement, false);
    assert.equal(f.current.surfaceOverlay.props.measurementControls, null);
    assert.equal(f.current.surfaceOverlay.props.modeControls, null);
    assert.equal(f.current.mapOverlay.props.children[0].props.editable, true);
    assert.deepEqual(f.writes, []);
});

test('an unfinished saved drawing blocks measuring; temporary clear preserves the selected saved tool', async () => {
    const f = await fixture();
    f.current.selectTool('circle'); f.render();
    f.current.mapOverlay.props.children[0].props.onDraftPointsChange([[1.3, 103.8]]); f.render();
    assert.equal(f.current.hasUnfinishedDraft, true);
    f.current.surfaceOverlay.props.modeControls.props.onChange(true); f.render();
    assert.equal(f.current.surfaceOverlay.props.measurementControls, null);
    assert.equal(f.current.tool, 'circle');
    f.current.cancelDraft(); f.render();
    f.current.surfaceOverlay.props.modeControls.props.onChange(true); f.render();
    f.current.mapOverlay.props.children[1].props.onPoint([1.3, 103.8]); f.render();
    f.current.clearTemporaryMeasurement(); f.render();
    assert.equal(f.current.hasTemporaryMeasurement, false);
    assert.equal(f.current.tool, 'select');
    assert.deepEqual(f.writes, []);
});

test('saved circle retains the existing create and history handlers, while full-capacity additions are refused', async () => {
    const f = await fixture(199);
    f.current.selectTool('circle'); f.render();
    f.current.mapOverlay.props.children[0].props.onCreate('circle', [[1.3, 103.8], [1.301, 103.8]]); f.render();
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0].length, 200);
    assert.equal(f.writes[0].at(-1).type, 'circle'); assert.match(f.writes[0].at(-1).id, /^annotation_/);
    f.current.surfaceOverlay.props.onUndo(); f.current.surfaceOverlay.props.onRedo();
    assert.deepEqual(f.history, ['undo', 'redo']);
    const full = await fixture(200);
    full.current.selectTool('circle'); full.render();
    assert.equal(full.current.tool, 'select');
    full.current.mapOverlay.props.children[0].props.onCreate('circle', [[1.3, 103.8], [1.301, 103.8]]);
    assert.deepEqual(full.writes, []);
    full.current.surfaceOverlay.props.onUndo();
    assert.deepEqual(full.history, ['undo'], 'existing edits/history remain usable at capacity');
});

test('view changes clear temporary geometry and panel cancellation disables its map interaction', async () => {
    const f = await fixture();
    f.props.measurementScopeKey = 'first-view'; f.render();
    f.current.surfaceOverlay.props.modeControls.props.onChange(true); f.render();
    f.current.mapOverlay.props.children[1].props.onPoint([1.3, 103.8]); f.render();
    assert.equal(f.current.hasTemporaryMeasurement, true);
    f.props.measurementScopeKey = 'second-view'; f.render();
    assert.equal(f.current.hasTemporaryMeasurement, false);
    assert.equal(f.current.surfaceOverlay.props.measurementControls.props.measurement.points.length, 0);
    f.current.cancelDraft(); f.render();
    assert.equal(f.current.surfaceOverlay.props.measurementControls, null);
    assert.equal(f.current.mapOverlay.props.children[1], null);
    assert.deepEqual(f.writes, []); assert.deepEqual(f.saves, []);
});
