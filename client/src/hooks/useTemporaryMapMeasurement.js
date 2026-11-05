import { useCallback, useEffect, useState } from 'react';
import { appendMapMeasurementPoint, createMapMeasurement } from '../lib/mapMeasurement.js';

export default function useTemporaryMapMeasurement({ enabled, mapId, scopeKey = '' }) {
    const [measurement, setMeasurement] = useState(createMapMeasurement);
    const clear = useCallback(() => setMeasurement(current => createMapMeasurement(current.kind)), []);
    const chooseKind = useCallback(kind => setMeasurement(createMapMeasurement(kind)), []);
    const addPoint = useCallback(point => setMeasurement(current => appendMapMeasurementPoint(current, point)), []);
    useEffect(() => { clear(); }, [clear, enabled, mapId, scopeKey]);
    return { measurement, clear, chooseKind, addPoint,
        hasMeasurement: enabled && measurement.points.length > 0 };
}
