import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildRegionalDiscoveryPublishIntent, normalizeRegionalDiscoverySettings,
    getPublishedRegionalDiscoveryUrl, normalizeRegionalDiscoveryEmbeddedView, containHandledRegionalPreviewEscape,
} from '../src/features/regional-discovery/regionalDiscoverySettings.js';

const config = () => ({schemaVersion:1, mode:'regional-discovery', includedSubregionIds:[901,902],
    regionExtent:[103.6,1.15,104.1,1.5], entries:[{resourceType:'soft',resourceId:901,
        mapPlacement:'unplotted',distanceSource:'none',emailMode:'home-sr',phoneMode:'hidden'}]});

test('explicit regional publication requires the current saved revision', () => {
    assert.deepEqual(buildRegionalDiscoveryPublishIntent({savedRevision:4,hasUnsavedChanges:false,config:config()}), {mode:'regional-discovery',revision:4});
    for (const savedRevision of [0,-1,1.5,undefined,2147483648]) {
        assert.throws(()=>buildRegionalDiscoveryPublishIntent({savedRevision,config:config()}));
    }
});
test('unsaved_settings_warning blocks explicit publication in either mode', () => {
    for (const mode of ['compact','regional-discovery']) {
        assert.throws(()=>buildRegionalDiscoveryPublishIntent({savedRevision:4,hasUnsavedChanges:true,config:{...config(),mode}}), /Save/);
    }
    assert.deepEqual(buildRegionalDiscoveryPublishIntent({savedRevision:0,config:{...config(),mode:'compact'}}),{mode:'compact'});
});
test('included areas, curated no-pin service and independent replacement fields round-trip', () => {
    const value=config();
    const normalized=normalizeRegionalDiscoverySettings(value);
    assert.deepEqual(normalized,value);
    assert.notEqual(normalized.entries,value.entries);
    for (const channel of ['emailMode','phoneMode']) for (const mode of ['original','hidden','home-sr']) {
        const candidate=config(); candidate.entries[0][channel]=mode;
        assert.equal(normalizeRegionalDiscoverySettings(candidate).entries[0][channel],mode);
    }
});
test('invalid config cannot become publication intent', () => {
    for (const mutate of [c=>c.includedSubregionIds=[],c=>c.includedSubregionIds=[901,901],c=>c.regionExtent=[104,2,103,1],
        c=>c.entries.push(c.entries[0]),c=>c.entries[0].emailMode='approved',c=>c.entries[0].recipient='private@example.test',c=>c.entries[0].resourceType='personal_place']) {
        const value=config();mutate(value);assert.throws(()=>normalizeRegionalDiscoverySettings(value));
    }
});
test('regional_settings_failure_does_not_block_compact_publish: absent explicit intent stays absent', () => {
    assert.equal(normalizeRegionalDiscoveryEmbeddedView(undefined),undefined);
    assert.deepEqual(normalizeRegionalDiscoveryEmbeddedView({mode:'compact'}),{mode:'compact'});
    assert.throws(()=>normalizeRegionalDiscoveryEmbeddedView({mode:'compact',revision:4}));
    assert.throws(()=>normalizeRegionalDiscoveryEmbeddedView({mode:'regional-discovery',revision:0}));
});
test('regional_copy_is_explicit: only available publication readback provides a regional URL', () => {
    const published={mode:'regional-discovery',available:true,snapshotRevision:'snapshot-1',publishedConfigRevision:4,regionalUrl:'/embed/maps/test-token/regional-discovery'};
    assert.equal(getPublishedRegionalDiscoveryUrl(published),published.regionalUrl);
    for (const change of [{available:false},{mode:'compact'},{snapshotRevision:null},{publishedConfigRevision:0},{regionalUrl:'https://other.test/embed/maps/x/regional-discovery'},{regionalUrl:'/embed/maps/x'},{regionalUrl:null}]) {
        assert.equal(getPublishedRegionalDiscoveryUrl({...published,...change}),'');
    }
    assert.equal(getPublishedRegionalDiscoveryUrl({config:config()}),'');
});

test('only Escape already handled inside Preview stops before the outer modal', () => {
    for (const key of ['Escape','Tab','Enter']) for (const defaultPrevented of [true,false]) {
        let stopped=0;
        containHandledRegionalPreviewEscape({key,defaultPrevented,stopPropagation:()=>{stopped++;}});
        assert.equal(stopped,key==='Escape' && defaultPrevented ? 1 : 0);
    }
});
