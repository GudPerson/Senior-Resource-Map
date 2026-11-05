import { distanceMeters, isSpatialCoordinate } from '../../../shared/addressSnapshotSpatial.js';

export const MAP_MEASUREMENT_KINDS = Object.freeze(['distance', 'radius']);

// Measurements deliberately have no annotation id or serialization/save path.
export function createMapMeasurement(kind = 'distance') {
    return { kind: MAP_MEASUREMENT_KINDS.includes(kind) ? kind : 'distance', points: [] };
}

export function appendMapMeasurementPoint(measurement, point) {
    if (!isSpatialCoordinate(point) || measurement.points.length >= 2) return measurement;
    return { ...measurement, points: [...measurement.points, [...point]] };
}

export function mapMeasurementGeometry(measurement, previewPoint = null) {
    const points = measurement.points.length === 1 && isSpatialCoordinate(previewPoint)
        ? [...measurement.points, previewPoint] : measurement.points;
    return {
        kind: measurement.kind,
        points,
        complete: measurement.points.length === 2,
        meters: points.length === 2 ? distanceMeters(points[0], points[1]) : null,
    };
}
