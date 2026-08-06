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
    PRINT_ANNOTATION_TOOL_MOVE,
    PRINT_ANNOTATION_TOOL_POLYGON,
    PRINT_ANNOTATION_TOOL_ROTATE,
    getPrintAnnotationPointBoundsCenter,
    isPrintAnnotationRotationSupported,
    rotatePrintAnnotationPoints,
    translatePrintAnnotationPoints,
} from '../lib/printAnnotations.js';

function createTransformIcon(tool, color) {
    const label = tool === PRINT_ANNOTATION_TOOL_ROTATE ? 'Rotate annotation' : 'Move annotation';
    const glyph = tool === PRINT_ANNOTATION_TOOL_ROTATE ? '&#8635;' : '&#10021;';
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
            width:30px;
            height:30px;
            border:3px solid #ffffff;
            border-radius:50%;
            background:${color};
            color:#ffffff;
            font-size:18px;
            font-weight:900;
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

function getRotationHandlePosition(map, points, center) {
    if (!center || !points.length) return center;
    const projectedPoints = points.map(([lat, lng]) => map.latLngToContainerPoint([lat, lng]));
    const centerPoint = map.latLngToContainerPoint(center);
    const mapSize = map.getSize();
    const top = Math.min(...projectedPoints.map((point) => point.y));
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
    const latestEditablePointsRef = useRef(editablePoints);
    const dragRef = useRef(null);
    const pendingCommittedPointsRef = useRef(null);
    const pendingPreviewRef = useRef(null);
    const previewFrameRef = useRef(null);
    const guideRef = useRef(null);
    const center = getTransformCenter(annotation, editablePoints);
    const rotationSupported = isPrintAnnotationRotationSupported(annotation.type);
    const handlePosition = tool === PRINT_ANNOTATION_TOOL_ROTATE
        ? getRotationHandlePosition(map, editablePoints, center)
        : center;
    const transformIcon = useMemo(
        () => createTransformIcon(tool, annotation.style.color),
        [annotation.style.color, tool],
    );

    useEffect(() => {
        if (dragRef.current) return;
        const pendingCommittedPoints = pendingCommittedPointsRef.current;
        if (pendingCommittedPoints && !arePointsEqual(
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

    const buildNextPoints = useCallback((event) => {
        const drag = dragRef.current;
        if (!drag) return latestEditablePointsRef.current;
        const latLng = event.target.getLatLng();
        const target = [latLng.lat, latLng.lng];
        if (tool === PRINT_ANNOTATION_TOOL_MOVE) {
            return translatePrintAnnotationPoints(drag.points, drag.center, target);
        }
        const nextAngle = getRotationAngle(drag.center, target);
        return rotatePrintAnnotationPoints(
            drag.points,
            drag.center,
            nextAngle - drag.startAngle,
        );
    }, [tool]);

    const queuePreview = useCallback((nextPoints, event) => {
        latestEditablePointsRef.current = nextPoints;
        pendingPreviewRef.current = nextPoints;
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
            const pendingPoints = pendingPreviewRef.current;
            pendingPreviewRef.current = null;
            if (pendingPoints) onPreview?.(pendingPoints);
        });
    }, [center, onPreview, tool]);

    const finishDrag = useCallback((event) => {
        const nextPoints = buildNextPoints(event);
        if (previewFrameRef.current) {
            window.cancelAnimationFrame(previewFrameRef.current);
            previewFrameRef.current = null;
        }
        pendingPreviewRef.current = null;
        latestEditablePointsRef.current = nextPoints;
        pendingCommittedPointsRef.current = arePointsEqual(nextPoints, editablePoints)
            ? null
            : nextPoints;
        onPreview?.(nextPoints);
        dragRef.current = null;
        if (!arePointsEqual(nextPoints, editablePoints)) {
            onUpdate?.(annotation.id, buildPointsPatch(annotation, nextPoints));
        }
    }, [annotation, buildNextPoints, editablePoints, onPreview, onUpdate]);

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
                            startAngle: getRotationAngle(dragCenter, startPoint),
                        };
                    },
                    drag: (event) => queuePreview(buildNextPoints(event), event),
                    dragend: finishDrag,
                    click: stopTransformEvent,
                }}
            />
        </>
    );
}
