import { useCallback, useEffect, useMemo, useState } from 'react';

import PrintAnnotationLayer from '../components/PrintAnnotationLayer.jsx';
import PrintAnnotationToolbar from '../components/PrintAnnotationToolbar.jsx';
import {
    DEFAULT_PRINT_ANNOTATION_STYLE,
    PRINT_ANNOTATION_DRAW_TOOLS,
    PRINT_ANNOTATION_MAX_COUNT,
    PRINT_ANNOTATION_TRANSFORM_TOOLS,
    PRINT_ANNOTATION_TOOL_PIN,
    PRINT_ANNOTATION_TOOL_POLYGON,
    PRINT_ANNOTATION_TOOL_RECTANGLE,
    PRINT_ANNOTATION_TOOL_CIRCLE,
    PRINT_ANNOTATION_TOOL_SELECT,
    createPrintAnnotation,
    duplicatePrintAnnotation,
    getPrintAnnotationMinimumPointCount,
    normalizePrintAnnotationStyle,
} from '../lib/printAnnotations.js';

export default function useInteractiveMapAnnotationEditor({
    enabled = false,
    annotations = [],
    status = 'idle',
    error = '',
    replaceAnnotations = null,
    saveNow = null,
    undo = null,
    redo = null,
    canUndo = false,
    canRedo = false,
    onClose = null,
} = {}) {
    const [tool, setTool] = useState(PRINT_ANNOTATION_TOOL_SELECT);
    const [selectedId, setSelectedId] = useState(null);
    const [draftPoints, setDraftPoints] = useState([]);
    const [draftText, setDraftText] = useState('');
    const [draftStyle, setDraftStyle] = useState(DEFAULT_PRINT_ANNOTATION_STYLE);
    const selectedIndex = annotations.findIndex((annotation) => annotation.id === selectedId);
    const selectedAnnotation = useMemo(() => (
        annotations.find((annotation) => annotation.id === selectedId) || null
    ), [annotations, selectedId]);

    useEffect(() => {
        if (enabled) return;
        setTool(PRINT_ANNOTATION_TOOL_SELECT);
        setSelectedId(null);
        setDraftPoints([]);
    }, [enabled]);

    const cancelDraft = useCallback(() => {
        setDraftPoints([]);
        setTool(PRINT_ANNOTATION_TOOL_SELECT);
    }, []);

    const handleToolChange = useCallback((nextTool) => {
        setTool(nextTool);
        if (PRINT_ANNOTATION_DRAW_TOOLS.has(nextTool)) setSelectedId(null);
        setDraftPoints([]);
    }, []);

    const handleCreate = useCallback((type, points) => {
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
        });
        if (!annotation) return;
        replaceAnnotations?.((current) => (
            current.length >= PRINT_ANNOTATION_MAX_COUNT ? current : [...current, annotation]
        ));
        setSelectedId(annotation.id);
        setTool(PRINT_ANNOTATION_TOOL_SELECT);
        setDraftPoints([]);
    }, [draftStyle, draftText, replaceAnnotations]);

    const handleUpdate = useCallback((annotationId, patch) => {
        replaceAnnotations?.((current) => current.map((annotation) => (
            annotation.id === annotationId
                ? {
                    ...annotation,
                    ...patch,
                    ...(patch.style ? {
                        style: normalizePrintAnnotationStyle({
                            ...annotation.style,
                            ...patch.style,
                        }),
                    } : {}),
                }
                : annotation
        )));
    }, [replaceAnnotations]);

    const handleSelectedChange = useCallback((patch) => {
        if (!selectedId) return;
        if (
            selectedAnnotation?.type === PRINT_ANNOTATION_TOOL_PIN
            && Object.hasOwn(patch, 'text')
            && !String(patch.text || '').trim()
        ) return;
        handleUpdate(selectedId, patch);
    }, [handleUpdate, selectedAnnotation, selectedId]);

    const handleDelete = useCallback(() => {
        if (!selectedId) return;
        replaceAnnotations?.((current) => current.filter(
            (annotation) => annotation.id !== selectedId,
        ));
        setSelectedId(null);
    }, [replaceAnnotations, selectedId]);

    const handleDuplicate = useCallback(() => {
        if (!selectedAnnotation || annotations.length >= PRINT_ANNOTATION_MAX_COUNT) return;
        const duplicate = duplicatePrintAnnotation(selectedAnnotation);
        if (!duplicate) return;
        replaceAnnotations?.((current) => {
            if (current.length >= PRINT_ANNOTATION_MAX_COUNT) return current;
            const sourceIndex = current.findIndex((annotation) => annotation.id === selectedAnnotation.id);
            if (sourceIndex < 0) return current;
            const next = [...current];
            next.splice(sourceIndex + 1, 0, duplicate);
            return next;
        });
        setSelectedId(duplicate.id);
    }, [annotations.length, replaceAnnotations, selectedAnnotation]);

    const handleFinish = useCallback(() => {
        const minimumPointCount = getPrintAnnotationMinimumPointCount(tool);
        if (!minimumPointCount || draftPoints.length < minimumPointCount) return;
        handleCreate(tool, draftPoints);
    }, [draftPoints, handleCreate, tool]);

    const handleMove = useCallback((direction) => {
        if (!selectedId) return;
        replaceAnnotations?.((current) => {
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
    }, [replaceAnnotations, selectedId]);

    const closeEditor = useCallback(() => {
        saveNow?.();
        onClose?.();
    }, [onClose, saveNow]);

    const mapOverlay = enabled ? (
        <PrintAnnotationLayer
            annotations={annotations}
            editable
            tool={tool}
            selectedId={selectedId}
            draftPoints={draftPoints}
            draftText={draftText}
            draftStyle={draftStyle}
            onSelect={(annotationId) => {
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
    ) : null;

    const surfaceOverlay = enabled ? (
        <PrintAnnotationToolbar
            tool={tool}
            draftText={draftText}
            draftStyle={draftStyle}
            draftPointCount={draftPoints.length}
            selectedAnnotation={selectedAnnotation}
            status={status}
            error={error}
            canUndo={canUndo}
            canRedo={canRedo}
            canMoveSelectedBackward={selectedIndex > 0}
            canMoveSelectedForward={selectedIndex >= 0 && selectedIndex < annotations.length - 1}
            canDuplicateSelected={Boolean(selectedAnnotation && annotations.length < PRINT_ANNOTATION_MAX_COUNT)}
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

    return { mapOverlay, surfaceOverlay };
}
