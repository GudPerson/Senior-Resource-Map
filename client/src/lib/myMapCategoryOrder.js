export const MY_MAP_CATEGORY_ORDER_LIMIT = 500;

export function normalizeMyMapCategoryKey(value) {
    return String(value || '').trim().toLowerCase();
}

export function normalizeMyMapCategoryOrder(value) {
    const order = [];
    const seen = new Set();
    for (const item of Array.isArray(value) ? value : []) {
        const key = normalizeMyMapCategoryKey(item);
        if (!key || seen.has(key)) continue;
        order.push(key);
        seen.add(key);
        if (order.length >= MY_MAP_CATEGORY_ORDER_LIMIT) break;
    }
    return order;
}

export function buildMyMapCategoryRank(value) {
    return new Map(
        normalizeMyMapCategoryOrder(value).map((key, index) => [key, index]),
    );
}

export function collectMyMapCategoryOptions(presentation) {
    const options = [];
    const seen = new Set();
    for (const group of presentation?.displayGroups || []) {
        const label = String(group?.categoryLabel || '').trim();
        const key = normalizeMyMapCategoryKey(group?.categorySortKey || label);
        if (!key || !label || seen.has(key)) continue;
        options.push({
            key,
            label,
            color: group.categoryColor || null,
            iconUrl: group.categoryIconUrl || null,
            iconKey: group.categoryIconKey || null,
        });
        seen.add(key);
    }
    return options;
}

export function moveMyMapCategory(options, fromIndex, toIndex) {
    if (!Array.isArray(options)) return [];
    if (
        !Number.isInteger(fromIndex)
        || !Number.isInteger(toIndex)
        || fromIndex < 0
        || fromIndex >= options.length
        || toIndex < 0
        || toIndex >= options.length
        || fromIndex === toIndex
    ) {
        return [...options];
    }

    const next = [...options];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
}
