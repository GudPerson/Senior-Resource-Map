import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeCareMapBearing } from '../lib/careMapGestureState.js';

// Viewing angle belongs to this route/view session, never its saved design.
export function useCareMapGestures({ scopeKey, paused = false }) {
    const [session, setSession] = useState(() => ({ scopeKey, bearing: 0 }));
    const onBearingChange = useCallback((value) => {
        const bearing = normalizeCareMapBearing(value);
        setSession(current => current.scopeKey === scopeKey && current.bearing === bearing
            ? current : { scopeKey, bearing });
    }, [scopeKey]);
    useEffect(() => {
        if (paused) onBearingChange(0);
    }, [onBearingChange, paused]);
    const bearing = paused || session.scopeKey !== scopeKey ? 0 : session.bearing;
    return useMemo(() => ({ bearing, onBearingChange, paused }), [bearing, onBearingChange, paused]);
}
