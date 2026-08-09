import test from 'node:test';
import assert from 'node:assert/strict';

import {
    acknowledgeMapStudioOwnerSave,
    createMapStudioOwnerState,
    createOwnerMapStudioView,
    createUniqueMapStudioViewId,
    deleteOwnerMapStudioView,
    discardOwnerMapStudioChanges,
    duplicateOwnerMapStudioView,
    getMapStudioOwnerRuntimeSnapshot,
    isMapStudioOwnerStateDirty,
    patchOwnerMapStudioDraft,
    patchOwnerMapStudioExploration,
    prepareMapStudioOwnerSave,
    renameOwnerMapStudioView,
    selectOwnerMapStudioView,
    setOwnerMapStudioMode,
    setDefaultOwnerMapStudioView,
} from '../src/lib/mapStudioOwnerState.js';
import {
    MAP_STUDIO_MODE_DESIGN,
    createMapStudioDocument,
    patchMapStudioDraft,
} from '../src/lib/mapStudioState.js';

test('a lazy owner document starts as a clean virtual default without creating persistence state', () => {
    const state = createMapStudioOwnerState(null, { mapStyle: 'gray', detailMode: 'auto' });

    assert.equal(state.persistedDocument.revision, 0);
    assert.equal(state.workingDocument.views[0].design.basemap.style, 'gray');
    assert.equal(state.session.activeViewId, 'view-default');
    assert.equal(isMapStudioOwnerStateDirty(state), false);
});

test('named-view management stays local and atomic until explicit save', () => {
    const initial = createMapStudioOwnerState(createMapStudioDocument());
    const createdId = createUniqueMapStudioViewId(initial.workingDocument, 'outreach');
    const created = createOwnerMapStudioView(initial, { id: createdId, name: 'Outreach' });
    const copyId = createUniqueMapStudioViewId(created.workingDocument, 'outreach');
    const duplicated = duplicateOwnerMapStudioView(created, createdId, {
        id: copyId,
        name: 'Outreach print',
    });
    const renamed = renameOwnerMapStudioView(duplicated, copyId, 'Partner handout');
    const defaulted = setDefaultOwnerMapStudioView(renamed, createdId);
    const deleted = deleteOwnerMapStudioView(defaulted, copyId);

    assert.equal(createdId, 'view-outreach');
    assert.equal(copyId, 'view-outreach-2');
    assert.equal(deleted.workingDocument.defaultViewId, createdId);
    assert.deepEqual(
        deleted.workingDocument.views.map(({ id, name }) => ({ id, name })),
        [
            { id: 'view-default', name: 'Default view' },
            { id: createdId, name: 'Outreach' },
        ],
    );
    assert.equal(initial.persistedDocument.views.length, 1);
    assert.equal(isMapStudioOwnerStateDirty(deleted), true);
});

test('view switching refuses to abandon a dirty design without explicit discard', () => {
    const initial = createMapStudioOwnerState(createMapStudioDocument());
    const withSecond = createOwnerMapStudioView(initial, {
        id: 'view-second',
        name: 'Second',
    });
    const onDefault = selectOwnerMapStudioView(withSecond, 'view-default');
    const dirty = {
        ...onDefault,
        session: patchMapStudioDraft(onDefault.session, { basemap: { style: 'gray' } }),
    };

    assert.throws(
        () => selectOwnerMapStudioView(dirty, 'view-second'),
        /Save or discard the current Map Studio draft/,
    );
    const discarded = selectOwnerMapStudioView(dirty, 'view-second', { discardDraft: true });
    assert.equal(discarded.session.activeViewId, 'view-second');
    assert.equal(discarded.session.dirty, false);
});

test('the save payload uses the persisted CAS revision while including the current design draft', () => {
    const serverDocument = { ...createMapStudioDocument(), revision: 7 };
    const initial = createMapStudioOwnerState(serverDocument);
    const state = {
        ...initial,
        session: patchMapStudioDraft(initial.session, { basemap: { style: 'gray' } }),
    };
    state.session.exploration.query = 'temporary search';

    const prepared = prepareMapStudioOwnerSave(state);

    assert.equal(prepared.payload.revision, 7, 'the server revision remains the expected CAS value');
    assert.equal(prepared.payload.views[0].revision, 1);
    assert.equal(prepared.payload.views[0].design.basemap.style, 'gray');
    assert.equal(Object.hasOwn(prepared.payload, 'exploration'), false);
    assert.equal(Object.hasOwn(prepared.payload, 'exportSettings'), false);
});

test('server acknowledgement resets the whole editor to the returned revision and preserves exploration', () => {
    const initial = createMapStudioOwnerState({ ...createMapStudioDocument(), revision: 3 });
    const renamed = renameOwnerMapStudioView(initial, 'view-default', 'Service plan');
    renamed.session.exploration.query = 'active ageing';
    const prepared = prepareMapStudioOwnerSave(renamed);
    const returned = { ...prepared.payload, revision: 4 };
    const acknowledged = acknowledgeMapStudioOwnerSave(renamed, returned, prepared);

    assert.equal(acknowledged.persistedDocument.revision, 4);
    assert.equal(acknowledged.workingDocument.views[0].name, 'Service plan');
    assert.equal(acknowledged.session.exploration.query, 'active ageing');
    assert.equal(isMapStudioOwnerStateDirty(acknowledged), false);
});

test('discard restores the last server document after unsaved named-view changes', () => {
    const initial = createMapStudioOwnerState({ ...createMapStudioDocument(), revision: 2 });
    const created = createOwnerMapStudioView(initial, { id: 'view-new', name: 'New view' });
    const discarded = discardOwnerMapStudioChanges(created);

    assert.equal(discarded.workingDocument.revision, 2);
    assert.deepEqual(discarded.workingDocument.views.map((view) => view.id), ['view-default']);
    assert.equal(discarded.session.activeViewId, 'view-default');
    assert.equal(isMapStudioOwnerStateDirty(discarded), false);
});

test('runtime snapshot exposes one cloned active design without leaking documents', () => {
    const state = createMapStudioOwnerState(createMapStudioDocument());
    const snapshot = getMapStudioOwnerRuntimeSnapshot(state);

    assert.equal(snapshot.activeViewId, 'view-default');
    assert.equal(snapshot.activeViewName, 'Default view');
    assert.equal(snapshot.mode, 'explore');
    assert.equal(snapshot.designDirty, false);
    assert.equal(snapshot.ownerDirty, false);
    assert.equal('workingDocument' in snapshot, false);
    assert.equal('persistedDocument' in snapshot, false);

    snapshot.design.basemap.style = 'gray';
    assert.equal(state.session.draftDesign.basemap.style, 'default');
});

test('owner design mutations require Design mode and remain explicit-save drafts', () => {
    const initial = createMapStudioOwnerState(createMapStudioDocument());

    assert.throws(
        () => patchOwnerMapStudioDraft(initial, { basemap: { style: 'gray' } }),
        /Enter Map Studio Design mode/,
    );

    const designing = setOwnerMapStudioMode(initial, MAP_STUDIO_MODE_DESIGN);
    const changed = patchOwnerMapStudioDraft(designing, {
        basemap: { style: 'gray' },
    });
    const snapshot = getMapStudioOwnerRuntimeSnapshot(changed);

    assert.equal(snapshot.mode, 'design');
    assert.equal(snapshot.design.basemap.style, 'gray');
    assert.equal(snapshot.designDirty, true);
    assert.equal(snapshot.ownerDirty, true);
    assert.equal(changed.workingDocument.views[0].design.basemap.style, 'default');
    assert.equal(changed.persistedDocument.views[0].design.basemap.style, 'default');
});

test('owner exploration mutations never dirty the persistent document', () => {
    const initial = createMapStudioOwnerState(createMapStudioDocument());
    const explored = patchOwnerMapStudioExploration(initial, {
        query: 'senior care',
        selectedPlaceKeys: ['hard:1'],
        cameraView: { center: [1.38, 103.74], zoom: 15 },
    });
    const snapshot = getMapStudioOwnerRuntimeSnapshot(explored);

    assert.deepEqual(snapshot.exploration, {
        query: 'senior care',
        hoveredPlaceKey: null,
        focusedPlaceKeys: [],
        selectedPlaceKeys: ['hard:1'],
        cameraView: { center: [1.38, 103.74], zoom: 15 },
    });
    assert.equal(snapshot.designDirty, false);
    assert.equal(snapshot.ownerDirty, false);

    const prepared = prepareMapStudioOwnerSave(explored);
    assert.equal('exploration' in prepared.payload, false);
});
