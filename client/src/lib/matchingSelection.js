export function getMatchingSelectionState(selectedKeys, matchingKeys) {
    const matches = matchingKeys instanceof Set ? matchingKeys : new Set(matchingKeys);
    const matchingCount = matches.size;
    let selectedMatchingCount = 0;
    const [smaller, larger] = selectedKeys.size < matchingCount ? [selectedKeys, matches] : [matches, selectedKeys];
    for (const key of smaller) if (larger.has(key)) selectedMatchingCount++;
    return {
        matchingCount, selectedMatchingCount,
        checked: matchingCount > 0 && selectedMatchingCount === matchingCount,
        mixed: selectedMatchingCount > 0 && selectedMatchingCount < matchingCount,
    };
}

export function updateMatchingSelection(selectedKeys, matchingKeys, checked) {
    const next = new Set(selectedKeys);
    for (const key of matchingKeys) {
        if (checked) next.add(key);
        else next.delete(key);
    }
    return next;
}
