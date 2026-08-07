import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Circle,
    Marker,
    Pane,
    Polygon,
    Polyline,
    Rectangle,
    Tooltip,
    useMap,
} from 'react-leaflet';
import L from 'leaflet';
import PrintAnnotationTransformHandle from './PrintAnnotationTransformHandle.jsx';

import {
    PRINT_ANNOTATION_DRAW_TOOLS,
    PRINT_ANNOTATION_TRANSFORM_TOOLS,
    PRINT_ANNOTATION_TOOL_CIRCLE,
    PRINT_ANNOTATION_TOOL_LINE,
    PRINT_ANNOTATION_TOOL_MOVE,
    PRINT_ANNOTATION_TOOL_PIN,
    PRINT_ANNOTATION_TOOL_POLYGON,
    PRINT_ANNOTATION_TOOL_RECTANGLE,
    PRINT_ANNOTATION_TOOL_SELECT,
    advancePrintAnnotationDraft,
    buildPrintAnnotationDraftPreviewPoints,
    buildPrintAnnotationRectanglePoints,
    buildRoundedPrintAnnotationPolygon,
    movePrintAnnotationControlPoint,
    movePrintAnnotationRectangleControlPoint,
    normalizePrintAnnotationRotation,
} from '../lib/printAnnotations.js';

function escapeMarkup(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function createPinIcon(annotation, selected) {
    const color = annotation.style.color;
    return L.divIcon({
        className: 'carearound-print-annotation-marker',
        html: `<div style="
            display:flex;
            align-items:center;
            justify-content:center;
            width:34px;
            height:34px;
            border:3px solid #ffffff;
            border-radius:50% 50% 50% 0;
            background:${color};
            color:#ffffff;
            font-size:12px;
            font-weight:900;
            box-shadow:0 4px 12px rgba(15,23,42,.28);
            transform:rotate(-45deg);
            outline:${selected ? `3px solid ${color}55` : 'none'};
        "><span style="max-width:22px;overflow:hidden;transform:rotate(45deg);white-space:nowrap;">${escapeMarkup(annotation.text.slice(0, 3))}</span></div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
    });
}

function createShapeTextIcon(annotation) {
    const { fontSize, textColor } = annotation.style;
    const rotationDegrees = normalizePrintAnnotationRotation(annotation.rotationDegrees);
    return L.divIcon({
        className: 'carearound-print-annotation-marker',
        html: `<div data-annotation-shape-text="true" style="
            box-sizing:border-box;
            display:flex;
            align-items:center;
            justify-content:center;
            width:240px;
            min-height:70px;
            padding:6px 10px;
            color:${textColor};
            font-size:${fontSize}px;
            font-weight:800;
            line-height:1.2;
            overflow:visible;
            overflow-wrap:anywhere;
            pointer-events:auto;
            text-align:center;
            text-shadow:0 1px 2px rgba(255,255,255,.95),0 0 5px rgba(255,255,255,.8);
            transform:rotate(${-rotationDegrees}deg);
            transform-origin:50% 50%;
            white-space:pre-wrap;
        ">${escapeMarkup(annotation.text)}</div>`,
        iconSize: [240, 70],
        iconAnchor: [120, 35],
    });
}

function createVertexIcon(color) {
    return L.divIcon({
        className: 'carearound-print-annotation-vertex',
        html: `<span style="
            display:flex;
            align-items:center;
            justify-content:center;
            width:44px;
            height:44px;
        "><span style="
            box-sizing:border-box;
            display:block;
            width:20px;
            height:20px;
            border:3px solid #ffffff;
            border-radius:50%;
            background:${color};
            box-shadow:0 1px 5px rgba(15,23,42,.35);
        "></span></span>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
    });
}

function createDraftPreviewIcon(color) {
    return L.divIcon({
        className: 'carearound-print-annotation-draft-preview',
        html: `<span style="
            box-sizing:border-box;
            display:block;
            width:18px;
            height:18px;
            border:3px solid #ffffff;
            border-radius:50%;
            background:${color};
            box-shadow:0 1px 5px rgba(15,23,42,.28);
            opacity:.72;
        "></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
    });
}

function getPathOptions(annotation, selected = false) {
    const style = annotation.style;
    return {
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        weight: style.weight + (selected ? 1 : 0),
        dashArray: style.dashed ? '9 7' : null,
        lineCap: 'round',
        lineJoin: 'round',
    };
}

function stopAnnotationEvent(event) {
    event?.originalEvent?.preventDefault?.();
    event?.originalEvent?.stopPropagation?.();
}

function areAnnotationPointsEqual(left = [], right = []) {
    return left.length === right.length && left.every((point, index) => (
        point[0] === right[index]?.[0] && point[1] === right[index]?.[1]
    ));
}

function getEditableAnnotationPoints(annotation) {
    return annotation.type === PRINT_ANNOTATION_TOOL_POLYGON
        ? annotation.controlPoints || annotation.points
        : annotation.points;
}

function getVisibleAnnotationControlPoints(annotation, points) {
    if (annotation.type !== PRINT_ANNOTATION_TOOL_RECTANGLE) return points;
    const corners = buildPrintAnnotationRectanglePoints(points, annotation.rotationDegrees);
    return corners.length === 4 ? [corners[0], corners[2]] : points;
}

function moveAnnotationControlPoint(annotation, points, pointIndex, point) {
    if (annotation.type === PRINT_ANNOTATION_TOOL_RECTANGLE) {
        return movePrintAnnotationRectangleControlPoint(
            points,
            pointIndex,
            point,
            annotation.rotationDegrees,
        );
    }
    return movePrintAnnotationControlPoint(annotation.type, points, pointIndex, point);
}

function AnnotationVertexHandles({
    annotation,
    layerIndex,
    onPreview,
    onUpdate,
}) {
    const editablePoints = getEditableAnnotationPoints(annotation);
    const latestEditablePointsRef = useRef(editablePoints);
    const dragBasePointsRef = useRef(null);
    const pendingCommittedPointsRef = useRef(null);
    const pendingPreviewRef = useRef(null);
    const previewFrameRef = useRef(null);
    const markerRefs = useRef([]);
    const visiblePoints = getVisibleAnnotationControlPoints(annotation, editablePoints);
    const vertexIcon = useMemo(
        () => createVertexIcon(annotation.style.color),
        [annotation.style.color],
    );

    useEffect(() => {
        if (dragBasePointsRef.current) return;
        const pendingCommittedPoints = pendingCommittedPointsRef.current;
        if (pendingCommittedPoints && !areAnnotationPointsEqual(
            editablePoints,
            pendingCommittedPoints,
        )) return;
        pendingCommittedPointsRef.current = null;
        latestEditablePointsRef.current = editablePoints;
    }, [editablePoints]);

    useEffect(() => () => {
        if (previewFrameRef.current) {
            window.cancelAnimationFrame(previewFrameRef.current);
        }
    }, []);

    const syncControlMarkers = useCallback((nextPoints) => {
        const nextVisiblePoints = getVisibleAnnotationControlPoints(annotation, nextPoints);
        nextVisiblePoints.forEach((point, index) => markerRefs.current[index]?.setLatLng(point));
    }, [annotation]);

    const queuePreview = useCallback((nextPoints) => {
        latestEditablePointsRef.current = nextPoints;
        pendingPreviewRef.current = nextPoints;
        syncControlMarkers(nextPoints);
        if (previewFrameRef.current) return;
        previewFrameRef.current = window.requestAnimationFrame(() => {
            previewFrameRef.current = null;
            const pendingPoints = pendingPreviewRef.current;
            pendingPreviewRef.current = null;
            if (pendingPoints) onPreview?.(pendingPoints);
        });
    }, [onPreview, syncControlMarkers]);

    const finishDrag = useCallback((index, event) => {
        const latLng = event.target.getLatLng();
        const basePoints = dragBasePointsRef.current || latestEditablePointsRef.current;
        const nextPoints = moveAnnotationControlPoint(
            annotation,
            basePoints,
            index,
            [latLng.lat, latLng.lng],
        );
        if (previewFrameRef.current) {
            window.cancelAnimationFrame(previewFrameRef.current);
            previewFrameRef.current = null;
        }
        pendingPreviewRef.current = null;
        latestEditablePointsRef.current = nextPoints;
        pendingCommittedPointsRef.current = areAnnotationPointsEqual(nextPoints, editablePoints)
            ? null
            : nextPoints;
        syncControlMarkers(nextPoints);
        onPreview?.(nextPoints);
        dragBasePointsRef.current = null;
        onUpdate?.(annotation.id, annotation.type === PRINT_ANNOTATION_TOOL_POLYGON
            ? {
                points: nextPoints,
                controlPoints: nextPoints,
            }
            : { points: nextPoints });
    }, [annotation, editablePoints, onPreview, onUpdate, syncControlMarkers]);

    return visiblePoints.map((point, index) => (
        <Marker
            key={`${annotation.id}:vertex:${index}`}
            ref={(marker) => {
                markerRefs.current[index] = marker;
            }}
            position={point}
            icon={vertexIcon}
            pane="markerPane"
            draggable
            interactive
            zIndexOffset={3000 + (layerIndex * 10)}
            eventHandlers={{
                dragstart: () => {
                    dragBasePointsRef.current = latestEditablePointsRef.current.map(
                        (current) => [...current],
                    );
                },
                drag: (event) => {
                    const latLng = event.target.getLatLng();
                    const basePoints = dragBasePointsRef.current
                        || latestEditablePointsRef.current;
                    queuePreview(moveAnnotationControlPoint(
                        annotation,
                        basePoints,
                        index,
                        [latLng.lat, latLng.lng],
                    ));
                },
                dragend: (event) => finishDrag(index, event),
                click: stopAnnotationEvent,
            }}
        />
    ));
}

function getShapeTextPosition(annotationType, points, displayPoints) {
    if (annotationType === PRINT_ANNOTATION_TOOL_CIRCLE) {
        return points[0];
    }
    const bounds = L.latLngBounds(displayPoints.map(([lat, lng]) => [lat, lng]));
    return bounds.getCenter();
}

function ShapeTextMarker({
    annotation,
    position,
    interactive,
    layerIndex,
    markerRef,
    onSelect,
}) {
    const icon = useMemo(
        () => createShapeTextIcon(annotation),
        [annotation],
    );

    return (
        <Marker
            ref={markerRef}
            position={position}
            icon={icon}
            interactive={interactive}
            zIndexOffset={2050 + (layerIndex * 10)}
            eventHandlers={interactive ? {
                click: (event) => {
                    stopAnnotationEvent(event);
                    onSelect?.(annotation.id);
                },
            } : undefined}
        />
    );
}

function setShapeTextRotation(marker, rotationDegrees) {
    const element = marker?.getElement?.()?.querySelector?.('[data-annotation-shape-text="true"]');
    if (!element) return;
    element.style.transform = `rotate(${-normalizePrintAnnotationRotation(rotationDegrees)}deg)`;
}

function AnnotationShape({
    annotation,
    selected,
    interactive,
    layerIndex,
    tool,
    onSelect,
    onUpdate,
}) {
    const map = useMap();
    const shapeRef = useRef(null);
    const shapeTextRef = useRef(null);
    const previewTransformRef = useRef(null);
    const eventHandlers = interactive ? {
        click: (event) => {
            stopAnnotationEvent(event);
            onSelect?.(annotation.id);
        },
    } : undefined;
    const pathOptions = getPathOptions(annotation, selected);
    const rotationDegrees = normalizePrintAnnotationRotation(annotation.rotationDegrees);
    const displayPoints = annotation.type === PRINT_ANNOTATION_TOOL_RECTANGLE
        ? buildPrintAnnotationRectanglePoints(annotation.points, rotationDegrees)
        : annotation.type === PRINT_ANNOTATION_TOOL_POLYGON
            ? buildRoundedPrintAnnotationPolygon(annotation.controlPoints || annotation.points)
            : annotation.points;
    const applyTransformPreview = useCallback((nextPoints, nextRotationDegrees) => {
        const nextDisplayPoints = annotation.type === PRINT_ANNOTATION_TOOL_RECTANGLE
            ? buildPrintAnnotationRectanglePoints(nextPoints, nextRotationDegrees)
            : annotation.type === PRINT_ANNOTATION_TOOL_POLYGON
                ? buildRoundedPrintAnnotationPolygon(nextPoints)
                : nextPoints;
        if (annotation.type === PRINT_ANNOTATION_TOOL_LINE) {
            shapeRef.current?.setLatLngs(nextPoints);
        } else if (annotation.type === PRINT_ANNOTATION_TOOL_RECTANGLE) {
            shapeRef.current?.setLatLngs(nextDisplayPoints);
        } else if (annotation.type === PRINT_ANNOTATION_TOOL_CIRCLE) {
            shapeRef.current?.setLatLng(nextPoints[0]);
            shapeRef.current?.setRadius(Math.max(1, map.distance(nextPoints[0], nextPoints[1])));
        } else {
            shapeRef.current?.setLatLngs(nextDisplayPoints);
        }
        shapeTextRef.current?.setLatLng(getShapeTextPosition(
            annotation.type,
            nextPoints,
            nextDisplayPoints,
        ));
        setShapeTextRotation(shapeTextRef.current, nextRotationDegrees);
    }, [annotation.type, map]);
    const handleVertexPreview = useCallback((nextPoints) => {
        previewTransformRef.current = { points: nextPoints, rotationDegrees };
        applyTransformPreview(nextPoints, rotationDegrees);
    }, [applyTransformPreview, rotationDegrees]);
    const handleTransformPreview = useCallback((nextPoints, nextRotationDegrees) => {
        previewTransformRef.current = {
            points: nextPoints,
            rotationDegrees: nextRotationDegrees,
        };
        applyTransformPreview(nextPoints, nextRotationDegrees);
    }, [applyTransformPreview]);

    useLayoutEffect(() => {
        const previewTransform = previewTransformRef.current;
        if (!previewTransform) return;
        const currentPoints = annotation.type === PRINT_ANNOTATION_TOOL_POLYGON
            ? annotation.controlPoints || annotation.points
            : annotation.points;
        if (
            areAnnotationPointsEqual(currentPoints, previewTransform.points)
            && rotationDegrees === previewTransform.rotationDegrees
        ) {
            previewTransformRef.current = null;
            return;
        }
        applyTransformPreview(
            previewTransform.points,
            previewTransform.rotationDegrees,
        );
    }, [
        annotation.controlPoints,
        annotation.points,
        annotation.type,
        applyTransformPreview,
        rotationDegrees,
    ]);
    let shape = null;

    if (annotation.type === PRINT_ANNOTATION_TOOL_LINE) {
        shape = (
            <Polyline
                ref={shapeRef}
                positions={annotation.points}
                pathOptions={{ ...pathOptions, fill: false }}
                eventHandlers={eventHandlers}
                interactive={interactive}
            />
        );
    } else if (annotation.type === PRINT_ANNOTATION_TOOL_RECTANGLE) {
        shape = (
            <Polygon
                ref={shapeRef}
                positions={displayPoints}
                pathOptions={pathOptions}
                eventHandlers={eventHandlers}
                interactive={interactive}
            />
        );
    } else if (annotation.type === PRINT_ANNOTATION_TOOL_CIRCLE) {
        shape = (
            <Circle
                ref={shapeRef}
                center={annotation.points[0]}
                radius={Math.max(1, map.distance(annotation.points[0], annotation.points[1]))}
                pathOptions={pathOptions}
                eventHandlers={eventHandlers}
                interactive={interactive}
            />
        );
    } else {
        shape = (
            <Polygon
                ref={shapeRef}
                positions={displayPoints}
                pathOptions={pathOptions}
                eventHandlers={eventHandlers}
                interactive={interactive}
            />
        );
    }

    const supportsInsideText = [
        PRINT_ANNOTATION_TOOL_RECTANGLE,
        PRINT_ANNOTATION_TOOL_CIRCLE,
        PRINT_ANNOTATION_TOOL_POLYGON,
    ].includes(annotation.type);

    return (
        <>
            {shape}
            {annotation.text && supportsInsideText ? (
                <ShapeTextMarker
                    annotation={annotation}
                    position={getShapeTextPosition(
                        annotation.type,
                        annotation.points,
                        displayPoints,
                    )}
                    interactive={interactive}
                    layerIndex={layerIndex}
                    markerRef={shapeTextRef}
                    onSelect={onSelect}
                />
            ) : null}
            {selected && interactive && tool === PRINT_ANNOTATION_TOOL_SELECT ? (
                <AnnotationVertexHandles
                    annotation={annotation}
                    layerIndex={layerIndex}
                    onPreview={handleVertexPreview}
                    onUpdate={onUpdate}
                />
            ) : null}
            {selected && interactive && PRINT_ANNOTATION_TRANSFORM_TOOLS.has(tool) ? (
                <PrintAnnotationTransformHandle
                    annotation={annotation}
                    layerIndex={layerIndex}
                    tool={tool}
                    onPreview={handleTransformPreview}
                    onUpdate={onUpdate}
                />
            ) : null}
        </>
    );
}

function PinAnnotation({
    annotation,
    selected,
    interactive,
    layerIndex,
    tool,
    onSelect,
    onUpdate,
}) {
    return (
        <Marker
            position={annotation.points[0]}
            icon={createPinIcon(annotation, selected)}
            draggable={selected && interactive && [
                PRINT_ANNOTATION_TOOL_SELECT,
                PRINT_ANNOTATION_TOOL_MOVE,
            ].includes(tool)}
            interactive={interactive}
            zIndexOffset={2000 + (layerIndex * 10)}
            eventHandlers={interactive ? {
                click: (event) => {
                    stopAnnotationEvent(event);
                    onSelect?.(annotation.id);
                },
                dragend: (event) => {
                    const latLng = event.target.getLatLng();
                    onUpdate?.(annotation.id, { points: [[latLng.lat, latLng.lng]] });
                },
            } : undefined}
        >
            <Tooltip
                permanent
                direction="right"
                offset={[14, -18]}
                className="carearound-print-annotation-label"
            >
                <span
                    style={{
                        color: annotation.style.textColor,
                        fontSize: `${annotation.style.fontSize}px`,
                        fontWeight: 800,
                    }}
                >
                    {annotation.text}
                </span>
            </Tooltip>
        </Marker>
    );
}

function DrawInteractionController({
    enabled,
    tool,
    draftPoints,
    draftText,
    onDraftPointsChange,
    onPreviewPointChange,
    onCreate,
    onCancel,
}) {
    const map = useMap();
    const interactionRef = useRef({
        tool,
        draftPoints,
        draftText,
        onDraftPointsChange,
        onPreviewPointChange,
        onCreate,
        onCancel,
    });
    interactionRef.current = {
        tool,
        draftPoints,
        draftText,
        onDraftPointsChange,
        onPreviewPointChange,
        onCreate,
        onCancel,
    };

    useEffect(() => {
        if (!enabled || tool === PRINT_ANNOTATION_TOOL_SELECT) return undefined;
        const container = map.getContainer();
        const previousCursor = container.style.cursor;
        const draggingWasEnabled = map.dragging.enabled();
        const doubleClickWasEnabled = map.doubleClickZoom.enabled();
        map.dragging.disable();
        map.doubleClickZoom.disable();
        container.style.cursor = 'crosshair';

        const handleClick = (event) => {
            const current = interactionRef.current;
            const point = [Number(event.latlng.lat), Number(event.latlng.lng)];
            if (current.tool === PRINT_ANNOTATION_TOOL_PIN) {
                if (!String(current.draftText || '').trim()) return;
                current.onCreate?.(current.tool, [point]);
                return;
            }

            const nextDraft = advancePrintAnnotationDraft(
                current.tool,
                current.draftPoints,
                point,
            );
            current.draftPoints = nextDraft.points;
            current.onPreviewPointChange?.(null);
            if (nextDraft.completed) {
                current.draftPoints = [];
                current.onCreate?.(current.tool, nextDraft.points);
                return;
            }
            current.onDraftPointsChange?.(nextDraft.points);
        };

        let previewFrame = null;
        let pendingPreviewPoint = null;
        const flushPreviewPoint = () => {
            previewFrame = null;
            interactionRef.current.onPreviewPointChange?.(pendingPreviewPoint);
        };
        const queuePreviewPoint = (point) => {
            pendingPreviewPoint = point;
            if (previewFrame !== null) return;
            previewFrame = window.requestAnimationFrame(flushPreviewPoint);
        };
        const handleMouseMove = (event) => {
            if (!interactionRef.current.draftPoints.length) return;
            queuePreviewPoint([Number(event.latlng.lat), Number(event.latlng.lng)]);
        };
        const handleMouseOut = () => queuePreviewPoint(null);

        map.on('click', handleClick);
        map.on('mousemove', handleMouseMove);
        map.on('mouseout', handleMouseOut);

        return () => {
            map.off('click', handleClick);
            map.off('mousemove', handleMouseMove);
            map.off('mouseout', handleMouseOut);
            if (previewFrame !== null) window.cancelAnimationFrame(previewFrame);
            container.style.cursor = previousCursor;
            if (draggingWasEnabled) map.dragging.enable();
            if (doubleClickWasEnabled) map.doubleClickZoom.enable();
        };
    }, [enabled, map, tool]);

    useEffect(() => {
        if (!enabled) return undefined;
        const handleKeyDown = (event) => {
            const current = interactionRef.current;
            if (event.key === 'Escape') {
                event.preventDefault();
                current.onCancel?.();
            }
            if (
                event.key === 'Enter'
                && current.tool === PRINT_ANNOTATION_TOOL_POLYGON
                && current.draftPoints.length >= 3
                && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
            ) {
                event.preventDefault();
                current.onPreviewPointChange?.(null);
                const completedPoints = current.draftPoints;
                current.draftPoints = [];
                current.onCreate?.(current.tool, completedPoints);
            }
            if (
                event.key === 'Backspace'
                && current.tool !== PRINT_ANNOTATION_TOOL_SELECT
                && current.tool !== PRINT_ANNOTATION_TOOL_PIN
                && current.draftPoints.length
                && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
            ) {
                event.preventDefault();
                const nextDraftPoints = current.draftPoints.slice(0, -1);
                current.draftPoints = nextDraftPoints;
                current.onPreviewPointChange?.(null);
                current.onDraftPointsChange?.(nextDraftPoints);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled]);

    return null;
}

function DraftShape({
    tool,
    points,
    previewPoint,
    style,
}) {
    const map = useMap();
    if (!points.length) return null;
    const previewPoints = buildPrintAnnotationDraftPreviewPoints(
        tool,
        points,
        previewPoint,
    );
    const hasPreviewPoint = previewPoints.length > points.length;
    const geometryPoints = hasPreviewPoint ? previewPoints : points;
    const pathOptions = {
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: Math.min(style.fillOpacity, 0.1),
        weight: style.weight,
        dashArray: style.dashed ? '9 7' : null,
        lineCap: 'round',
        lineJoin: 'round',
    };

    let shape = null;
    if (tool === PRINT_ANNOTATION_TOOL_RECTANGLE) {
        shape = geometryPoints.length >= 2 ? (
            <Rectangle bounds={geometryPoints.slice(0, 2)} pathOptions={pathOptions} interactive={false} />
        ) : null;
    } else if (tool === PRINT_ANNOTATION_TOOL_CIRCLE) {
        shape = geometryPoints.length >= 2 ? (
            <Circle
                center={geometryPoints[0]}
                radius={Math.max(1, map.distance(geometryPoints[0], geometryPoints[1]))}
                pathOptions={pathOptions}
                interactive={false}
            />
        ) : null;
    } else if (tool === PRINT_ANNOTATION_TOOL_POLYGON && geometryPoints.length >= 3) {
        shape = (
            <Polygon
                positions={buildRoundedPrintAnnotationPolygon(geometryPoints)}
                pathOptions={pathOptions}
                interactive={false}
            />
        );
    } else if (geometryPoints.length >= 2) {
        shape = <Polyline positions={geometryPoints} pathOptions={pathOptions} interactive={false} />;
    }

    return (
        <>
            {shape}
            {points.map((point, index) => (
                <Marker
                    key={`draft-anchor:${index}`}
                    position={point}
                    icon={createVertexIcon(style.color)}
                    interactive={false}
                    zIndexOffset={2900 + index}
                />
            ))}
            {hasPreviewPoint ? (
                <Marker
                    position={previewPoint}
                    icon={createDraftPreviewIcon(style.color)}
                    interactive={false}
                    zIndexOffset={2950}
                />
            ) : null}
        </>
    );
}

export default function PrintAnnotationLayer({
    annotations = [],
    editable = false,
    tool = PRINT_ANNOTATION_TOOL_SELECT,
    selectedId = null,
    draftPoints = [],
    draftText = '',
    draftStyle,
    onSelect,
    onUpdate,
    onDraftPointsChange,
    onCreate,
    onCancel,
}) {
    const [draftPreviewPoint, setDraftPreviewPoint] = useState(null);
    const annotationInteractionEnabled = editable && (
        tool === PRINT_ANNOTATION_TOOL_SELECT || PRINT_ANNOTATION_TRANSFORM_TOOLS.has(tool)
    );

    useEffect(() => {
        setDraftPreviewPoint(null);
    }, [draftPoints.length, editable, tool]);

    const handleUpdate = useCallback((annotationId, patch) => {
        onUpdate?.(annotationId, patch);
    }, [onUpdate]);

    return (
        <>
            {annotations.map((annotation, layerIndex) => {
                const selected = editable && annotation.id === selectedId;
                if (annotation.type === PRINT_ANNOTATION_TOOL_PIN) {
                    return (
                        <Pane
                            key={`${annotation.id}:${layerIndex}:${editable ? 'edit' : 'view'}`}
                            name={`print-annotation-${annotation.id}`}
                            style={{ zIndex: 450 + layerIndex }}
                        >
                            <PinAnnotation
                                annotation={annotation}
                                selected={selected}
                                interactive={annotationInteractionEnabled}
                                layerIndex={layerIndex}
                                tool={tool}
                                onSelect={onSelect}
                                onUpdate={handleUpdate}
                            />
                        </Pane>
                    );
                }
                return (
                    <Pane
                        key={`${annotation.id}:${layerIndex}:${editable ? 'edit' : 'view'}`}
                        name={`print-annotation-${annotation.id}`}
                        style={{ zIndex: 450 + layerIndex }}
                    >
                        <AnnotationShape
                            annotation={annotation}
                            selected={selected}
                            interactive={annotationInteractionEnabled}
                            layerIndex={layerIndex}
                            tool={tool}
                            onSelect={onSelect}
                            onUpdate={handleUpdate}
                        />
                    </Pane>
                );
            })}
            {editable ? (
                <>
                    <Pane name="print-annotation-draft" style={{ zIndex: 690 }}>
                        <DraftShape
                            tool={tool}
                            points={draftPoints}
                            previewPoint={draftPreviewPoint}
                            style={draftStyle}
                        />
                    </Pane>
                    <DrawInteractionController
                        enabled={PRINT_ANNOTATION_DRAW_TOOLS.has(tool)}
                        tool={tool}
                        draftPoints={draftPoints}
                        draftText={draftText}
                        onDraftPointsChange={onDraftPointsChange}
                        onPreviewPointChange={setDraftPreviewPoint}
                        onCreate={onCreate}
                        onCancel={onCancel}
                    />
                </>
            ) : null}
        </>
    );
}
