function normalizeText(value) {
    return (value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
}

export function normalizeAreaAddressQuery(value) {
    const text = normalizeText(value);
    return text ? text.split(' ') : [];
}

export function createAreaAddressSearchIndex(rows) {
    return rows.map(row => {
        const building = normalizeText(row.building);
        const text = [building === 'nil' ? '' : building, normalizeText(row.roadName),
            normalizeText(row.address), row.postalCode].join(' ');
        return { row, text };
    });
}

export function filterAreaAddressSearchIndex(index, terms) {
    const postalTerms = terms.filter(term => /^\d{6}$/.test(term));
    const textTerms = terms.filter(term => !/^\d{6}$/.test(term));
    const matches = [];
    for (const { row, text } of index) {
        if (postalTerms.every(term => term === row.postalCode) && textTerms.every(term => text.includes(term))) {
            matches.push(row);
        }
    }
    return matches;
}
