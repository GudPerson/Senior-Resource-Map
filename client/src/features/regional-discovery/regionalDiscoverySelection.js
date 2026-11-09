export function createRegionalDiscoverySelection() {
    return { pane: 'list', lock: 'none', entryKey: null, placeKeys: [], returnToChooser: null, listScrollTop: 0, focusReturnKey: null };
}
const unique = values => [...new Set(values || [])];
const toList = state => ({ ...state, pane: 'list', lock: 'none', entryKey: null, placeKeys: [], returnToChooser: null });
function remember(state, event) {
    return { ...state,
        listScrollTop: Number.isFinite(event.listScrollTop) ? Math.max(0, event.listScrollTop) : state.listScrollTop,
        focusReturnKey: event.focusReturnKey ?? state.focusReturnKey,
    };
}
function pinSelection(state, event, locked) {
    const entryKeys = unique(event.entryKeys);
    if (!entryKeys.length) return state;
    const chooser = entryKeys.length > 1;
    return { ...remember(state, event), pane: chooser ? 'chooser' : 'detail',
        lock: locked ? (chooser ? 'chooser' : 'detail') : 'none',
        entryKey: chooser ? null : entryKeys[0], placeKeys: unique(event.placeKeys), returnToChooser: null };
}
function pruneSelection(state, event) {
    const visible = new Set(event.entryKeys);
    const places = key => event.placeKeysByEntryKey[key] || [];
    let next = state;
    if (state.entryKey && !visible.has(state.entryKey)) next = toList(state);
    else if (state.pane === 'chooser') {
        const keys = event.entryKeys.filter(key => places(key).some(place => state.placeKeys.includes(place)));
        const placeKeys = unique(keys.flatMap(places)).filter(place => state.placeKeys.includes(place));
        if (!keys.length) next = toList(state);
        else next = pinSelection(state, { entryKeys: keys, placeKeys }, state.lock !== 'none');
    } else if (state.entryKey) {
        next = { ...state, placeKeys: unique(places(state.entryKey)) };
        if (state.returnToChooser) {
            const entryKeys = state.returnToChooser.entryKeys.filter(key => visible.has(key)
                && places(key).some(place => state.returnToChooser.placeKeys.includes(place)));
            const placeKeys = unique(entryKeys.flatMap(places)).filter(key => state.returnToChooser.placeKeys.includes(key));
            next.returnToChooser = entryKeys.length && placeKeys.length ? { entryKeys, placeKeys } : null;
        }
    }
    // A stable reference avoids dispatch/effect cycles when visible membership is unchanged.
    return JSON.stringify(next) === JSON.stringify(state) ? state : next;
}

export function regionalDiscoverySelectionReducer(state, event) {
    switch (event.type) {
    case 'PIN_ENTER':
        return state.lock === 'none' ? pinSelection(state, event, false) : state;
    case 'PIN_LEAVE':
        return state.lock === 'none' && state.pane !== 'list'
            && (event.placeKeys || []).some(key => state.placeKeys.includes(key)) ? toList(state) : state;
    case 'PIN_ACTIVATE':
        return pinSelection(state, event, true);
    case 'ROW_ENTER':
        return state.lock === 'none' ? { ...state, pane: 'list', entryKey: event.entryKey, placeKeys: unique(event.placeKeys), returnToChooser: null } : state;
    case 'ROW_LEAVE':
        return state.lock === 'none' && state.pane === 'list' && state.entryKey === event.entryKey ? toList(state) : state;
    case 'ROW_ACTIVATE':
        return { ...remember(state, event), pane: 'list', lock: 'map', entryKey: event.entryKey, placeKeys: unique(event.placeKeys), returnToChooser: null };
    case 'VIEW_SERVICE':
        if (!event.entryKey) return state;
        return { ...remember(state, event), pane: 'detail', lock: 'detail', entryKey: event.entryKey,
            placeKeys: unique(event.placeKeys), returnToChooser: state.pane === 'chooser'
                ? { placeKeys: state.placeKeys, entryKeys: unique(event.chooserEntryKeys) } : null };
    case 'BACK':
        return state.returnToChooser ? { ...state, pane: 'chooser', lock: 'chooser', entryKey: null,
            placeKeys: state.returnToChooser.placeKeys, returnToChooser: null } : toList(state);
    case 'DISMISS':
        return toList(state);
    case 'VISIBLE_ENTRIES_CHANGED':
        return pruneSelection(state, event);
    default:
        return state;
    }
}
