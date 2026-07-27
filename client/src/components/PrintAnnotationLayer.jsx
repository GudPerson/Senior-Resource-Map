import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
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

import {
    PRINT_ANNOTATION_MAX_CONTROL_POINTS,
    PRINT_ANNOTATION_TOOL_CIRCLE,
    PRINT_ANNOTATION_TOOL_LINE,
    PRINT_ANNOTATION_TOOL_PIN,
    PRINT_ANNOTATION_TOOL_POLYGON,
    PRINT_ANNOTATION_TOOL_RECTANGLE,
    PRINT_ANNOTATION_TOOL_SELECT,
    appendBoundedAnnotationPoint,
    buildRoundedPrintAnnotationPolygon,
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
            display:block;
            width:14px;
            height:14px;
            border:3px solid #ffffff;
            border-radius:50%;
            background:${color};
            box-shadow:0 1px 5px rgba(15,23,42,.35);
        "></span>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
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

function AnnotationVertexHandles({
    annotation,
    layerIndex,
    onUpdate,
}) {
    const editablePoints = annotation.type === PRINT_ANNOTATION_TOOL_POLYGON
        ? annotation.controlPoints || annotation.points
        : annotation.points;

    return editablePoints.map((point, index) => (
        <Marker
            key={`${annotation.id}:vertex:${index}`}
            position={point}
            icon={createVertexIcon(annotation.style.color)}
            pane="markerPane"
            draggable
            interactive
            zIndexOffset={3000 + (layerIndex * 10)}
            eventHandlers={{
                dragend: (event) => {
                    const latLng = event.target.getLatLng();
                    let nextPoints = editablePoints.map((current, pointIndex) => (
                        pointIndex === index ? [latLng.lat, latLng.lng] : current
                    ));
                    if (
                        annotation.type === PRINT_ANNOTATION_TOOL_CIRCLE
                        && index === 0
                        && editablePoints.length === 2
                    ) {
                        const latDelta = latLng.lat - editablePoints[0][0];
                        const lngDelta = latLng.lng - editablePoints[0][1];
                        nextPoints = [
                            [latLng.lat, latLng.lng],
                            [
                                editablePoints[1][0] + latDelta,
                                editablePoints[1][1] + lngDelta,
                            ],
                        ];
                    }
                    onUpdate?.(annotation.id, annotation.type === PRINT_ANNOTATION_TOOL_POLYGON
                        ? {
                            points: nextPoints,
                            controlPoints: nextPoints,
                        }
                        : { points: nextPoints });
                },
                click: stopAnnotationEvent,
            }}
        />
    ));
}

function getShapeTextPosition(annotation, displayPoints) {
    if (annotation.type === PRINT_ANNOTATION_TOOL_CIRCLE) {
        return annotation.points[0];
    }
    const bounds = L.latLngBounds(displayPoints.map(([lat, lng]) => [lat, lng]));
    return bounds.getCenter();
}

function ShapeTextMarker({
    annotation,
    position,
    interactive,
    layerIndex,
    onSelect,
}) {
    const icon = useMemo(
        () => createShapeTextIcon(annotation),
        [annotation],
    );

    return (
        <Marker
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

function AnnotationShape({
    annotation,
    selected,
    interactive,
    layerIndex,
    onSelect,
    onUpdate,
}) {
    const map = useMap();
    const eventHandlers = interactive ? {
        click: (event) => {
            stopAnnotationEvent(event);
            onSelect?.(annotation.id);
        },
    } : undefined;
    const pathOptions = getPathOptions(annotation, selected);
    const displayPoints = annotation.type === PRINT_ANNOTATION_TOOL_POLYGON
        ? buildRoundedPrintAnnotationPolygon(annotation.controlPoints || annotation.points)
        : annotation.points;
    let shape = null;

    if (annotation.type === PRINT_ANNOTATION_TOOL_LINE) {
        shape = (
            <Polyline
                positions={annotation.points}
                pathOptions={{ ...pathOptions, fill: false }}
                eventHandlers={eventHandlers}
                interactive={interactive}
            />
        );
    } else if (annotation.type === PRINT_ANNOTATION_TOOL_RECTANGLE) {
        shape = (
            <Rectangle
                bounds={annotation.points}
                pathOptions={pathOptions}
                eventHandlers={eventHandlers}
                interactive={interactive}
            />
        );
    } else if (annotation.type === PRINT_ANNOTATION_TOOL_CIRCLE) {
        shape = (
            <Circle
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
                    position={getShapeTextPosition(annotation, displayPoints)}
                    interactive={interactive}
                    layerIndex={layerIndex}
                    onSelect={onSelect}
                />
            ) : null}
            {selected && interactive ? (
                <AnnotationVertexHandles
                    annotation={annotation}
                    layerIndex={layerIndex}
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
    onSelect,
    onUpdate,
}) {
    return (
        <Marker
            position={annotation.points[0]}
            icon={createPinIcon(annotation, selected)}
            draggable={selected && interactive}
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
    onCreate,
    onCancel,
}) {
    const map = useMap();
    const interactionRef = useRef({
        tool,
        draftPoints,
        draftText,
        onDraftPointsChange,
        onCreate,
        onCancel,
    });
    interactionRef.current = {
        tool,
        draftPoints,
        draftText,
        onDraftPointsChange,
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

            const maximum = current.tool === PRINT_ANNOTATION_TOOL_POLYGON
                ? PRINT_ANNOTATION_MAX_CONTROL_POINTS
                : 2;
            if (current.draftPoints.length >= maximum) return;
            current.onDraftPointsChange?.(
                appendBoundedAnnotationPoint(current.draftPoints, point, maximum),
            );
        };

        map.on('click', handleClick);

        return () => {
            map.off('click', handleClick);
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
                event.key === 'Backspace'
                && current.tool !== PRINT_ANNOTATION_TOOL_SELECT
                && current.tool !== PRINT_ANNOTATION_TOOL_PIN
                && current.draftPoints.length
                && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
            ) {
                event.preventDefault();
                current.onDraftPointsChange?.(current.draftPoints.slice(0, -1));
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
    style,
}) {
    const map = useMap();
    if (!points.length) return null;
    const pathOptions = {
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: Math.min(style.fillOpacity, 0.1),
        weight: style.weight,
        dashArray: style.dashed ? '9 7' : null,
        lineCap: 'round',
        lineJoin: 'round',
    };

    if (points.length === 1) {
        return (
            <Marker
                position={points[0]}
                icon={createVertexIcon(style.color)}
                interactive={false}
                zIndexOffset={2900}
            />
        );
    }
    if (tool === PRINT_ANNOTATION_TOOL_RECTANGLE) {
        return <Rectangle bounds={points.slice(0, 2)} pathOptions={pathOptions} interactive={false} />;
    }
    if (tool === PRINT_ANNOTATION_TOOL_CIRCLE) {
        return (
            <Circle
                center={points[0]}
                radius={Math.max(1, map.distance(points[0], points[1]))}
                pathOptions={pathOptions}
                interactive={false}
            />
        );
    }
    if (tool === PRINT_ANNOTATION_TOOL_POLYGON && points.length >= 3) {
        return (
            <Polygon
                positions={buildRoundedPrintAnnotationPolygon(points)}
                pathOptions={pathOptions}
                interactive={false}
            />
        );
    }
    return <Polyline positions={points} pathOptions={pathOptions} interactive={false} />;
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
                                interactive={editable}
                                layerIndex={layerIndex}
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
                            interactive={editable}
                            layerIndex={layerIndex}
                            onSelect={onSelect}
                            onUpdate={handleUpdate}
                        />
                    </Pane>
                );
            })}
            {editable ? (
                <>
                    <Pane name="print-annotation-draft" style={{ zIndex: 690 }}>
                        <DraftShape tool={tool} points={draftPoints} style={draftStyle} />
                    </Pane>
                    <DrawInteractionController
                        enabled
                        tool={tool}
                        draftPoints={draftPoints}
                        draftText={draftText}
                        onDraftPointsChange={onDraftPointsChange}
                        onCreate={onCreate}
                        onCancel={onCancel}
                    />
                </>
            ) : null}
        </>
    );
}
