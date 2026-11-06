import { useLayoutEffect, useReducer } from 'react';
import { createRegionalDiscoverySelection, regionalDiscoverySelectionReducer } from './regionalDiscoverySelection.js';

/** Local presentation only: no API, profile, postal persistence, or geolocation. */
export default function useRegionalDiscoverySelection(presentation) {
    const [selection, dispatch] = useReducer(regionalDiscoverySelectionReducer, undefined, createRegionalDiscoverySelection);
    useLayoutEffect(() => {
        dispatch({ type: 'VISIBLE_ENTRIES_CHANGED', entryKeys: presentation.entries.map(entry => entry.entryKey),
            placeKeysByEntryKey: Object.fromEntries(presentation.entries.map(entry => [entry.entryKey, entry.pinPlaceKeys])) });
    }, [presentation]);
    return { selection, dispatch };
}
