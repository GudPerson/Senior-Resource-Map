export const MY_MAP_CATEGORY_ORDER_LIMIT = 500;

export function normalizeMyMapCategoryKey(value) {
    return String(value || '').trim().toLowerCase();
}

export function normalizeMyMapCategoryOrder(value) {
    let rawOrder = value;
    if (typeof rawOrder === 'string') {
        try {
            rawOrder = JSON.parse(rawOrder);
        } catch {
            rawOrder = [];
        }
    }

    const order = [];
    const seen = new Set();
    for (const valueItem of Array.isArray(rawOrder) ? rawOrder : []) {
        const key = normalizeMyMapCategoryKey(valueItem);
        if (!key || seen.has(key)) continue;
        order.push(key);
        seen.add(key);
        if (order.length >= MY_MAP_CATEGORY_ORDER_LIMIT) break;
    }
    return order;
}
