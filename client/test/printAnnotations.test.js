import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    advancePrintAnnotationDraft,
    buildPrintAnnotationDraftPreviewPoints,
    buildPrintAnnotationRectanglePoints,
    buildRoundedPrintAnnotationPolygon,
    createPrintAnnotation,
    DEFAULT_PRINT_ANNOTATION_STYLE,
    duplicatePrintAnnotation,
    getAnnotationLocalDraftKey,
    getPrintAnnotationPointBoundsCenter,
    getPrintAnnotationCaptureKey,
    isPrintAnnotationRotationSupported,
    movePrintAnnotationRectangleControlPoint,
    movePrintAnnotationControlPoint,
    normalizePrintAnnotation,
    normalizePrintAnnotations,
    PRINT_ANNOTATION_MAX_CONTROL_POINTS,
    rotatePrintAnnotationPoints,
    translatePrintAnnotationPoints,
} from '../src/lib/printAnnotations.js';

const printAnnotationsHookSource = fs.readFileSync(
    new URL('../src/hooks/usePrintAnnotations.js', import.meta.url),
    'utf8',
);

const POLYGON_POINTS = [
    [1.381, 103.741],
    [1.384, 103.746],
    [1.379, 103.749],
];

function createBoundaryPoints(count) {
    return Array.from({ length: count }, (unused, index) => [
        1.3 + (index * 0.000001),
        103.7 + (index * 0.000001),
    ]);
}

test('print annotation normalization supports pins, lines, area shapes, and control-anchor polygons', () => {
    const polygon = createPrintAnnotation({
        type: 'polygon',
        points: POLYGON_POINTS,
        text: 'Walking area',
    });
    const circle = createPrintAnnotation({
        type: 'circle',
        points: POLYGON_POINTS.slice(0, 2),
        text: 'Meeting zone',
    });
    const line = createPrintAnnotation({
        type: 'line',
        points: POLYGON_POINTS.slice(0, 2),
    });
    assert.equal(polygon.type, 'polygon');
    assert.deepEqual(polygon.controlPoints, POLYGON_POINTS);
    assert.equal(circle.type, 'circle');
    assert.equal(line.type, 'line');
    assert.equal(normalizePrintAnnotation({
        id: 'retired_text',
        type: 'text',
        points: [POLYGON_POINTS[0]],
        text: 'Retired',
    }), null);
    assert.equal(normalizePrintAnnotation({
        id: 'retired_arrow',
        type: 'arrow',
        points: POLYGON_POINTS.slice(0, 2),
    }), null);
    assert.equal(normalizePrintAnnotation({
        id: 'legacy_lasso',
        type: 'lasso',
        points: POLYGON_POINTS,
    }), null);
    assert.equal(normalizePrintAnnotation({
        id: 'short_polygon',
        type: 'polygon',
        points: POLYGON_POINTS.slice(0, 2),
    }), null);
});

test('annotation persistence exposes a verified flush for frozen share publication', () => {
    assert.match(
        printAnnotationsHookSource,
        /const flushPendingChanges = useCallback\(async \(\) => \{[\s\S]*await saveNow\(\);[\s\S]*return !dirtyRef\.current;/,
    );
    assert.match(printAnnotationsHookSource, /flushPendingChanges,/);
});

test('annotation control-point moves preserve the latest geometry and translate circle centres', () => {
    const firstPolygonMove = movePrintAnnotationControlPoint(
        'polygon',
        POLYGON_POINTS,
        0,
        [1.382, 103.742],
    );
    const secondPolygonMove = movePrintAnnotationControlPoint(
        'polygon',
        firstPolygonMove,
        1,
        [1.385, 103.747],
    );

    assert.deepEqual(secondPolygonMove, [
        [1.382, 103.742],
        [1.385, 103.747],
        POLYGON_POINTS[2],
    ]);

    assert.deepEqual(movePrintAnnotationControlPoint(
        'circle',
        [[1.38, 103.74], [1.381, 103.742]],
        0,
        [1.382, 103.743],
    ), [
        [1.382, 103.743],
        [1.383, 103.745],
    ]);
});

test('whole-annotation transforms translate every point and rotate supported geometry and shape text', () => {
    const square = [
        [1, 103],
        [1, 104],
        [2, 104],
        [2, 103],
    ];
    assert.deepEqual(getPrintAnnotationPointBoundsCenter(square), [1.5, 103.5]);
    assert.deepEqual(translatePrintAnnotationPoints(
        square,
        [1.5, 103.5],
        [1.75, 103.25],
    ), [
        [1.25, 102.75],
        [1.25, 103.75],
        [2.25, 103.75],
        [2.25, 102.75],
    ]);

    const rotatedLine = rotatePrintAnnotationPoints(
        [[1.5, 103], [1.5, 104]],
        [1.5, 103.5],
        90,
    );
    assert.ok(Math.abs(rotatedLine[0][0] - 1) < 1e-12);
    assert.ok(Math.abs(rotatedLine[0][1] - 103.5) < 1e-12);
    assert.ok(Math.abs(rotatedLine[1][0] - 2) < 1e-12);
    assert.ok(Math.abs(rotatedLine[1][1] - 103.5) < 1e-12);
    assert.equal(isPrintAnnotationRotationSupported('line'), true);
    assert.equal(isPrintAnnotationRotationSupported('polygon'), true);
    assert.equal(isPrintAnnotationRotationSupported('rectangle'), true);
    assert.equal(isPrintAnnotationRotationSupported('circle'), true);
    assert.equal(isPrintAnnotationRotationSupported('pin'), false);

    const rotatedRectangle = buildPrintAnnotationRectanglePoints(
        [[1, 103], [2, 104]],
        90,
    );
    assert.equal(rotatedRectangle.length, 4);
    assert.ok(Math.abs(rotatedRectangle[0][0] - 1) < 1e-12);
    assert.ok(Math.abs(rotatedRectangle[0][1] - 104) < 1e-12);
    assert.ok(Math.abs(rotatedRectangle[2][0] - 2) < 1e-12);
    assert.ok(Math.abs(rotatedRectangle[2][1] - 103) < 1e-12);

    const adjustedRectangle = movePrintAnnotationRectangleControlPoint(
        [[1, 103], [2, 104]],
        0,
        [1, 104],
        90,
    );
    const adjustedDisplayPoints = buildPrintAnnotationRectanglePoints(
        adjustedRectangle,
        90,
    );
    assert.ok(Math.abs(adjustedDisplayPoints[0][0] - 1) < 1e-12);
    assert.ok(Math.abs(adjustedDisplayPoints[0][1] - 104) < 1e-12);
    assert.ok(Math.abs(adjustedDisplayPoints[2][0] - 2) < 1e-12);
    assert.ok(Math.abs(adjustedDisplayPoints[2][1] - 103) < 1e-12);
});

test('shape rotation is normalized, persisted only for supported area shapes, and duplicated', () => {
    const source = normalizePrintAnnotation({
        id: 'annotation_rotated_box',
        type: 'rectangle',
        points: POLYGON_POINTS.slice(0, 2),
        rotationDegrees: 450,
        text: 'Rotated box',
        style: DEFAULT_PRINT_ANNOTATION_STYLE,
    });
    const circle = normalizePrintAnnotation({
        id: 'annotation_rotated_circle',
        type: 'circle',
        points: POLYGON_POINTS.slice(0, 2),
        rotationDegrees: -45,
        text: 'Rotated note',
        style: DEFAULT_PRINT_ANNOTATION_STYLE,
    });
    const line = normalizePrintAnnotation({
        id: 'annotation_line_rotation_ignored',
        type: 'line',
        points: POLYGON_POINTS.slice(0, 2),
        rotationDegrees: 30,
        style: DEFAULT_PRINT_ANNOTATION_STYLE,
    });
    const duplicate = duplicatePrintAnnotation(source, {
        id: 'annotation_rotated_box_copy',
    });

    assert.equal(source.rotationDegrees, 90);
    assert.equal(circle.rotationDegrees, -45);
    assert.equal(Object.hasOwn(line, 'rotationDegrees'), false);
    assert.equal(duplicate.rotationDegrees, 90);
    assert.equal(duplicate.isShared, false);
});

test('annotation duplication preserves content, offsets geometry, and creates a new id', () => {
    const source = normalizePrintAnnotation({
        id: 'annotation_source',
        type: 'polygon',
        points: POLYGON_POINTS,
        controlPoints: POLYGON_POINTS,
        text: 'Walking area',
        style: DEFAULT_PRINT_ANNOTATION_STYLE,
    });
    const duplicate = duplicatePrintAnnotation(source, {
        id: 'annotation_copy',
        offset: [0.001, -0.002],
    });

    assert.equal(duplicate.id, 'annotation_copy');
    assert.equal(duplicate.type, source.type);
    assert.equal(duplicate.text, source.text);
    assert.deepEqual(duplicate.style, source.style);
    assert.deepEqual(duplicate.points, POLYGON_POINTS.map(([lat, lng]) => (
        [lat + 0.001, lng - 0.002]
    )));
    assert.deepEqual(duplicate.controlPoints, duplicate.points);
    assert.notEqual(duplicate, source);
});

test('two-point drawing completes on the second click while polygon drafts stay open', () => {
    const start = [1.38, 103.74];
    const end = [1.382, 103.745];
    const firstLineClick = advancePrintAnnotationDraft('line', [], start);
    const secondLineClick = advancePrintAnnotationDraft('line', firstLineClick.points, end);

    assert.deepEqual(firstLineClick, {
        completed: false,
        points: [start],
    });
    assert.deepEqual(secondLineClick, {
        completed: true,
        points: [start, end],
    });

    const polygonClick = advancePrintAnnotationDraft('polygon', POLYGON_POINTS.slice(0, 2), end);
    assert.equal(polygonClick.completed, false);
    assert.deepEqual(polygonClick.points, [...POLYGON_POINTS.slice(0, 2), end]);
});

test('draft preview geometry follows the pointer without persisting it', () => {
    const start = [1.38, 103.74];
    const cursor = [1.382, 103.745];

    assert.deepEqual(buildPrintAnnotationDraftPreviewPoints('rectangle', [start], cursor), [
        start,
        cursor,
    ]);
    assert.deepEqual(buildPrintAnnotationDraftPreviewPoints(
        'polygon',
        POLYGON_POINTS.slice(0, 2),
        cursor,
    ), [
        ...POLYGON_POINTS.slice(0, 2),
        cursor,
    ]);
    assert.deepEqual(buildPrintAnnotationDraftPreviewPoints('line', [start], null), [start]);
});

test('new annotation lines default to solid while dashed remains optional', () => {
    const solidLine = createPrintAnnotation({
        type: 'line',
        points: POLYGON_POINTS.slice(0, 2),
    });
    const dashedLine = createPrintAnnotation({
        type: 'line',
        points: POLYGON_POINTS.slice(0, 2),
        style: {
            ...DEFAULT_PRINT_ANNOTATION_STYLE,
            dashed: true,
        },
    });

    assert.equal(DEFAULT_PRINT_ANNOTATION_STYLE.dashed, false);
    assert.equal(solidLine.style.dashed, false);
    assert.equal(dashedLine.style.dashed, true);
});

test('normalization restores polygon control anchors and drops retired refinement metadata', () => {
    const annotation = normalizePrintAnnotation({
        id: 'legacy_refined_boundary',
        type: 'polygon',
        points: [
            POLYGON_POINTS[0],
            [1.382, 103.743],
            POLYGON_POINTS[1],
            POLYGON_POINTS[2],
        ],
        controlPoints: POLYGON_POINTS,
        text: 'Walking boundary',
        style: {},
        refinement: {
            kind: 'road_centerline',
            provider: 'legacy-provider',
            sourceVersion: '2026-07',
            refinedAt: '2026-07-26T08:00:00.000Z',
            snapDistanceMeters: 25,
        },
    });

    assert.deepEqual(annotation.points, POLYGON_POINTS);
    assert.deepEqual(annotation.controlPoints, POLYGON_POINTS);
    assert.equal(Object.hasOwn(annotation, 'refinement'), false);
});

test('normalization preserves up to two hundred polygon control anchors', () => {
    const exactLimitPoints = createBoundaryPoints(PRINT_ANNOTATION_MAX_CONTROL_POINTS);
    const overLimitPoints = createBoundaryPoints(PRINT_ANNOTATION_MAX_CONTROL_POINTS + 1);
    const exactLimit = createPrintAnnotation({
        type: 'polygon',
        points: exactLimitPoints,
    });
    const overLimit = createPrintAnnotation({
        type: 'polygon',
        points: overLimitPoints,
    });

    assert.equal(PRINT_ANNOTATION_MAX_CONTROL_POINTS, 200);
    assert.equal(exactLimit.points.length, 200);
    assert.equal(exactLimit.controlPoints.length, 200);
    assert.equal(overLimit.points.length, 200);
    assert.equal(overLimit.controlPoints.length, 200);
});

test('polygon corner rounding remains bounded with the larger control-point limit', () => {
    const rounded = buildRoundedPrintAnnotationPolygon(createBoundaryPoints(PRINT_ANNOTATION_MAX_CONTROL_POINTS));

    assert.ok(rounded.length <= 500);
    assert.ok(rounded.length >= PRINT_ANNOTATION_MAX_CONTROL_POINTS);
});

test('normalization bounds shape typography and drops retired label layout', () => {
    const polygon = createPrintAnnotation({
        type: 'polygon',
        points: POLYGON_POINTS,
        text: 'Walking area',
        style: {
            textColor: '#123456',
            fontSize: 99,
        },
    });
    const pin = createPrintAnnotation({
        type: 'pin',
        points: [POLYGON_POINTS[0]],
        text: 'Pickup',
        style: {
            textColor: '#abcdef',
            fontSize: 18,
        },
    });

    assert.equal(polygon.style.textColor, '#123456');
    assert.equal(polygon.style.fontSize, 32);
    assert.equal(Object.hasOwn(polygon, 'layout'), false);
    assert.equal(pin.style.textColor, '#ABCDEF');
    assert.equal(pin.style.fontSize, 18);
    assert.equal(Object.hasOwn(pin, 'layout'), false);
});

test('polygon corner rounding is render-only, bounded, and deterministic', () => {
    const square = [
        [1, 103],
        [1, 104],
        [2, 104],
        [2, 103],
    ];
    const original = structuredClone(square);
    const rounded = buildRoundedPrintAnnotationPolygon(square);

    assert.deepEqual(square, original);
    assert.equal(rounded.length, 20);
    assert.deepEqual(rounded, buildRoundedPrintAnnotationPolygon(square));
    assert.ok(rounded.every(([lat, lng]) => (
        lat >= 1 && lat <= 2 && lng >= 103 && lng <= 104
    )));
    assert.ok(square.every((corner) => (
        !rounded.some((point) => point[0] === corner[0] && point[1] === corner[1])
    )));
});

test('annotation capture and local draft keys are stable and owner scoped', () => {
    const annotation = createPrintAnnotation({
        type: 'line',
        points: POLYGON_POINTS.slice(0, 2),
    });
    assert.equal(
        getPrintAnnotationCaptureKey([annotation]),
        getPrintAnnotationCaptureKey(normalizePrintAnnotations([annotation])),
    );
    assert.equal(
        getPrintAnnotationCaptureKey([{ ...annotation, isShared: true }]),
        getPrintAnnotationCaptureKey([{ ...annotation, isShared: false }]),
    );
    assert.equal(getAnnotationLocalDraftKey(7, 258), 'carearound:print-annotations:7:258');
    assert.equal(getAnnotationLocalDraftKey('guest', 258), '');
});

test('owner Print View wires desktop-only editing, private persistence, and export parity', () => {
    const ownerSource = fs.readFileSync(
        new URL('../src/pages/MyMapDetailPage.jsx', import.meta.url),
        'utf8',
    );
    const printSource = fs.readFileSync(
        new URL('../src/components/DirectoryPrintView.jsx', import.meta.url),
        'utf8',
    );
    const exportSource = fs.readFileSync(
        new URL('../src/components/MapImageExportButton.jsx', import.meta.url),
        'utf8',
    );
    const sharedSource = fs.readFileSync(
        new URL('../src/pages/SharedMapPage.jsx', import.meta.url),
        'utf8',
    );
    const layerSource = fs.readFileSync(
        new URL('../src/components/PrintAnnotationLayer.jsx', import.meta.url),
        'utf8',
    );
    const toolbarSource = fs.readFileSync(
        new URL('../src/components/PrintAnnotationToolbar.jsx', import.meta.url),
        'utf8',
    );
    const transformSource = fs.readFileSync(
        new URL('../src/components/PrintAnnotationTransformHandle.jsx', import.meta.url),
        'utf8',
    );

    assert.match(
        ownerSource,
        /const canEditPrintAnnotations = useMediaQuery\(\s*'\(hover: hover\) and \(pointer: fine\)'/,
    );
    assert.doesNotMatch(
        ownerSource,
        /const canEditPrintAnnotations = useMediaQuery\(\s*'\(min-width: 1024px\)/,
    );
    assert.match(ownerSource, /data-print-annotation-trigger="true"/);
    assert.match(ownerSource, /data-print-annotation-full-map-only="true"/);
    assert.match(ownerSource, /data-print-annotation-auto-full-map="true"/);
    assert.match(ownerSource, /isFullMapPrintLayout/);
    assert.match(ownerSource, /layoutPreset: PRINT_MAP_LAYOUT_FULL/);
    assert.match(ownerSource, /import PrintAnnotationLayer from '\.\.\/components\/PrintAnnotationLayer\.jsx'/);
    assert.match(ownerSource, /enabled: Boolean\(mapId && user\?\.id\)/);
    assert.match(ownerSource, /restoreLocalDraft: true/);
    assert.match(ownerSource, /autosave: isPrintView \|\| interactiveAnnotationEditorOpen/);
    assert.match(ownerSource, /useInteractiveMapAnnotationEditor/);
    assert.match(ownerSource, /mapSurfaceOverlay=\{interactiveAnnotationEditor\.surfaceOverlay\}/);
    assert.match(ownerSource, /ownerInteractiveAnnotationOverlay/);
    assert.match(ownerSource, /editable=\{false\}/);
    assert.match(ownerSource, /mapOverlay=\{ownerInteractiveAnnotationOverlay\}/);
    assert.match(ownerSource, /printAnnotations\.reload\(\)/);
    assert.match(ownerSource, /printAnnotations=\{printAnnotations\.annotations\}/);
    assert.match(printSource, /<PrintAnnotationLayer/);
    assert.match(printSource, /annotationEditing/);
    assert.match(printSource, /const annotationsVisibleForLayout = useV2OwnerPrint/);
    assert.match(
        printSource,
        /const annotationsEditableForLayout = annotationsVisibleForLayout[\s\S]*PRINT_MAP_LAYOUT_FULL/,
    );
    assert.match(printSource, /visiblePrintAnnotations = annotationsVisibleForLayout/);
    assert.match(printSource, /printAnnotations=\{annotationsVisibleForLayout \? printAnnotations : \[\]\}/);
    assert.match(printSource, /annotationEditing=\{annotationsEditableForLayout/);
    assert.doesNotMatch(
        printSource,
        /visiblePrintAnnotations = annotationsEditableForLayout/,
    );
    assert.match(printSource, /PRINT_MAP_LAYOUT_FULL/);
    assert.match(exportSource, /getPrintAnnotationCaptureKey/);
    assert.match(exportSource, /printAnnotations=\{preparedPrintAnnotations\}/);
    assert.match(layerSource, /data-annotation-shape-text/);
    assert.match(layerSource, /buildRoundedPrintAnnotationPolygon/);
    assert.match(layerSource, /PRINT_ANNOTATION_TOOL_CIRCLE/);
    assert.match(layerSource, /PRINT_ANNOTATION_TOOL_LINE/);
    assert.match(layerSource, /dragstart:/);
    assert.match(layerSource, /drag: \(event\) =>/);
    assert.match(layerSource, /window\.requestAnimationFrame/);
    assert.match(layerSource, /shapeRef\.current\?\.setLatLngs/);
    assert.match(layerSource, /latestEditablePointsRef/);
    assert.match(layerSource, /iconSize: \[44, 44\]/);
    assert.match(layerSource, /map\.on\('mousemove', handleMouseMove\)/);
    assert.match(layerSource, /advancePrintAnnotationDraft/);
    assert.match(layerSource, /draftPreviewPoint/);
    assert.match(layerSource, /previewPoint=\{draftPreviewPoint\}/);
    assert.match(layerSource, /event\.key === 'Enter'/);
    assert.match(layerSource, /PrintAnnotationTransformHandle/);
    assert.match(transformSource, /data-annotation-transform-handle/);
    assert.match(transformSource, /<svg/);
    assert.match(transformSource, /stroke-linecap="round"/);
    assert.doesNotMatch(transformSource, /&#8635;|&#10021;/);
    assert.match(transformSource, /translatePrintAnnotationPoints/);
    assert.match(transformSource, /rotatePrintAnnotationPoints/);
    assert.match(transformSource, /rotationDegrees/);
    assert.match(transformSource, /iconSize: \[44, 44\]/);
    assert.match(layerSource, /PRINT_ANNOTATION_TRANSFORM_TOOLS\.has\(tool\)/);
    assert.match(layerSource, /PRINT_ANNOTATION_DRAW_TOOLS\.has\(tool\)/);
    assert.equal((layerSource.match(/interactive=\{annotationInteractionEnabled\}/g) || []).length, 2);
    assert.match(layerSource, /dashArray: style\.dashed \? '9 7' : null/);
    assert.doesNotMatch(layerSource, /dashArray: '7 6'/);
    assert.match(toolbarSource, /Undo last point/);
    assert.match(toolbarSource, /Done drawing/);
    assert.match(toolbarSource, /Cancel tool/);
    assert.match(toolbarSource, /function FreeformBoundaryIcon/);
    assert.match(
        toolbarSource,
        /PRINT_ANNOTATION_TOOL_POLYGON, label: 'Draw boundary', Icon: FreeformBoundaryIcon/,
    );
    assert.match(toolbarSource, /FreeformBoundaryIcon[\s\S]*fill="currentColor"/);
    assert.doesNotMatch(toolbarSource, /\bPentagon\b/);
    assert.match(toolbarSource, /data-print-annotation-helper/);
    assert.match(toolbarSource, /Step 1 of 2/);
    assert.match(toolbarSource, /Move the pointer to preview/);
    assert.match(toolbarSource, /press Enter/);
    assert.match(toolbarSource, /Drag the highlighted control points/);
    assert.match(toolbarSource, /label: 'Move annotation'/);
    assert.match(toolbarSource, /label: 'Rotate annotation'/);
    assert.doesNotMatch(
        toolbarSource,
        /\{ value: PRINT_ANNOTATION_TOOL_PIN, label: 'Label pin'/,
    );
    assert.match(toolbarSource, /selectedAnnotation\.type === PRINT_ANNOTATION_TOOL_PIN/);
    assert.match(layerSource, /function PinAnnotation/);
    assert.match(toolbarSource, /Duplicate annotation/);
    assert.match(toolbarSource, /Share this annotation/);
    assert.match(toolbarSource, /public only after you update the shared link/);
    assert.match(toolbarSource, /Drag the highlighted centre handle/);
    assert.match(toolbarSource, /circle outline stays unchanged/);
    assert.match(layerSource, /buildPrintAnnotationRectanglePoints/);
    assert.match(layerSource, /transform:rotate\(\$\{-rotationDegrees\}deg\)/);
    assert.match(toolbarSource, /max-h-\[calc\(100%-1\.5rem\)\]/);
    assert.match(toolbarSource, /Choose custom shape colour/);
    assert.match(toolbarSource, /aria-label="Shape colour picker"/);
    assert.match(toolbarSource, /data-print-annotation-shape-color-picker="true"/);
    assert.match(toolbarSource, /\{activeStyle\.color\}/);
    assert.match(toolbarSource, /Text colour/);
    assert.match(toolbarSource, /Font size/);
    assert.match(toolbarSource, /Bring forward/);
    assert.match(toolbarSource, /Send backward/);
    assert.match(printSource, /undoLastAnnotationDraftPoint/);
    assert.match(printSource, /setAnnotationDraftPoints\(\(current\) => current\.slice\(0, -1\)\)/);
    assert.match(printSource, /handleMoveSelectedAnnotation/);
    assert.match(printSource, /handleDuplicateSelectedAnnotation/);
    assert.doesNotMatch(
        toolbarSource,
        /label: 'Text callout'|label: 'Arrow'|PRINT_ANNOTATION_TOOL_TEXT|PRINT_ANNOTATION_TOOL_ARROW/,
    );
    assert.doesNotMatch(layerSource, /ResizableLabelMarker|data-annotation-resize/);
    assert.doesNotMatch(layerSource, /Road geometry|openstreetmap-overpass/);
    assert.doesNotMatch(toolbarSource, /Snap to roads|Road alignment|snapDistanceMeters/);
    assert.doesNotMatch(printSource, /refineBoundaryToRoadCenterlines|onRefineRoadBoundary/);
    assert.doesNotMatch(sharedSource, /PrintAnnotationLayer|printAnnotations/);
});

test('annotation autosaves are serialized to preserve revision order', () => {
    const hookSource = fs.readFileSync(
        new URL('../src/hooks/usePrintAnnotations.js', import.meta.url),
        'utf8',
    );

    assert.match(hookSource, /saveQueueRef = useRef\(Promise\.resolve\(null\)\)/);
    assert.match(hookSource, /const queuedSave = saveQueueRef\.current\.then/);
    assert.match(hookSource, /saveQueueRef\.current = queuedSave\.catch/);
    assert.match(hookSource, /LOCAL_DRAFT_DELAY_MS = 180/);
    assert.match(hookSource, /restoreLocalDraft = true/);
    assert.match(hookSource, /autosave = true/);
    assert.match(hookSource, /restoreLocalDraft \? readLocalDraft\(storageKey\) : null/);
    assert.match(hookSource, /status !== 'unsaved' \|\| !enabled \|\| !autosave/);
    assert.doesNotMatch(hookSource, /refineRoadBoundary|snapDistanceMeters/);
});
