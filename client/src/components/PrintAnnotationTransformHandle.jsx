import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
} from 'react';
import {
    Marker,
    Polyline,
    useMap,
} from 'react-leaflet';
import L from 'leaflet';

import {
    PRINT_ANNOTATION_TOOL_CIRCLE,
    PRINT_ANNOTATION_TOOL_LINE,
    PRINT_ANNOTATION_TOOL_MOVE,
    PRINT_ANNOTATION_TOOL_POLYGON,
    PRINT_ANNOTATION_TOOL_RECTANGLE,
    PRINT_ANNOTATION_TOOL_ROTATE,
    buildPrintAnnotationRectanglePoints,
    getPrintAnnotationPointBoundsCenter,
    isPrintAnnotationRotationSupported,
    normalizePrintAnnotationRotation,
    rotatePrintAnnotationPoints,
    translatePrintAnnotationPoints,
} from '../lib/printAnnotations.js';

function createTransformIcon(tool, color) {
    const label = tool === PRINT_ANNOTATION_TOOL_ROTATE ? 'Rotate annotation' : 'Move annotation';
    const glyph = tool === PRINT_ANNOTATION_TOOL_ROTATE
        ? `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 11a8 8 0 1 0-2.35 5.65" />
            <path d="M20 4v7h-7" />
        </svg>`
        : `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20M2 12h20" />
            <path d="m8 6 4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" />
        </svg>`;
    return L.divIcon({
        className: 'carearound-print-annotation-transform',
        html: `<span
            data-annotation-transform-handle="${tool}"
            title="${label}"
            style="
                display:flex;
                align-items:center;
                justify-content:center;
                width:44px;
                height:44px;
            "
        ><span style="
            box-sizing:border-box;
            display:flex;
            align-items:center;
            justify-content:center;
            width:32px;
            height:32px;
            border:3px solid #ffffff;
            border-radius:50%;
            background:${color};
            color:#ffffff;
            line-height:1;
            box-shadow:0 2px 7px rgba(15,23,42,.38);
        ">${glyph}</span></span>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
    });
}

function arePointsEqual(left = [], right = []) {
    return left.length === right.length && left.every((point, index) => (
        point[0] === right[index]?.[0] && point[1] === right[index]?.[1]
    ));
}

function stopTransformEvent(event) {
    event?.originalEvent?.preventDefault?.();
    event?.originalEvent?.stopPropagation?.();
}

function getEditablePoints(annotation) {
    return annotation.type === PRINT_ANNOTATION_TOOL_POLYGON
        ? annotation.controlPoints || annotation.points
        : annotation.points;
}

function buildPointsPatch(annotation, points) {
    return annotation.type === PRINT_ANNOTATION_TOOL_POLYGON
        ? { points, controlPoints: points }
        : { points };
}

function storesRotation(annotationType) {
    return [
        PRINT_ANNOTATION_TOOL_RECTANGLE,
        PRINT_ANNOTATION_TOOL_CIRCLE,
        PRINT_ANNOTATION_TOOL_POLYGON,
    ].includes(annotationType);
}

function buildTransformPatch(annotation, points, rotationDegrees) {
    return {
        ...buildPointsPatch(annotation, points),
        ...(storesRotation(annotation.type) ? { rotationDegrees } : {}),
    };
}

function getTransformCenter(annotation, points) {
    if (annotation.type === PRINT_ANNOTATION_TOOL_CIRCLE) {
        return points[0] || null;
    }
    return getPrintAnnotationPointBoundsCenter(points);
}

function getRotationAngle(center, point) {
    if (!center || !point) return 0;
    return Math.atan2(point[0] - center[0], point[1] - center[1]) * (180 / Math.PI);
}

function getRotationHandlePosition(map, annotation, points, center) {
    if (!center || !points.length) return center;
    const centerPoint = map.latLngToContainerPoint(center);
    const mapSize = map.getSize();
    let top;
    if (annotation.type === PRINT_ANNOTATION_TOOL_CIRCLE && points.length === 2) {
        const edgePoint = map.latLngToContainerPoint(points[1]);
        top = centerPoint.y - centerPoint.distanceTo(edgePoint);
    } else {
        const displayPoints = annotation.type === PRINT_ANNOTATION_TOOL_RECTANGLE
            ? buildPrintAnnotationRectanglePoints(points, annotation.rotationDegrees)
            : points;
        const projectedPoints = displayPoints.map(
            ([lat, lng]) => map.latLngToContainerPoint([lat, lng]),
        );
        top = Math.min(...projectedPoints.map((point) => point.y));
    }
    const handlePoint = L.point(
        Math.min(mapSize.x - 22, Math.max(22, centerPoint.x)),
        Math.min(mapSize.y - 22, Math.max(22, top - 46)),
    );
    const handleLatLng = map.containerPointToLatLng(handlePoint);
    return [handleLatLng.lat, handleLatLng.lng];
}

export default function PrintAnnotationTransformHandle({
    annotation,
    layerIndex,
    tool,
    onPreview,
    onUpdate,
}) {
    const map = useMap();
    const editablePoints = getEditablePoints(annotation);
    const rotationDegrees = normalizePrintAnnotationRotation(annotation.rotationDegrees);
    const latestEditablePointsRef = useRef(editablePoints);
    const latestRotationRef = useRef(rotationDegrees);
    const dragRef = useRef(null);
    const pendingCommittedTransformRef = useRef(null);
    const pendingPreviewRef = useRef(null);
    const previewFrameRef = useRef(null);
    const guideRef = useRef(null);
    const center = getTransformCenter(annotation, editablePoints);
    const rotationSupported = isPrintAnnotationRotationSupported(annotation.type);
    const handlePosition = tool === PRINT_ANNOTATION_TOOL_ROTATE
        ? getRotationHandlePosition(map, annotation, editablePoints, center)
        : center;
    const transformIcon = useMemo(
        () => createTransformIcon(tool, annotation.style.color),
        [annotation.style.color, tool],
    );

    useEffect(() => {
        if (dragRef.current) return;
        const pendingTransform = pendingCommittedTransformRef.current;
        if (pendingTransform && (
            !arePointsEqual(editablePoints, pendingTransform.points)
            || rotationDegrees !== pendingTransform.rotationDegrees
        )) return;
        pendingCommittedTransformRef.current = null;
        latestEditablePointsRef.current = editablePoints;
        latestRotationRef.current = rotationDegrees;
    }, [editablePoints, rotationDegrees]);

    useEffect(() => () => {
        if (previewFrameRef.current) {
            window.cancelAnimationFrame(previewFrameRef.current);
        }
    }, []);

    const buildNextTransform = useCallback((event) => {
        const drag = dragRef.current;
        if (!drag) {
            return {
                points: latestEditablePointsRef.current,
                rotationDegrees: latestRotationRef.current,
            };
        }
        const latLng = event.target.getLatLng();
        const target = [latLng.lat, latLng.lng];
        if (tool === PRINT_ANNOTATION_TOOL_MOVE) {
            return {
                points: translatePrintAnnotationPoints(drag.points, drag.center, target),
                rotationDegrees: drag.rotationDegrees,
            };
        }
        const nextAngle = getRotationAngle(drag.center, target);
        const angleDelta = nextAngle - drag.startAngle;
        const rotatesStoredGeometry = [
            PRINT_ANNOTATION_TOOL_LINE,
            PRINT_ANNOTATION_TOOL_POLYGON,
        ].includes(annotation.type);
        return {
            points: rotatesStoredGeometry
                ? rotatePrintAnnotationPoints(drag.points, drag.center, angleDelta)
                : drag.points,
            rotationDegrees: storesRotation(annotation.type)
                ? normalizePrintAnnotationRotation(drag.rotationDegrees + angleDelta)
                : drag.rotationDegrees,
        };
    }, [annotation.type, tool]);

    const queuePreview = useCallback((nextTransform, event) => {
        latestEditablePointsRef.current = nextTransform.points;
        latestRotationRef.current = nextTransform.rotationDegrees;
        pendingPreviewRef.current = nextTransform;
        if (tool === PRINT_ANNOTATION_TOOL_ROTATE) {
            const latLng = event.target.getLatLng();
            guideRef.current?.setLatLngs([
                dragRef.current?.center || center,
                [latLng.lat, latLng.lng],
            ]);
        }
        if (previewFrameRef.current) return;
        previewFrameRef.current = window.requestAnimationFrame(() => {
            previewFrameRef.current = null;
            const pendingTransform = pendingPreviewRef.current;
            pendingPreviewRef.current = null;
            if (pendingTransform) {
                onPreview?.(pendingTransform.points, pendingTransform.rotationDegrees);
            }
        });
    }, [center, onPreview, tool]);

    const finishDrag = useCallback((event) => {
        const nextTransform = buildNextTransform(event);
        if (previewFrameRef.current) {
            window.cancelAnimationFrame(previewFrameRef.current);
            previewFrameRef.current = null;
        }
        pendingPreviewRef.current = null;
        latestEditablePointsRef.current = nextTransform.points;
        latestRotationRef.current = nextTransform.rotationDegrees;
        const changed = !arePointsEqual(nextTransform.points, editablePoints)
            || nextTransform.rotationDegrees !== rotationDegrees;
        pendingCommittedTransformRef.current = changed ? nextTransform : null;
        onPreview?.(nextTransform.points, nextTransform.rotationDegrees);
        dragRef.current = null;
        if (changed) {
            onUpdate?.(annotation.id, buildTransformPatch(
                annotation,
                nextTransform.points,
                nextTransform.rotationDegrees,
            ));
        }
    }, [
        annotation,
        buildNextTransform,
        editablePoints,
        onPreview,
        onUpdate,
        rotationDegrees,
    ]);

    if (!center || (tool === PRINT_ANNOTATION_TOOL_ROTATE && !rotationSupported)) {
        return null;
    }

    return (
        <>
            {tool === PRINT_ANNOTATION_TOOL_ROTATE ? (
                <Polyline
                    ref={guideRef}
                    positions={[center, handlePosition]}
                    pathOptions={{
                        color: annotation.style.color,
                        dashArray: '4 5',
                        opacity: 0.8,
                        weight: 2,
                    }}
                    interactive={false}
                />
            ) : null}
            <Marker
                position={handlePosition}
                icon={transformIcon}
                pane="markerPane"
                draggable
                interactive
                zIndexOffset={3100 + (layerIndex * 10)}
                eventHandlers={{
                    dragstart: (event) => {
                        const points = latestEditablePointsRef.current.map((point) => [...point]);
                        const dragCenter = getTransformCenter(annotation, points);
                        const latLng = event.target.getLatLng();
                        const startPoint = [latLng.lat, latLng.lng];
                        dragRef.current = {
                            center: dragCenter,
                            points,
                            rotationDegrees: latestRotationRef.current,
                            startAngle: getRotationAngle(dragCenter, startPoint),
                        };
                    },
                    drag: (event) => queuePreview(buildNextTransform(event), event),
                    dragend: finishDrag,
                    click: stopTransformEvent,
                }}
            />
        </>
    );
}
