export const MAP_SHORT_DESCRIPTOR_DEFAULT_TEXT_COLOR = '#64748B';

export const MAP_SHORT_DESCRIPTOR_TEXT_COLORS = [
    '#0F172A',
    '#334155',
    '#64748B',
    '#0F766E',
    '#1D4ED8',
    '#7C3AED',
    '#BE123C',
    '#B45309',
];

export const MAP_SHORT_DESCRIPTOR_HIGHLIGHT_COLORS = [
    '#FEF3C7',
    '#DCFCE7',
    '#DBEAFE',
    '#EDE9FE',
    '#FCE7F3',
    '#FEE2E2',
];

export function normalizeMapShortDescriptorColor(value, fallback = null) {
    const text = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text.toUpperCase() : fallback;
}

export function normalizeMapShortDescriptorItems(row) {
    const explicitItems = Array.isArray(row?.mapShortDescriptors)
        ? row.mapShortDescriptors.map((item, index) => ({
            id: Number.isInteger(item?.id) ? item.id : null,
            text: String(item?.text || '').trim(),
            textColor: normalizeMapShortDescriptorColor(item?.textColor),
            highlightColor: normalizeMapShortDescriptorColor(item?.highlightColor),
            sortOrder: Number.isInteger(item?.sortOrder) ? item.sortOrder : index,
        })).filter((item) => item.text)
        : [];

    if (explicitItems.length > 0) {
        return explicitItems.sort((left, right) => (
            left.sortOrder - right.sortOrder || (left.id || 0) - (right.id || 0)
        ));
    }

    const legacyText = String(row?.mapShortDescriptor || '').trim();
    if (!legacyText) return [];
    return [{
        id: null,
        text: legacyText,
        textColor: normalizeMapShortDescriptorColor(row?.mapShortDescriptorTextColor),
        highlightColor: normalizeMapShortDescriptorColor(row?.mapShortDescriptorHighlightColor),
        sortOrder: 0,
    }];
}

export function getMapShortDescriptorPrintStyle(item) {
    const color = normalizeMapShortDescriptorColor(
        item?.textColor ?? item?.mapShortDescriptorTextColor,
        MAP_SHORT_DESCRIPTOR_DEFAULT_TEXT_COLOR,
    );
    const backgroundColor = normalizeMapShortDescriptorColor(
        item?.highlightColor ?? item?.mapShortDescriptorHighlightColor,
    );

    return {
        color,
        ...(backgroundColor ? {
            backgroundColor,
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
        } : {}),
    };
}
