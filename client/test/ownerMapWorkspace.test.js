import test from 'node:test';
import assert from 'node:assert/strict';
import { currentOwnerWorkspaceUrl, getOwnerWorkspaceCapacity, isOwnerMapWorkspaceEnabled } from '../src/lib/ownerMapWorkspace.js';

test('owner workspace defaults on without a build flag and retains explicit presentation overrides', () => {
    assert.equal(isOwnerMapWorkspaceEnabled(''), true);
    assert.equal(isOwnerMapWorkspaceEnabled('', undefined), true);
    assert.equal(isOwnerMapWorkspaceEnabled('', false), false);
    assert.equal(isOwnerMapWorkspaceEnabled('', 'false'), false);
    assert.equal(isOwnerMapWorkspaceEnabled('workspace=split', false), true);
    assert.equal(isOwnerMapWorkspaceEnabled('workspace=current', 'true'), false);
    assert.equal(isOwnerMapWorkspaceEnabled('workspace=split'), true);
    assert.equal(isOwnerMapWorkspaceEnabled('workspace=current', true), false);
    assert.equal(isOwnerMapWorkspaceEnabled('workspace=unknown'), true);
    assert.equal(isOwnerMapWorkspaceEnabled('ui=stable'), true);
    assert.equal(isOwnerMapWorkspaceEnabled('', 'true'), true);
    assert.equal(isOwnerMapWorkspaceEnabled('ui=stable&workspace=split'), true);
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
