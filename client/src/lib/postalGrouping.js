function normalizeCoordinate(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePostalCode(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 6);
    return digits.length === 6 ? digits : '';
}

export function extractPostalCodeFromAddress(address) {
    if (!address) return '';
    const match = String(address).match(/\b(?:singapore\s*)?(\d{6})\b/i);
    return normalizePostalCode(match?.[1] || '');
}

export function resolvePostalGroupCode(candidate = {}) {
    return normalizePostalCode(
        candidate.postalCode
        || candidate.postal_code
        || candidate.placeAsset?.postalCode
        || candidate.placeAsset?.postal_code
        || candidate.place?.postalCode
        || candidate.place?.postal_code
        || extractPostalCodeFromAddress(candidate.address)
        || extractPostalCodeFromAddress(candidate.placeAsset?.address)
        || extractPostalCodeFromAddress(candidate.place?.address)
    );
}

export function createPostalGroupKey(postalCode) {
    const normalized = normalizePostalCode(postalCode);
    return normalized ? `postal-group:${normalized}` : '';
}

export function computePostalGroupAnchor(items = []) {
    const validItems = items.filter((item) => (
        normalizeCoordinate(item?.lat) !== null
        && normalizeCoordinate(item?.lng) !== null
    ));

    if (!validItems.length) {
        return { lat: null, lng: null };
    }

    const { latTotal, lngTotal } = validItems.reduce((accumulator, item) => ({
        latTotal: accumulator.latTotal + normalizeCoordinate(item.lat),
        lngTotal: accumulator.lngTotal + normalizeCoordinate(item.lng),
    }), { latTotal: 0, lngTotal: 0 });

    return {
        lat: latTotal / validItems.length,
        lng: lngTotal / validItems.length,
    };
}

export function groupItemsByPostalCode(items = [], {
    getItemKey = (item) => item?.id,
    resolvePostalCode = (item) => resolvePostalGroupCode(item),
} = {}) {
    const groupsByPostalCode = new Map();
    const itemGroupKeyByItemKey = new Map();
    const orderedGroups = [];

    items.forEach((item) => {
        const itemKey = getItemKey(item);
        if (!itemKey) return;

        const postalCode = resolvePostalCode(item);
        if (!postalCode) {
            const fallbackKey = String(itemKey);
            itemGroupKeyByItemKey.set(String(itemKey), fallbackKey);
            orderedGroups.push({
                postalCode: '',
                postalGroupKey: fallbackKey,
                isPostalGroup: false,
                members: [item],
            });
            return;
        }

        const groupKey = createPostalGroupKey(postalCode);
        let group = groupsByPostalCode.get(groupKey);
        if (!group) {
            group = {
                postalCode,
                postalGroupKey: groupKey,
                isPostalGroup: false,
                members: [],
            };
            groupsByPostalCode.set(groupKey, group);
            orderedGroups.push(group);
        }

        group.members.push(item);
        itemGroupKeyByItemKey.set(String(itemKey), groupKey);
    });

    orderedGroups.forEach((group) => {
        group.isPostalGroup = group.postalCode && group.members.length > 1;
    });

    return {
        groups: orderedGroups,
        itemGroupKeyByItemKey,
    };
}
