import test from 'node:test';
import assert from 'node:assert/strict';
import { currentOwnerWorkspaceUrl, getOwnerWorkspaceCapacity, isOwnerMapWorkspaceEnabled } from '../src/lib/ownerMapWorkspace.js';

const enabledExperimentWorkspace = (search, enabled) => isOwnerMapWorkspaceEnabled(search, enabled, true);

test('enabled experiment builds retain owner presentation selection and explicit overrides', () => {
    assert.equal(enabledExperimentWorkspace(''), true);
    assert.equal(enabledExperimentWorkspace('', undefined), true);
    assert.equal(enabledExperimentWorkspace('', false), false);
    assert.equal(enabledExperimentWorkspace('', 'false'), false);
    assert.equal(enabledExperimentWorkspace('workspace=split', false), true);
    assert.equal(enabledExperimentWorkspace('workspace=current', 'true'), false);
    assert.equal(enabledExperimentWorkspace('workspace=split'), true);
    assert.equal(enabledExperimentWorkspace('workspace=current', true), false);
    assert.equal(enabledExperimentWorkspace('workspace=unknown'), true);
    assert.equal(enabledExperimentWorkspace('ui=stable'), true);
    assert.equal(enabledExperimentWorkspace('', 'true'), true);
    assert.equal(enabledExperimentWorkspace('ui=stable&workspace=split'), true);
});

test('rollback policy prevents workspace flags and old owner build settings from restoring experiments', () => {
    for (const search of ['', 'workspace=split', 'workspace=current', 'ui=stable&workspace=split', 'mapFirst=true']) {
        for (const enabled of [undefined, true, 'true', false, 'false']) {
            assert.equal(isOwnerMapWorkspaceEnabled(search, enabled), false, `${search}: ${enabled}`);
        }
    }
});

test('current presentation preserves unrelated selected-view, route and map parameters', () => {
    assert.equal(currentOwnerWorkspaceUrl('https://app.carearound.sg/my-directory/maps/25?ui=stable&workspace=split&studioView=view-2#context'),
        'https://app.carearound.sg/my-directory/maps/25?ui=stable&workspace=current&studioView=view-2#context');
    assert.equal(new URL(currentOwnerWorkspaceUrl('https://app.carearound.sg/my-directory/maps/25?workspace=split', 'view-second')).searchParams.get('workspaceView'), 'view-second');
});

test('split capacity reserves readable cards, Studio, map corridor and map-control lane', () => {
    assert.deepEqual(getOwnerWorkspaceCapacity({width:1440,height:900,inspectorOpen:true}), {compact:false,split:true,columns:1});
    assert.equal(getOwnerWorkspaceCapacity({width:2304,height:1000,inspectorOpen:true}).columns,3);
    assert.equal(getOwnerWorkspaceCapacity({width:1440,height:900,fontSize:22.4,inspectorOpen:true}).split,false);
    assert.equal(getOwnerWorkspaceCapacity({width:768,height:1000,inspectorOpen:true}).split,false);
    assert.equal(getOwnerWorkspaceCapacity({width:390,height:844}).columns,1);
    assert.equal(getOwnerWorkspaceCapacity({width:844,height:390}).columns,1);
    assert.equal(getOwnerWorkspaceCapacity({width:1440,height:900,inspectorOpen:false}).columns,3);
});
