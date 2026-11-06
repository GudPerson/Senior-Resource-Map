import { buildSavedAssetKey } from './savedAssets.js';

export const AREA_RESOURCE_ADD_CONCURRENCY = 3;
export const AREA_RESOURCE_MAX_VENUES = 500;
const keyFor = item => buildSavedAssetKey(item.resourceType, item.resourceId);

/** Preserve pending ticks/unticks while adopting additions persisted by the area tab. */
export function mergeNewMapMembershipKeys(selectedKeys, previousMemberKeys, nextMemberKeys) {
    const previous = new Set(previousMemberKeys), next = new Set(selectedKeys);
    for (const key of nextMemberKeys) if (!previous.has(key)) next.add(key);
    return next;
}

export function getAreaResourcePlaceIds(row) {
    return [...new Set((row?.locations || []).map(location => Number(location?.id))
        .filter(id => Number.isSafeInteger(id) && id > 0))];
}

export function filterAreaResources(rows, query = '', type = 'all') {
    const search = String(query).trim().toLocaleLowerCase();
    return rows.filter(row => (type === 'all' || row.resourceType === type)
        && (!search || [row.name, ...(row.locations || []).flatMap(location =>
            [location.name, location.address, location.postalCode, location.postal_code])]
            .join(' ').toLocaleLowerCase().includes(search)));
}

function normalizeTargets(items) {
    const result = new Map();
    for (const item of items || []) {
        const resourceType = item?.resourceType;
        const resourceId = Number(item?.resourceId);
        if (!['hard', 'soft'].includes(resourceType) || !Number.isSafeInteger(resourceId) || resourceId <= 0) {
            throw new Error('Choose a valid resource.');
        }
        const ref = { resourceType, resourceId };
        if (Object.hasOwn(item, 'selectedPlaceIds')) {
            if (!Array.isArray(item.selectedPlaceIds) || !item.selectedPlaceIds.length
                || item.selectedPlaceIds.length > AREA_RESOURCE_MAX_VENUES
                || item.selectedPlaceIds.some(id => !Number.isSafeInteger(id) || id <= 0)) {
                throw new Error('Choose at least one supported location (up to 500).');
            }
            ref.selectedPlaceIds = [...new Set(item.selectedPlaceIds)];
        }
        if (!result.has(keyFor(ref))) result.set(keyFor(ref), ref);
    }
    return [...result.values()];
}

/** Additive only. Dependencies intentionally expose no remove/toggle operation. */
export async function runAreaResourceAddition({ items, getMap, getSaved, ensureSaved, addToMap,
    shouldStop = () => false, isCurrent = () => true, onProgress = () => {}, concurrency = AREA_RESOURCE_ADD_CONCURRENCY }) {
    const targets = normalizeTargets(items);
    if (!isCurrent()) throw new Error('The active map changed. Reopen the map before adding resources.');
    const initialMap = await getMap();
    if (initialMap?.viewer?.isOwner !== true || !Array.isArray(initialMap.assets)) throw new Error('Refresh your Care Map before adding resources.');
    const initialKeys = new Set(initialMap.assets.map(keyFor));
    const states = targets.map(ref => ({ ...ref, assetKey: keyFor(ref), status: initialKeys.has(keyFor(ref)) ? 'already_on_map' : 'not_started' }));
    let cursor = 0, rateLimited = false;
    const emit = () => onProgress(states.map(row => ({ ...row })));
    emit();
    async function worker() {
        while (cursor < targets.length && !shouldStop() && isCurrent() && !rateLimited) {
            const index = cursor++, ref = targets[index], state = states[index];
            if (state.status === 'already_on_map') continue;
            try {
                state.status = 'saving'; emit();
                state.mutationPhase = 'save';
                const saved = await ensureSaved({ resourceType: ref.resourceType, resourceId: ref.resourceId });
                if (saved?.saved !== true) throw new Error('The save could not be confirmed.');
                state.status = 'saved_not_added'; emit();
                state.mutationPhase = 'saved';
                if (shouldStop() || !isCurrent() || rateLimited) continue;
                state.status = 'adding'; emit();
                state.mutationPhase = 'add';
                await addToMap(ref);
                state.status = 'confirming';
            } catch (error) {
                state.error = error?.message || 'Could not confirm this resource.';
                if (error?.status === 409) state.membershipConflict = true;
                if (error?.status === 429) rateLimited = true;
                if (!Number.isInteger(error?.status) || error.status >= 500) state.uncertainPhase = state.mutationPhase;
                state.status = 'confirming';
            }
            emit();
        }
    }
    await Promise.all(Array.from({ length: Math.max(1, Math.min(AREA_RESOURCE_ADD_CONCURRENCY, Number(concurrency) || 1, targets.length)) }, worker));
    if (!isCurrent()) return { items: states.map(row => ({ ...row, status: row.status === 'not_started' ? 'not_started' : 'unknown' })), reconciled: false, map: null };
    // Reconcile accepted/unknown requests; cancellation never means accepted work was undone.
    const [mapRead, savedRead] = await Promise.allSettled([getMap({ reconcile: true }), getSaved({ reconcile: true })]);
    const map = mapRead.status === 'fulfilled' ? mapRead.value : null;
    const saved = savedRead.status === 'fulfilled' && Array.isArray(savedRead.value) ? savedRead.value : null;
    const membership = map?.viewer?.isOwner === true && Array.isArray(map.assets) ? new Set(map.assets.map(keyFor)) : null;
    const savedKeys = saved ? new Set(saved.map(keyFor)) : null;
    for (const state of states) {
        if (membership?.has(state.assetKey)) state.status = initialKeys.has(state.assetKey) || state.membershipConflict ? 'already_on_map' : 'added';
        else if (state.status === 'already_on_map') state.status = 'unknown';
        else if (!membership || !savedKeys) state.status = state.status === 'not_started' ? 'not_started' : 'unknown';
        else if (state.uncertainPhase === 'add') state.status = 'unknown';
        else if (savedKeys.has(state.assetKey)) state.status = 'saved_not_added';
        else if (state.uncertainPhase === 'save') state.status = 'unknown';
        else state.status = state.status === 'not_started' ? 'not_started' : 'failed';
    }
    emit();
    return { items: states, reconciled: Boolean(membership && savedKeys), map, savedAssets: saved, rateLimited };
}
