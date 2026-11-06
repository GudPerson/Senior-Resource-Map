import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateFrozenRegionalDiscoveryFixtures } from '../../tests/fixtures/regional-discovery/serialize.mjs';
import { buildRegionalDiscoveryPresentation } from '../src/features/regional-discovery/regionalDiscoveryPresentation.js';
await validateFrozenRegionalDiscoveryFixtures();
const fixture = name => JSON.parse(readFileSync(new URL(`../../tests/fixtures/regional-discovery/server-dto/${name}.json`, import.meta.url), 'utf8'));

test('server recommendation/distance/publication order is preserved without category/name sorting', () => {
    const dto = fixture('inside-s1');
    const result = buildRegionalDiscoveryPresentation(dto);
    assert.deepEqual(result.entries.map(e => e.entryKey), dto.entries.map(e => e.entryKey));
    assert.deepEqual(result.entries.map(e => e.distanceMeters), dto.entries.map(e => e.distanceMeters));
    assert.equal(result.entriesByKey['soft:203'].distanceMeters, null);
    assert.equal(result.serviceOptions[0].key, '');
    assert.deepEqual(result.serviceOptions.slice(1).map(e => e.key), dto.categories.map(e => e.key));
});
test('genuine selected venues and live withdrawal never fall back to another venue', () => {
    const before = buildRegionalDiscoveryPresentation(fixture('base'));
    const after = buildRegionalDiscoveryPresentation(fixture('resource-withdrawn'));
    assert.deepEqual(before.pins.map(p => p.placeKey), ['hard-101']);
    assert.equal(after.entriesByKey['hard:101'], undefined);
    assert.ok(after.pins.every(p => p.entryKeys.every(k => after.entriesByKey[k])));
});
test('intentional no-pin is distinct from unavailable coordinates and never fabricates distance', () => {
    const dto = fixture('base');
    dto.entries[0].placement = 'coordinates-unavailable'; dto.entries[0].pinPlaceKeys = [];
    dto.entries[0].distanceMeters = null;
    dto.pins[0].entryKeys = dto.pins[0].entryKeys.filter(k => k !== dto.entries[0].entryKey);
    const result = buildRegionalDiscoveryPresentation(dto);
    assert.equal(result.entriesByKey['hard:101'].placement, 'coordinates-unavailable');
    assert.equal(result.entriesByKey['soft:202'].placement, 'intentionally-unplotted');
    assert.equal(result.entriesByKey['hard:101'].distanceMeters, null);
    assert.equal(result.entriesByKey['soft:202'].distanceMeters, null);
});
test('all-unmapped directory retains server extent and every service', () => {
    const dto = fixture('all-unplotted');
    const result = buildRegionalDiscoveryPresentation(dto);
    assert.equal(result.pins.length, 0);
    assert.equal(result.entries.length, dto.entries.length);
    assert.deepEqual(result.regionBounds, [[dto.regionExtent[1], dto.regionExtent[0]], [dto.regionExtent[3], dto.regionExtent[2]]]);
});
test('service dropdown filters entries and pin memberships in server order', () => {
    const dto = fixture('inside-s1');
    const result = buildRegionalDiscoveryPresentation(dto, { selectedServiceKey: 'services' });
    assert.deepEqual(result.entries.map(e => e.entryKey), dto.entries.filter(e => e.categoryKey === 'services').map(e => e.entryKey));
    assert.deepEqual(result.entryKeysByPlaceKey['hard-101'], ['soft:201']);
    assert.deepEqual(result.pins[0].entryKeys, ['soft:201']);
    assert.equal(buildRegionalDiscoveryPresentation(dto, { selectedServiceKey: 'missing' }).pins.length, 0);
});

test('coincident venues share one marker and retain every service and place key', () => {
    const dto = fixture('base');
    const shared = dto.pins[0];
    const secondKey = 'hard-999';
    dto.entries[0].pinPlaceKeys.push(secondKey);
    dto.pins.push({ ...shared, placeKey: secondKey, entryKeys: [dto.entries[0].entryKey] });
    const result = buildRegionalDiscoveryPresentation(dto);
    assert.equal(result.pins.length, 1);
    assert.deepEqual(result.pins[0].memberPlaceKeys, [shared.placeKey, secondKey]);
    assert.deepEqual(result.pins[0].entryKeys, shared.entryKeys);
});

// These render the real regional units. Map tiles are replaced only at the renderer boundary.
let render;
async function renderers() {
    if (render) return render;
    const { build } = await import('esbuild');
    const { createRequire } = await import('node:module');
    const { outputFiles } = await build({
        stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
            import View from './RegionalDiscoveryView.jsx'; import Detail from './RegionalServiceDetail.jsx';
            import Pane from './RegionalDirectoryPane.jsx';
            export const view=props=>renderToStaticMarkup(<View {...props}/>);
            export const detail=props=>renderToStaticMarkup(<Detail {...props}/>);
            export const pane=props=>renderToStaticMarkup(<Pane {...props}/>);`,
            resolveDir: new URL('../src/features/regional-discovery/', import.meta.url).pathname, loader: 'jsx' },
        plugins: [{ name: 'local-map-boundary', setup(build) {
            build.onResolve({filter: /components\/DirectoryMap\.jsx$/}, () => ({path:'map-boundary',namespace:'regional-test'}));
            build.onLoad({filter: /^map-boundary$/, namespace:'regional-test'}, () => ({contents: `import React from 'react'; export default function Map(props){return <div data-selection={props.resourceSelectionMode} data-reset={String(props.showResetControl)} data-pins={props.pins.length}/>}`, loader:'jsx', resolveDir: process.cwd() }));
            build.onResolve({filter: /^react-leaflet$/}, () => ({path:'leaflet-boundary',namespace:'regional-test'}));
            build.onLoad({filter: /^leaflet-boundary$/, namespace:'regional-test'}, () => ({contents: 'export function useMap(){return {}}',loader:'js'}));
        }}], bundle: true, write: false, format: 'cjs', platform:'node', jsx:'automatic', logLevel:'silent',
    });
    const module = {exports:{}};
    new Function('require','module','exports',outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
    render = module.exports;
    return render;
}
test('read-only view renders bounded directory, modality guard and independent reset with no pins', async () => {
    const previousMatchMedia = globalThis.matchMedia;
    try {
        // No matchMedia represents the explicit current SSR fallback: no touch guard.
        for (const coarsePointer of [undefined, false, true]) {
            globalThis.matchMedia = coarsePointer === undefined ? undefined : query => ({
                matches: query === '(pointer: coarse)' && coarsePointer,
            });
            const html = (await renderers()).view({ payload: fixture('all-unplotted') });
            assert.match(html, /height:720px/);
            assert.match(html, /min-h-0/);
            assert.match(html, /overflow-y-auto/);
            if (coarsePointer === true) assert.match(html, /Tap to interact/);
            else assert.doesNotMatch(html, /Tap to interact/);
            assert.match(html, /Reset map/);
            assert.match(html, /Clear postal/);
            assert.match(html, /data-selection="external"/);
            assert.match(html, /data-reset="false"/);
            assert.match(html, /data-pins="0"/);
            assert.match(html, /inputmode="numeric"/i);
            assert.match(html, /pattern="\[0-9\]\{6\}"/);
            assert.doesNotMatch(html, /Save|Locate me|profile|latitude|longitude/i);
        }
    } finally {
        if (previousMatchMedia === undefined) delete globalThis.matchMedia;
        else globalThis.matchMedia = previousMatchMedia;
    }
});
test('detail renders only approved fields with separately labelled safe contacts', async () => {
    const dto = fixture('inside-s1');
    const html = (await renderers()).detail({entry: dto.entries.find(e=>e.entryKey==='soft:202')});
    assert.match(html, /ICCP enquiry email for this location/);
    assert.match(html, /mailto:enquiry91001@example.invalid/);
    assert.match(html, /ICCP enquiry phone for this location/);
    assert.match(html, /tel:\+6560001111/);
    assert.doesNotMatch(html, /Save|1572|subregion|zone|home-sr/i);
    const withdrawn = fixture('contact-withdrawn');
    const unavailable = (await renderers()).detail({entry: withdrawn.entries.find(e=>e.entryKey==='soft:202')});
    assert.doesNotMatch(unavailable, /mailto:|tel:|enquiry91001/);
});
test('injected copy and loading/error states need no future locale keys or hooks', async () => {
    const html = (await renderers()).view({payload:fixture('base'),copy:{allServices:'Every service',map:'Map view'}});
    assert.match(html, /Every service/); assert.match(html, /Map view/);
    assert.match((await renderers()).view({loading:true}), /Loading services/);
    assert.match((await renderers()).view({error:'Please retry'}), /role="alert"[^>]*>Please retry/);
});
test('external map bypasses internal controllers and includes grouped callback metadata; defaults stay internal', () => {
    const source = readFileSync(new URL('../src/components/DirectoryMap.jsx', import.meta.url),'utf8');
    assert.match(source, /resourceSelectionMode = 'internal'/);
    assert.match(source, /showResetControl = true/);
    assert.match(source, /resourceSelectionMode !== 'external' && <DirectoryMapController/);
    assert.match(source, /showResetControl && <DirectoryMapRecenterControl/);
    assert.match(source, /resourceSelectionMode !== 'external' && visibleCategoryPinGroup/);
    assert.match(source, /placeKeys:.*memberPlaceKeys/);
    assert.match(source, /onHoverPlaceStart\?\.\(placeKey, /);
    assert.match(source, /onHoverPlaceEnd\?\.\(placeKey, /);
    assert.match(source, /onViewSection\?\.\(placeKey, /);
});

test('deliberately unplotted service retains independently approved server distance', () => {
    const dto = fixture('inside-s1');
    const service = dto.entries.find(entry => entry.entryKey === 'soft:203');
    service.distanceMeters = 123;
    const result = buildRegionalDiscoveryPresentation(dto);
    assert.deepEqual(result.entriesByKey[service.entryKey].pinPlaceKeys, []);
    assert.equal(result.entriesByKey[service.entryKey].distanceMeters, 123);
});

test('local camera preserves viewport across fresh DTO arrays, filters, Back and mobile remount-free switches', async () => {
    const {build} = await import('esbuild');
    const {createRequire} = await import('node:module');
    const {outputFiles} = await build({
        entryPoints: [new URL('../src/features/regional-discovery/RegionalDiscoveryMap.jsx', import.meta.url).pathname],
        bundle:true, write:false, format:'cjs', platform:'node', jsx:'automatic', logLevel:'silent',
        plugins:[{name:'camera-effects',setup(build){
            build.onResolve({filter:/^(react|react-leaflet)$/},args=>({path:args.path,namespace:'camera-test'}));
            build.onResolve({filter:/components\/DirectoryMap\.jsx$/},()=>({path:'directory',namespace:'camera-test'}));
            build.onLoad({filter:/.*/,namespace:'camera-test'},args=>({loader:'js',contents:args.path==='react' ? `
                export const useRef=value=>globalThis.__regionalCameraHooks.ref(value);
                export const useEffect=(fn,deps)=>globalThis.__regionalCameraHooks.effect(fn,deps);
                export const useLayoutEffect=useEffect;
                export const useState=value=>[value,()=>{}]; export default {};
            ` : args.path==='react-leaflet' ? 'export const useMap=()=>globalThis.__regionalCameraMap;' : 'export default function DirectoryMap(){return null}'}));
        }}],
    });
    const module={exports:{}};
    new Function('require','module','exports',outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
    const calls=[]; const refs=[]; const effects=[];
    let refIndex=0; let effectIndex=0; let pending=[];
    const oldMatchMedia=globalThis.matchMedia;
    try {
        globalThis.matchMedia=()=>({matches:true}); // Reduced motion is a real decision boundary.
        globalThis.__regionalCameraMap={fitBounds:(...args)=>calls.push(['bounds',...args]),setView:(...args)=>calls.push(['view',...args]),getZoom:()=>12,invalidateSize:()=>{},getContainer:()=>({})};
        globalThis.__regionalCameraHooks={
            ref(value){const i=refIndex++;return refs[i] ||= {current:value};},
            effect(fn,deps){const i=effectIndex++;const previous=effects[i];if(!previous || deps.some((value,j)=>!Object.is(value,previous[j]))) pending.push(fn);effects[i]=deps;},
        };
        const render=(cameraRequest=null, filtered=false)=>{
            refIndex=0;effectIndex=0;pending=[];
            module.exports.RegionalMapCamera({regionBounds:[[1.2,103.6],[1.5,104.1]],pins:filtered?[]:[{lat:1.31,lng:103.81,memberPlaceKeys:['venue']}],cameraRequest});
            pending.forEach(effect=>effect());
        };
        render(); assert.equal(calls.length,1); assert.equal(calls[0][2].animate,false);
        render(); render(null,true); render(); assert.equal(calls.length,1,'new identities or filter must not refit');
        const request={id:1,type:'selection',placeKeys:['venue']};
        render(request); assert.equal(calls.length,2); assert.equal(calls[1][0],'view'); assert.equal(calls[1][3].animate,false);
        render(request,true); render(request); assert.equal(calls.length,2,'Back and mounted pane switches keep the request id and camera');
        render({id:2,type:'reset',placeKeys:[]},true); assert.equal(calls.length,3); assert.equal(calls[2][0],'bounds');
        assert.deepEqual(calls[2][1],[[1.2,103.6],[1.5,104.1]],'zero pins use regional extent');
        render({id:3,type:'reset',placeKeys:[]});
        assert.deepEqual(calls[3][1],[[1.31,103.81]],'explicit Reset uses current plotted pins');
        assert.equal(calls[3][2].maxZoom,16,'single pin never overzooms');
        assert.equal(calls[3][2].animate,false);
    } finally {
        globalThis.matchMedia=oldMatchMedia;
        delete globalThis.__regionalCameraMap;delete globalThis.__regionalCameraHooks;
    }
});

test('controlled postal draft renders independently from last evaluated DTO', async () => {
    const html = (await renderers()).view({payload:fixture('inside-s1'),postalInput:'000009',onPostalInputChange:()=>{}});
    assert.match(html, /value="000009"/);
    assert.doesNotMatch(html, /value="000001"/);
});
