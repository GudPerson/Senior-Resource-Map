import { useCallback, useEffect, useMemo, useState } from 'react';

import PrintAnnotationLayer from '../components/PrintAnnotationLayer.jsx';
import PrintAnnotationToolbar from '../components/PrintAnnotationToolbar.jsx';
import AnnotationImageUpload from '../components/AnnotationImageUpload.jsx';
import AnnotationResourcePicker from '../components/AnnotationResourcePicker.jsx';
import KmlBoundaryImport from '../components/KmlBoundaryImport.jsx';
import BoundaryLibraryPicker from '../components/boundaries/BoundaryLibraryPicker.jsx';
import BoundaryLibrarySaveDialog from '../components/boundaries/BoundaryLibrarySaveDialog.jsx';
import { assertBoundaryDrawingBatchCapacity } from '../../../shared/boundaryDrawing.js';
import { createBoundaryImportOperation } from '../lib/boundaryLibraryImport.js';
import TemporaryMapMeasurementLayer from '../components/TemporaryMapMeasurementLayer.jsx';
import { AnnotationToolModeControls, TemporaryMapMeasurementControls } from '../components/AnnotationToolModeControls.jsx';
import useTemporaryMapMeasurement from './useTemporaryMapMeasurement.js';
import { appendKmlBoundaries } from '../lib/kmlBoundaries.js';
import { getAnnotationResourceLinkBudget } from '../lib/annotationResourceLinks.js';
import {
    DEFAULT_PRINT_ANNOTATION_STYLE,
    PRINT_ANNOTATION_DRAW_TOOLS,
    PRINT_ANNOTATION_TRANSFORM_TOOLS,
    PRINT_ANNOTATION_TOOL_PIN,
    PRINT_ANNOTATION_TOOL_POLYGON,
    PRINT_ANNOTATION_TOOL_RECTANGLE,
    PRINT_ANNOTATION_TOOL_CIRCLE,
    PRINT_ANNOTATION_TOOL_SELECT,
    PRINT_ANNOTATION_MAX_COUNT,
    createPrintAnnotation,
    createPrintAnnotationId,
    canAddPrintAnnotation,
    duplicatePrintAnnotation,
    getPrintAnnotationMinimumPointCount,
    normalizePrintAnnotationStyle,
} from '../lib/printAnnotations.js';

export default function useInteractiveMapAnnotationEditor({
    mapId = null,
    directory = null,
    privateImageSources = {},
    enabled = false,
    annotations = [],
    visibleAnnotationIds = null,
    status = 'idle',
    error = '',
    replaceAnnotations = null,
    saveNow = null,
    undo = null,
    redo = null,
    canUndo = false,
    canRedo = false,
    onClose = null,
    toolbarInInspector = false,
    temporaryMeasurementEnabled = false,
    measurementScopeKey = '',
    onFindWithinArea = null,
    boundaryLibraryEnabled = false,
    boundaryWorkflowSession = null,
    ownerKey = null,
    savedRevision = null,
    flushPendingChanges = null,
} = {}) {
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [librarySelectedIds, setLibrarySelectedIds] = useState([]);
    const [libraryImportError, setLibraryImportError] = useState('');
    const [libraryImportPending, setLibraryImportPending] = useState(false);
    const [saveLibraryOpen, setSaveLibraryOpen] = useState(false);
    const [saveLibraryVersion, setSaveLibraryVersion] = useState(0);
    const libraryContext = useMemo(() => ({ scope: null, operation: null, saveSessions: new Map(), active: true, annotations: [], generation: 0 }), []);
    const boundarySessionToken = boundaryWorkflowSession?.capture();
    const libraryScope = `${ownerKey || ''}:${mapId || ''}:${boundaryWorkflowSession?.generation || 0}`;
    if (libraryContext.scope !== libraryScope) {
        libraryContext.scope = libraryScope; libraryContext.generation++; libraryContext.operation = null; libraryContext.saveSessions.clear();
    }
    libraryContext.active = enabled && boundaryLibraryEnabled && !boundaryWorkflowSession?.loggingOut;
    libraryContext.annotations = annotations;
    const libraryGeneration = libraryContext.generation;
    const currentLibraryScope = () => libraryContext.scope === libraryScope && libraryContext.generation === libraryGeneration && libraryContext.active && (!boundaryWorkflowSession || boundaryWorkflowSession.isCurrent(boundarySessionToken));
    useEffect(() => {
        setLibraryOpen(false); setSaveLibraryOpen(false);setLibrarySelectedIds([]);
        setLibraryImportPending(false);setLibraryImportError('');
    }, [libraryScope, enabled]);
    useEffect(() => { libraryContext.active = enabled && boundaryLibraryEnabled && !boundaryWorkflowSession?.loggingOut; return () => { libraryContext.active = false; }; }, [libraryContext, enabled, boundaryLibraryEnabled]);
    const [tool, setTool] = useState(PRINT_ANNOTATION_TOOL_SELECT);
    const [selectedId, setSelectedId] = useState(null);
    const [draftPoints, setDraftPoints] = useState([]);
    const [draftText, setDraftText] = useState('');
    const [draftStyle, setDraftStyle] = useState(DEFAULT_PRINT_ANNOTATION_STYLE);
    const [draftImage, setDraftImage] = useState(null);
    const [measuring, setMeasuring] = useState(false);
    const measurementActive = enabled && temporaryMeasurementEnabled && measuring;
    const temporaryMeasurement = useTemporaryMapMeasurement({ enabled: measurementActive, mapId, scopeKey: measurementScopeKey });
    const clearTemporaryMeasurement = temporaryMeasurement.clear;
    // Keep the full document for persistence, history and capacity. Only the
    // rendered/selectable projection follows the active view. Newly created or
    // imported items stay usable until this editing session/view ends, even if
    // the saved annotation layer is globally hidden.
    const visibilitySession = useMemo(() => ({ createdIds: new Set() }), [enabled, mapId, ownerKey, measurementScopeKey]);
    const editorAnnotations = useMemo(() => {
        if (visibleAnnotationIds === null) return annotations;
        const visibleIds = new Set(visibleAnnotationIds);
        return annotations.filter(annotation => visibleIds.has(annotation.id) || visibilitySession.createdIds.has(annotation.id));
    }, [annotations, visibilitySession, visibleAnnotationIds]);
    const editableIds = useMemo(() => new Set(editorAnnotations.map(annotation => annotation.id)), [editorAnnotations]);
    const replaceEditorAnnotations = useCallback((nextValue) => {
        replaceAnnotations?.((current) => {
            const next = typeof nextValue === 'function' ? nextValue(current) : nextValue;
            const currentIds = new Set(current.map(annotation => annotation.id));
            next.forEach(annotation => {
                if (!currentIds.has(annotation.id)) visibilitySession.createdIds.add(annotation.id);
            });
            return next;
        });
    }, [replaceAnnotations, visibilitySession]);
    const selectedAnnotation = useMemo(() => (
        editorAnnotations.find((annotation) => annotation.id === selectedId) || null
    ), [editorAnnotations, selectedId]);
    const selectedIndex = selectedAnnotation ? annotations.findIndex((annotation) => annotation.id === selectedId) : -1;

    useEffect(() => {
        if (selectedId && !editableIds.has(selectedId)) setSelectedId(null);
    }, [editableIds, selectedId]);

    useEffect(() => {
        if (enabled) return;
        setTool(PRINT_ANNOTATION_TOOL_SELECT);
        setSelectedId(null);
        setDraftPoints([]);
        setDraftImage(null);
    }, [enabled]);

    useEffect(() => {
        setSelectedId(null);
        setDraftImage(null);
        setDraftPoints([]);
        setTool(PRINT_ANNOTATION_TOOL_SELECT);
    }, [mapId]);

    useEffect(() => {
        if (!enabled || !temporaryMeasurementEnabled) setMeasuring(false);
    }, [enabled, temporaryMeasurementEnabled]);

    const cancelDraft = useCallback(() => {
        setDraftPoints([]);
        setDraftImage(null);
        setTool(PRINT_ANNOTATION_TOOL_SELECT);
        setMeasuring(false);
        clearTemporaryMeasurement();
    }, [clearTemporaryMeasurement]);

    const handleToolChange = useCallback((nextTool) => {
        if (PRINT_ANNOTATION_DRAW_TOOLS.has(nextTool) && !canAddPrintAnnotation(annotations, nextTool)) return;
        setTool(nextTool);
        if (PRINT_ANNOTATION_DRAW_TOOLS.has(nextTool)) setSelectedId(null);
        setDraftPoints([]);
        if (nextTool !== 'image') setDraftImage(null);
    }, [annotations]);

    const handleCreate = useCallback((type, points) => {
        if (!canAddPrintAnnotation(annotations, type)) return;
        const annotation = createPrintAnnotation({
            type,
            points,
            text: [
                PRINT_ANNOTATION_TOOL_PIN,
                PRINT_ANNOTATION_TOOL_RECTANGLE,
                PRINT_ANNOTATION_TOOL_CIRCLE,
                PRINT_ANNOTATION_TOOL_POLYGON,
            ].includes(type) ? draftText : '',
            style: draftStyle,
            ...(type === 'image' && draftImage ? { image: draftImage } : {}),
        });
        if (!annotation) return;
        replaceEditorAnnotations((current) => (
            canAddPrintAnnotation(current, type) ? [...current, annotation] : current
        ));
        setSelectedId(annotation.id);
        setTool(PRINT_ANNOTATION_TOOL_SELECT);
        setDraftPoints([]);
        if (type === 'image') setDraftImage(null);
    }, [annotations, draftImage, draftStyle, draftText, replaceEditorAnnotations]);

    const handleUpdate = useCallback((annotationId, patch) => {
        if (!editableIds.has(annotationId)) return;
        replaceEditorAnnotations((current) => current.map((annotation) => (
            annotation.id === annotationId
                ? {
                    ...annotation,
                    ...patch,
                    ...(patch.style ? {
                        style: normalizePrintAnnotationStyle({
                            ...annotation.style,
                            ...patch.style,
                        }, { boundary: annotation.boundarySource === 'kml' }),
                    } : {}),
                }
                : annotation
        )));
    }, [editableIds, replaceEditorAnnotations]);

    const handleSelectedChange = useCallback((patch) => {
        if (!selectedAnnotation) return;
        if (
            selectedAnnotation?.type === PRINT_ANNOTATION_TOOL_PIN
            && Object.hasOwn(patch, 'text')
            && !String(patch.text || '').trim()
        ) return;
        handleUpdate(selectedId, patch);
    }, [handleUpdate, selectedAnnotation, selectedId]);

    const handleDelete = useCallback(() => {
        if (!selectedAnnotation) return;
        replaceEditorAnnotations((current) => current.filter(
            (annotation) => annotation.id !== selectedId,
        ));
        setSelectedId(null);
    }, [replaceEditorAnnotations, selectedAnnotation, selectedId]);

    const handleDuplicate = useCallback(() => {
        if (!selectedAnnotation || !canAddPrintAnnotation(annotations, selectedAnnotation.type, selectedAnnotation.resourceLinks)) return;
        const duplicate = duplicatePrintAnnotation(selectedAnnotation);
        if (!duplicate) return;
        replaceEditorAnnotations((current) => {
            if (!canAddPrintAnnotation(current, selectedAnnotation.type, selectedAnnotation.resourceLinks)) return current;
            const sourceIndex = current.findIndex((annotation) => annotation.id === selectedAnnotation.id);
            if (sourceIndex < 0) return current;
            const next = [...current];
            next.splice(sourceIndex + 1, 0, duplicate);
            return next;
        });
        setSelectedId(duplicate.id);
    }, [annotations, replaceEditorAnnotations, selectedAnnotation]);

    const handleFinish = useCallback(() => {
        const minimumPointCount = getPrintAnnotationMinimumPointCount(tool);
        if (!minimumPointCount || draftPoints.length < minimumPointCount) return;
        handleCreate(tool, draftPoints);
    }, [draftPoints, handleCreate, tool]);

    const handleMove = useCallback((direction) => {
        if (!selectedAnnotation) return;
        replaceEditorAnnotations((current) => {
            const currentIndex = current.findIndex((annotation) => annotation.id === selectedId);
            if (currentIndex < 0) return current;
            const nextIndex = direction === 'forward'
                ? Math.min(current.length - 1, currentIndex + 1)
                : Math.max(0, currentIndex - 1);
            if (nextIndex === currentIndex) return current;
            const next = [...current];
            const [moved] = next.splice(currentIndex, 1);
            next.splice(nextIndex, 0, moved);
            return next;
        });
    }, [replaceEditorAnnotations, selectedAnnotation, selectedId]);

    const hasUnfinishedDraft = draftPoints.length > 0 || Boolean(draftImage);
    const handleMeasurementModeChange = (nextMeasuring) => {
        if (nextMeasuring && hasUnfinishedDraft) return;
        clearTemporaryMeasurement();
        setMeasuring(nextMeasuring);
    };
    const closeEditor = useCallback(() => {
        if (libraryImportPending || (toolbarInInspector && hasUnfinishedDraft)) return false;
        saveNow?.();
        onClose?.();
        // This acknowledges the tool transition, not persistence; the existing
        // save queue and status continue to report saving or recovery errors.
        return true;
    }, [hasUnfinishedDraft, libraryImportPending, onClose, saveNow, toolbarInInspector]);

    const mapOverlay = enabled ? (
        <>
        <PrintAnnotationLayer
            annotations={editorAnnotations}
            editable={!measurementActive}
            tool={tool}
            selectedId={selectedAnnotation?.id || null}
            draftPoints={draftPoints}
            draftText={draftText}
            draftStyle={draftStyle}
            draftImage={draftImage}
            privateImageSources={privateImageSources}
            onSelect={(annotationId) => {
                if (annotationId && !editableIds.has(annotationId)) return;
                setSelectedId(annotationId);
                if (!PRINT_ANNOTATION_TRANSFORM_TOOLS.has(tool)) {
                    setTool(PRINT_ANNOTATION_TOOL_SELECT);
                }
                setDraftPoints([]);
            }}
            onUpdate={handleUpdate}
            onDraftPointsChange={setDraftPoints}
            onCreate={handleCreate}
            onCancel={cancelDraft}
        />
        {measurementActive ? <TemporaryMapMeasurementLayer measurement={temporaryMeasurement.measurement}
            onPoint={temporaryMeasurement.addPoint} /> : null}
        </>
    ) : null;

    const selectedBoundary = selectedAnnotation && ['circle', 'rectangle', 'polygon'].includes(selectedAnnotation.type);
    const libraryAvailable = Boolean(boundaryLibraryEnabled && !boundaryWorkflowSession?.loggingOut && ownerKey && mapId && flushPendingChanges);
    const getSaveSession = (fresh = false) => {
        if (!selectedAnnotation) return null;
        if (fresh || !libraryContext.saveSessions.has(selectedAnnotation.id)) libraryContext.saveSessions.set(selectedAnnotation.id,
            { requestId: createPrintAnnotationId(), operation: null, result: null });
        return libraryContext.saveSessions.get(selectedAnnotation.id);
    };
    const libraryControls = libraryAvailable ? <div className="mt-3 space-y-2">
        <button type="button" disabled={hasUnfinishedDraft || libraryImportPending || libraryContext.operation?.appended || ['idle', 'loading', 'error'].includes(status)}
            onClick={() => { setLibrarySelectedIds([]);setLibraryOpen(true); }}
            className="min-h-11 w-full rounded-lg border border-brand-200 px-3 py-2 text-sm font-semibold text-brand-800 disabled:opacity-40">Boundary Library</button>
        {selectedBoundary ? <button type="button" disabled={hasUnfinishedDraft || libraryImportPending || ['idle', 'loading'].includes(status)}
            onClick={() => { getSaveSession(); setSaveLibraryOpen(true); }}
            className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40">Save boundary to library</button> : null}
        {libraryImportError ? <div className="space-y-2 text-sm text-red-700"><p role="alert">{libraryImportError}</p>
            {libraryContext.operation?.appended ? <button type="button" disabled={libraryImportPending} className="min-h-11 rounded-lg border px-3 font-semibold disabled:opacity-40" onClick={async () => {
                setLibraryImportPending(true);
                try { await libraryContext.operation.apply(); if (currentLibraryScope()) { setLibraryImportError(''); libraryContext.operation = null; } }
                catch (failure) { if (currentLibraryScope()) setLibraryImportError(failure.message); }
                finally { if (currentLibraryScope()) setLibraryImportPending(false); }
            }}>Retry saving imported boundaries</button> : null}</div> : null}
        {libraryOpen ? <BoundaryLibraryPicker selectedIds={librarySelectedIds} onSelectionChange={setLibrarySelectedIds} scopeKey={mapId} workflowSession={boundaryWorkflowSession}
            maxSelection={Math.max(0, PRINT_ANNOTATION_MAX_COUNT - annotations.length)} confirmLabel="Add boundaries to map"
            validateBatch={snapshots => assertBoundaryDrawingBatchCapacity(libraryContext.annotations, snapshots.map(item => item.drawing))}
            onDraw={() => { setLibraryOpen(false); handleToolChange(PRINT_ANNOTATION_TOOL_POLYGON); }} onCancel={() => setLibraryOpen(false)}
            onConfirm={async snapshots => {
                if (!currentLibraryScope()) return;
                // The updater receives the controller's latest full document, including hidden drawings.
                const operation = createBoundaryImportOperation({ drawings: snapshots.map(item => item.drawing), replaceAnnotations: replaceEditorAnnotations,
                    flushPendingChanges, isCurrent: currentLibraryScope });
                libraryContext.operation = operation;
                setLibraryOpen(false);setLibraryImportPending(true);setLibraryImportError('');
                try { await operation.apply(); if (currentLibraryScope()) { libraryContext.operation = null;cancelDraft(); } }
                catch (failure) { if (currentLibraryScope()) setLibraryImportError(failure.message); }
                finally { if (currentLibraryScope()) setLibraryImportPending(false); }
            }} /> : null}
        {saveLibraryOpen && selectedBoundary ? <BoundaryLibrarySaveDialog key={`${selectedAnnotation.id}:${saveLibraryVersion}`} mapId={mapId}
            annotation={selectedAnnotation} savedRevision={savedRevision} session={getSaveSession()} flushPendingChanges={flushPendingChanges}
            isCurrent={currentLibraryScope} onCancel={() => setSaveLibraryOpen(false)} onSaveAsNew={reviewedDrawing => { const session = getSaveSession(true); if (reviewedDrawing) session.reviewedDrawing = reviewedDrawing;setSaveLibraryVersion(value => value + 1); }} /> : null}
    </div> : null;

    const surfaceOverlay = enabled ? (
        <PrintAnnotationToolbar
            embedded={toolbarInInspector}
            closeDisabled={libraryImportPending || (toolbarInInspector && hasUnfinishedDraft)}
            tool={tool}
            modeControls={temporaryMeasurementEnabled ? <AnnotationToolModeControls measuring={measuring}
                hasUnfinishedDrawing={hasUnfinishedDraft} onChange={handleMeasurementModeChange} /> : null}
            measurementControls={measurementActive ? <TemporaryMapMeasurementControls
                measurement={temporaryMeasurement.measurement} onKindChange={temporaryMeasurement.chooseKind}
                onClear={clearTemporaryMeasurement} /> : null}
            creationLimitReached={annotations.length >= PRINT_ANNOTATION_MAX_COUNT}
            draftText={draftText}
            draftStyle={draftStyle}
            draftPointCount={draftPoints.length}
            selectedAnnotation={selectedAnnotation}
            onFindWithinArea={onFindWithinArea}
            status={status}
            error={error}
            canUndo={canUndo}
            canRedo={canRedo}
            canMoveSelectedBackward={selectedIndex > 0}
            canMoveSelectedForward={selectedIndex >= 0 && selectedIndex < annotations.length - 1}
            canDuplicateSelected={Boolean(selectedAnnotation && canAddPrintAnnotation(annotations, selectedAnnotation.type, selectedAnnotation.resourceLinks))}
            boundaryLibraryControls={libraryControls}
            importControls={mapId ? (
                <KmlBoundaryImport mapId={mapId} annotations={annotations}
                    disabled={['idle', 'loading', 'error'].includes(status) || annotations.length >= PRINT_ANNOTATION_MAX_COUNT}
                    onImport={(boundaries) => {
                        let importedId = null;
                        replaceEditorAnnotations((current) => {
                            const next = appendKmlBoundaries(current, boundaries);
                            importedId = next[current.length]?.id;
                            return next;
                        });
                        setSelectedId(importedId);
                        cancelDraft();
                    }} />
            ) : null}
            imageControls={mapId ? (
                <AnnotationImageUpload
                    mapId={mapId}
                    disabled={!canAddPrintAnnotation(annotations, 'image')}
                    onUploaded={(image) => {
                        setDraftImage(image);
                        setSelectedId(null);
                        setDraftPoints([]);
                        setTool('image');
                    }}
                />
            ) : null}
            resourceControls={directory && selectedAnnotation ? (
                <AnnotationResourcePicker
                    directory={directory}
                    annotation={selectedAnnotation}
                    maxLinks={getAnnotationResourceLinkBudget(annotations, selectedAnnotation.id)}
                    onChange={handleSelectedChange}
                />
            ) : null}
            onToolChange={handleToolChange}
            onDraftTextChange={setDraftText}
            onDraftStyleChange={setDraftStyle}
            onSelectedChange={handleSelectedChange}
            onFinishDrawing={handleFinish}
            onUndoDraftPoint={() => setDraftPoints((current) => current.slice(0, -1))}
            onCancelDraft={cancelDraft}
            onMoveSelected={handleMove}
            onDuplicateSelected={handleDuplicate}
            onDeleteSelected={handleDelete}
            onUndo={undo}
            onRedo={redo}
            onClose={closeEditor}
        />
    ) : null;

    return { mapOverlay, surfaceOverlay: toolbarInInspector ? null : surfaceOverlay,
        inspectorControls: toolbarInInspector ? surfaceOverlay : null, hasUnfinishedDraft,
        hasTemporaryMeasurement: temporaryMeasurement.hasMeasurement, clearTemporaryMeasurement,
        selectedAnnotation, tool, cancelDraft, closeEditor, selectTool: handleToolChange };
}
