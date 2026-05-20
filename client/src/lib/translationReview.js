function formatList(items = []) {
    const labels = [...new Set(items.filter(Boolean))];
    if (labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function buildLocaleLabelLookup(targetLocales = []) {
    return new Map((targetLocales || []).map((item) => [item.locale, item.label || item.locale]));
}

function getLocalesFromFieldRefs(fieldRefs = []) {
    return [...new Set((fieldRefs || [])
        .map((ref) => String(ref || '').split(':')[0])
        .filter(Boolean))];
}

export function buildRegenerationMessage(payload = {}) {
    const status = payload?.translationStatus?.status;
    if (status === 'not_configured') {
        return 'English was saved, but auto-translation is not configured yet.';
    }

    const labelLookup = buildLocaleLabelLookup(payload?.targetLocales || []);
    const requestedLocales = (payload?.requestedLocales || []).filter(Boolean);
    const translatedLocales = getLocalesFromFieldRefs(payload?.translationStatus?.translatedFields || []);
    const staleLocales = getLocalesFromFieldRefs(payload?.translationStatus?.staleFields || []);
    const updatedLabels = translatedLocales.map((locale) => labelLookup.get(locale) || locale);
    const staleLabels = staleLocales.map((locale) => labelLookup.get(locale) || locale);
    const requestedLabels = requestedLocales.map((locale) => labelLookup.get(locale) || locale);
    const parts = [];

    if (updatedLabels.length > 0) {
        parts.push(`Updated ${formatList(updatedLabels)}.`);
    }

    if (staleLabels.length > 0) {
        const staleList = formatList(staleLabels);
        parts.push(`${staleList} ${staleLabels.length === 1 ? 'has' : 'have'} reviewed wording to check because English changed.`);
    }

    if (parts.length === 0) {
        const subject = requestedLabels.length > 1 ? 'All selected languages' : (formatList(requestedLabels) || 'This language');
        parts.push(`${subject} already had current auto text.`);
    }

    parts.push('Please review the wording before relying on it.');
    return parts.join(' ');
}
