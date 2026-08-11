import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MAP_STUDIO_CAMERA_FIXED,
    MAP_STUDIO_DEFAULT_VIEW_ID,
    MAP_STUDIO_DETAIL_AUTO,
    MAP_STUDIO_EXPORT_MARGIN_WIDE,
    MAP_STUDIO_MAP_HEIGHT_TALL,
    MAP_STUDIO_MODE_DESIGN,
    MAP_STUDIO_PIN_STYLE_CATEGORY_ICON,
    MAP_STUDIO_PIN_STYLE_NUMBERED,
    MAP_STUDIO_SCHEMA_VERSION,
    buildMapStudioPrintState,
    createMapStudioDesign,
    createMapStudioDocument,
    createMapStudioExportSettings,
    createMapStudioSession,
    createMapStudioView,
    deleteMapStudioView,
    duplicateMapStudioView,
    isMapStudioViewDirty,
    migrateMapStudioDocument,
    normalizeMapStudioDocument,
    patchMapStudioDraft,
    patchMapStudioExploration,
    renameMapStudioView,
    saveMapStudioView,
    selectMapStudioView,
    setDefaultMapStudioView,
    setMapStudioMode,
} from '../src/lib/mapStudioState.js';
import {
    PRINT_MAP_ANNOTATION_LAYER_HIDE,
    PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES,
    PRINT_MAP_LAYOUT_FOCUS,
    PRINT_MAP_PAGE_LAYOUT_FULL,
    PRINT_MAP_PIN_SIZE_LARGE,
    PRINT_MAP_QUALITY_HIGH,
    PRINT_MAP_RESOURCE_LAYER_HIDE,
    PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE,
    PRINT_MAP_SIDE_RIGHT,
    PRINT_MAP_WIDTH_EXTRA_WIDE,
} from '../src/lib/printMapState.js';

test('numbered Studio pins reuse the current coloured Print View badge renderer', () => {
    const design = createMapStudioDesign();
    design.pins.style = MAP_STUDIO_PIN_STYLE_NUMBERED;

    const printState = buildMapStudioPrintState(design);

    assert.equal(printState.studioMarkerMode, 'print-badge');
});

test('a legacy My Map gets one versioned default view without changing existing runtime behavior', () => {
    const document = migrateMapStudioDocument(null, {
        mapStyle: 'gray',
        detailMode: MAP_STUDIO_DETAIL_AUTO,
    });

    assert.equal(document.schemaVersion, MAP_STUDIO_SCHEMA_VERSION);
    assert.equal(document.defaultViewId, MAP_STUDIO_DEFAULT_VIEW_ID);
    assert.equal(document.views.length, 1);
    assert.equal(document.views[0].name, 'Default view');
    assert.deepEqual(document.views[0].design.basemap, {
        style: 'gray',
        detailMode: 'auto',
    });
    assert.deepEqual(document.views[0].design.camera, { mode: 'fit', view: null });
    assert.deepEqual(document.views[0].design.pins, {
        style: 'category-bubble',
        size: 'standard',
        categoryShapes: {},
    });
});

test('schema reads are explicit and reject unknown future versions instead of overwriting them', () => {
    assert.throws(
        () => normalizeMapStudioDocument({ schemaVersion: MAP_STUDIO_SCHEMA_VERSION + 1, views: [] }),
        new RegExp(`Unsupported Map Studio schema version: ${MAP_STUDIO_SCHEMA_VERSION + 1}`),
    );
    assert.throws(
        () => normalizeMapStudioDocument({ views: [] }),
        /Unsupported Map Studio schema version: missing/,
    );
});

test('normalization bounds visual state and removes duplicate layer identifiers', () => {
    const normalized = normalizeMapStudioDocument({
        schemaVersion: MAP_STUDIO_SCHEMA_VERSION,
        revision: -10,
        defaultViewId: 'missing',
        views: [
            {
                id: 'view-one',
                name: '  Outreach   view  ',
                revision: 4,
                design: {
                    basemap: { style: 'gray', detailMode: 'unsupported' },
                    camera: { mode: MAP_STUDIO_CAMERA_FIXED, view: { center: [999, 999], zoom: 999 } },
                    pins: {
                        style: MAP_STUDIO_PIN_STYLE_NUMBERED,
                        size: PRINT_MAP_PIN_SIZE_LARGE,
                        categoryShapes: {
                            ' Active Ageing Centre (AAC) ': 'triangle',
                            'senior care centre (scc)': 'invalid',
                        },
                    },
                    labels: { detail: PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES },
                    layers: {
                        resources: PRINT_MAP_RESOURCE_LAYER_HIDE,
                        annotations: PRINT_MAP_ANNOTATION_LAYER_HIDE,
                        hiddenResourceLayerKeys: ['aac', 'aac', 'scc'],
                        hiddenAnnotationIds: ['note-2', 'note-1', 'note-2'],
                    },
                    layout: {
                        mapHeight: MAP_STUDIO_MAP_HEIGHT_TALL,
                        preset: PRINT_MAP_LAYOUT_FOCUS,
                        mapSide: PRINT_MAP_SIDE_RIGHT,
                        mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE,
                        resourceColumnCount: 4,
                        sideResourceColumnCount: 2,
                    },
                },
            },
        ],
    });

    assert.equal(normalized.revision, 0);
    assert.equal(normalized.defaultViewId, 'view-one');
    assert.equal(normalized.views.length, 1);
    assert.equal(normalized.views[0].name, 'Outreach view');
    assert.deepEqual(normalized.views[0].design.camera, { mode: 'fit', view: null });
    assert.equal(normalized.views[0].design.basemap.detailMode, 'auto');
    assert.deepEqual(normalized.views[0].design.layers.hiddenResourceLayerKeys, ['aac', 'scc']);
    assert.deepEqual(normalized.views[0].design.layers.hiddenAnnotationIds, ['note-1', 'note-2']);
    assert.deepEqual(normalized.views[0].design.pins.categoryShapes, {
        'active ageing centre (aac)': 'triangle',
    });
});

test('invalid persistent view collections fail closed instead of being truncated or overwritten', () => {
    assert.throws(
        () => normalizeMapStudioDocument({
            schemaVersion: MAP_STUDIO_SCHEMA_VERSION,
            defaultViewId: 'view-one',
            views: [
                { id: 'view-one', name: 'One', design: {} },
                { id: 'view-one', name: 'Duplicate', design: {} },
            ],
        }),
        /Duplicate Map Studio view id: view-one/,
    );
    assert.throws(
        () => normalizeMapStudioDocument({ schemaVersion: MAP_STUDIO_SCHEMA_VERSION, views: [] }),
        /must contain at least one view/,
    );
});

test('named view commands create, duplicate, rename, select, default, and delete isolated designs', () => {
    const baseline = createMapStudioDocument({ viewName: 'Service overview' });
    const withOutreach = createMapStudioView(baseline, {
        id: 'outreach',
        name: 'Outreach',
    });
    const withCopy = duplicateMapStudioView(withOutreach, 'outreach', {
        id: 'outreach-copy',
    });
    const renamed = renameMapStudioView(withCopy, 'outreach-copy', 'Print handout');
    const defaulted = setDefaultMapStudioView(renamed, 'outreach');
    const selected = selectMapStudioView(defaulted, createMapStudioSession(defaulted), 'outreach-copy');
    const deleted = deleteMapStudioView(defaulted, 'outreach');

    assert.deepEqual(
        defaulted.views.map(({ id, name }) => ({ id, name })),
        [
            { id: MAP_STUDIO_DEFAULT_VIEW_ID, name: 'Service overview' },
            { id: 'outreach', name: 'Outreach' },
            { id: 'outreach-copy', name: 'Print handout' },
        ],
    );
    assert.notEqual(defaulted.views[1].design, defaulted.views[2].design);
    assert.equal(defaulted.defaultViewId, 'outreach');
    assert.equal(selected.activeViewId, 'outreach-copy');
    assert.equal(selected.dirty, false);
    assert.equal(deleted.defaultViewId, MAP_STUDIO_DEFAULT_VIEW_ID);
    assert.deepEqual(deleted.views.map((view) => view.id), [MAP_STUDIO_DEFAULT_VIEW_ID, 'outreach-copy']);
    assert.throws(
        () => deleteMapStudioView(createMapStudioDocument(), MAP_STUDIO_DEFAULT_VIEW_ID),
        /retain at least one Map Studio view/,
    );
});

test('exploration and design drafts stay temporary until the explicit save command', () => {
    const document = createMapStudioDocument({ mapStyle: 'default' });
    const session = createMapStudioSession(document, { mode: MAP_STUDIO_MODE_DESIGN });
    const explored = patchMapStudioExploration(session, {
        query: 'active ageing',
        hoveredPlaceKey: 'hard:18397',
        focusedPlaceKeys: ['hard:18397'],
        cameraView: { center: [1.376, 103.742], zoom: 17 },
    });
    const drafted = patchMapStudioDraft(explored, {
        basemap: { style: 'gray' },
        camera: {
            mode: MAP_STUDIO_CAMERA_FIXED,
            view: { center: [1.376, 103.742], zoom: 17 },
        },
        pins: { size: PRINT_MAP_PIN_SIZE_LARGE },
    });

    assert.equal(document.views[0].design.basemap.style, 'default');
    assert.deepEqual(document.views[0].design.camera, { mode: 'fit', view: null });
    assert.equal(explored.dirty, false);
    assert.equal(explored.exploration.query, 'active ageing');
    assert.equal(drafted.dirty, true);
    assert.equal(isMapStudioViewDirty(document, drafted), true);

    const saved = saveMapStudioView(document, drafted);
    assert.equal(saved.document.revision, 1);
    assert.equal(saved.document.views[0].revision, 1);
    assert.equal(saved.document.views[0].design.basemap.style, 'gray');
    assert.deepEqual(saved.document.views[0].design.camera, {
        mode: MAP_STUDIO_CAMERA_FIXED,
        view: { center: [1.376, 103.742], zoom: 17 },
    });
    assert.equal(saved.session.dirty, false);
    assert.equal(saved.session.exploration.query, 'active ageing');
    assert.equal(isMapStudioViewDirty(saved.document, saved.session), false);
});

test('reverting a draft to its saved design clears dirty state', () => {
    const document = createMapStudioDocument();
    const session = createMapStudioSession(document);
    const changed = patchMapStudioDraft(session, { basemap: { style: 'gray' } });
    const reverted = patchMapStudioDraft(changed, { basemap: { style: 'default' } });

    assert.equal(changed.dirty, true);
    assert.equal(reverted.dirty, false);
});

test('view switching requires an explicit discard when the current design is dirty', () => {
    const document = createMapStudioView(createMapStudioDocument(), {
        id: 'second-view',
        name: 'Second view',
    });
    const dirtySession = patchMapStudioDraft(createMapStudioSession(document), {
        basemap: { style: 'gray' },
    });

    assert.throws(
        () => selectMapStudioView(document, dirtySession, 'second-view'),
        /Save or discard the current Map Studio draft/,
    );
    const discarded = selectMapStudioView(document, dirtySession, 'second-view', {
        discardDraft: true,
    });
    assert.equal(discarded.activeViewId, 'second-view');
    assert.equal(discarded.dirty, false);
    assert.equal(setMapStudioMode(discarded, MAP_STUDIO_MODE_DESIGN).mode, MAP_STUDIO_MODE_DESIGN);
});

test('explicit save rejects a stale session instead of overwriting a newer view revision', () => {
    const document = createMapStudioDocument();
    const staleSession = patchMapStudioDraft(createMapStudioSession(document), {
        basemap: { style: 'gray' },
    });
    const competingSession = patchMapStudioDraft(createMapStudioSession(document), {
        pins: { size: PRINT_MAP_PIN_SIZE_LARGE },
    });
    const competingSave = saveMapStudioView(document, competingSession);

    assert.throws(
        () => saveMapStudioView(competingSave.document, staleSession),
        /changed after this editing session started/,
    );
});

test('export settings stay outside persistent design and adapt to the locked Print View renderer', () => {
    const document = createMapStudioDocument({ mapStyle: 'gray', detailMode: 'auto' });
    const session = patchMapStudioDraft(createMapStudioSession(document), {
        camera: {
            mode: MAP_STUDIO_CAMERA_FIXED,
            view: { center: [1.377, 103.744], zoom: 16 },
        },
        pins: { size: PRINT_MAP_PIN_SIZE_LARGE },
        layout: {
            preset: PRINT_MAP_LAYOUT_FOCUS,
            mapSide: PRINT_MAP_SIDE_RIGHT,
            mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE,
            resourceColumnCount: 4,
            sideResourceColumnCount: 2,
        },
        labels: { detail: PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES },
        layers: {
            resources: PRINT_MAP_RESOURCE_LAYER_HIDE,
            annotations: PRINT_MAP_ANNOTATION_LAYER_HIDE,
            hiddenResourceLayerKeys: ['category:aac'],
            hiddenAnnotationIds: ['annotation:one'],
        },
    });
    const exportSettings = createMapStudioExportSettings({
        imageQuality: PRINT_MAP_QUALITY_HIGH,
        margins: MAP_STUDIO_EXPORT_MARGIN_WIDE,
    });
    const printState = buildMapStudioPrintState(session.draftDesign, exportSettings);

    assert.equal(document.views[0].design.camera.mode, 'fit');
    assert.equal(document.views[0].design.layers.resources, 'show');
    assert.equal(exportSettings.margins, MAP_STUDIO_EXPORT_MARGIN_WIDE);
    assert.deepEqual(printState.view, { center: [1.377, 103.744], zoom: 16 });
    assert.equal(printState.mapStyle, 'gray');
    assert.equal(printState.basemapMode, 'auto');
    assert.equal(printState.pinSize, PRINT_MAP_PIN_SIZE_LARGE);
    assert.equal(printState.studioMarkerMode, 'category-bubble');
    assert.equal(printState.resourceLayer, PRINT_MAP_RESOURCE_LAYER_HIDE);
    assert.equal(printState.annotationLayer, PRINT_MAP_ANNOTATION_LAYER_HIDE);
    assert.equal(printState.mapQuality, PRINT_MAP_QUALITY_HIGH);
    assert.equal(Object.hasOwn(exportSettings, 'layoutPreset'), false);
    assert.equal(printState.pageLayout, 'standard');
    assert.equal(printState.resourcePlacement, 'beside');
    assert.equal(printState.layoutPreset, PRINT_MAP_LAYOUT_FOCUS);
    assert.equal(printState.mapSide, PRINT_MAP_SIDE_RIGHT);
    assert.equal(printState.mapWidth, PRINT_MAP_WIDTH_EXTRA_WIDE);
    assert.equal(printState.resourceColumnCount, 4);
    assert.equal(printState.sideResourceColumnCount, 2);
    assert.equal(printState.margins, MAP_STUDIO_EXPORT_MARGIN_WIDE);
});

test('Export View defaults output-only settings to high resolution and wide margins', () => {
    const exportSettings = createMapStudioExportSettings();
    const printState = buildMapStudioPrintState(createMapStudioDesign(), exportSettings);

    assert.equal(exportSettings.imageQuality, PRINT_MAP_QUALITY_HIGH);
    assert.equal(exportSettings.margins, MAP_STUDIO_EXPORT_MARGIN_WIDE);
    assert.equal(printState.mapQuality, PRINT_MAP_QUALITY_HIGH);
    assert.equal(printState.margins, MAP_STUDIO_EXPORT_MARGIN_WIDE);
});

test('schema v1 views migrate additively into the unified v3 design model', () => {
    const migrated = migrateMapStudioDocument({
        schemaVersion: 1,
        revision: 4,
        defaultViewId: 'legacy-view',
        views: [{
            id: 'legacy-view',
            name: 'Legacy view',
            revision: 2,
            design: {
                ...createMapStudioDesign(),
                pins: { style: 'numbered', size: 'large' },
                layout: { mapHeight: 'tall', resourcePanel: 'beside-map' },
            },
        }],
    });

    assert.equal(migrated.schemaVersion, MAP_STUDIO_SCHEMA_VERSION);
    assert.deepEqual(migrated.views[0].design.layout, {
        mapHeight: 'tall',
        preset: PRINT_MAP_LAYOUT_FOCUS,
        mapSide: 'left',
        mapWidth: 'wide',
        resourceColumnCount: 2,
        sideResourceColumnCount: 1,
    });
    assert.equal(migrated.views[0].design.pins.style, MAP_STUDIO_PIN_STYLE_NUMBERED);
    assert.deepEqual(migrated.views[0].design.pins.categoryShapes, {});
});

test('schema v2 views migrate additively with Circle as the numbered-pin shape fallback', () => {
    const current = createMapStudioDocument();
    const migrated = migrateMapStudioDocument({
        ...current,
        schemaVersion: 2,
        views: current.views.map((view) => ({
            ...view,
            design: {
                ...view.design,
                pins: { style: 'numbered', size: 'large' },
            },
        })),
    });

    assert.equal(migrated.schemaVersion, MAP_STUDIO_SCHEMA_VERSION);
    assert.deepEqual(migrated.views[0].design.pins, {
        style: 'numbered',
        size: 'large',
        categoryShapes: {},
    });
});

test('numbered pin shapes are persisted per named view and reach Export View', () => {
    const document = createMapStudioDocument();
    const session = createMapStudioSession(document, { mode: MAP_STUDIO_MODE_DESIGN });
    const drafted = patchMapStudioDraft(session, {
        pins: {
            style: MAP_STUDIO_PIN_STYLE_NUMBERED,
            categoryShapes: {
                'active ageing centre (aac)': 'star',
                'senior care centre (scc)': 'square',
            },
        },
    });
    const saved = saveMapStudioView(document, drafted);
    const printState = buildMapStudioPrintState(saved.document.views[0].design);

    assert.deepEqual(saved.document.views[0].design.pins.categoryShapes, {
        'active ageing centre (aac)': 'star',
        'senior care centre (scc)': 'square',
    });
    assert.deepEqual(printState.numberedPinShapesByCategory, {
        'active ageing centre (aac)': 'star',
        'senior care centre (scc)': 'square',
    });
});

test('category icon Studio identity reaches the dedicated export marker renderer', () => {
    const design = createMapStudioDesign();
    design.pins.style = MAP_STUDIO_PIN_STYLE_CATEGORY_ICON;
    assert.equal(buildMapStudioPrintState(design).studioMarkerMode, 'category-icon');
});
