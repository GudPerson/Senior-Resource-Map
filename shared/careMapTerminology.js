// Display terminology only. Authoring sources, routing identities and review
// evidence retain their original values; retrieval keeps the former aliases.
const displayFields = new Set([
    'title', 'summary', 'message', 'label', 'actionLabel', 'caption', 'alt',
    'transcript', 'guideMessage', 'paragraphs', 'steps', 'notes',
]);
const aliasFields = new Set(['keywords', 'queryRequiresAny']);
const sourceFields = new Set(['review', 'evidence']);

export function careMapDisplayText(value) {
    return typeof value === 'string' ? value.replace(/\b(?:My Maps?|my maps?)\b/g, match => (
        match.startsWith('My') ? match.replace('My', 'Care') : match.replace('my', 'care')
    )) : value;
}

function aliases(values) {
    return [...new Set([
        ...values,
        ...values.filter(value => typeof value === 'string').map(careMapDisplayText),
    ])];
}

export function normalizeCareMapTerminology(value) {
    function visit(current, field, preserveSource = false) {
        if (Array.isArray(current)) {
            if (!preserveSource && aliasFields.has(field)) return aliases(current);
            return current.map(item => visit(item, field, preserveSource));
        }
        if (current && typeof current === 'object') {
            return Object.fromEntries(Object.entries(current).map(([key, item]) => [
                key, visit(item, key, preserveSource || sourceFields.has(key)),
            ]));
        }
        return !preserveSource && typeof current === 'string' && displayFields.has(field)
            ? careMapDisplayText(current)
            : current;
    }
    return visit(value);
}
