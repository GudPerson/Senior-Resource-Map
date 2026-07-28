export function normalizeResourceSearchText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[()[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function parseResourceSearchGroups(value) {
    const groupSeen = new Set();
    const groups = [];

    for (const rawGroup of String(value || '').split('/')) {
        const phraseSeen = new Set();
        const phrases = rawGroup
            .split(',')
            .map((phrase) => normalizeResourceSearchText(phrase))
            .filter((phrase) => {
                if (!phrase || phraseSeen.has(phrase)) return false;
                phraseSeen.add(phrase);
                return true;
            });

        if (phrases.length === 0) continue;

        const groupKey = phrases.join(' && ');
        if (groupSeen.has(groupKey)) continue;
        groupSeen.add(groupKey);
        groups.push(phrases);
    }

    return groups;
}

export function buildResourceSearchTerms(terms) {
    return terms
        .flatMap((term) => (Array.isArray(term) ? term : [term]))
        .map((term) => normalizeResourceSearchText(term))
        .filter(Boolean);
}

export function matchesResourceSearchGroups(terms, groups) {
    if (groups.length === 0) return true;
    const normalizedTerms = buildResourceSearchTerms(terms);
    return groups.some((group) => group.every((phrase) => normalizedTerms.some((term) => term.includes(phrase))));
}
