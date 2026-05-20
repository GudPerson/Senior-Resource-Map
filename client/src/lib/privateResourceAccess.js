export const PRIVATE_VIEWER_ALL_OPTION_VALUE = '__all_eligible_private_viewers__';

function formatPrivateViewerLabel(candidate) {
    const name = String(candidate?.name || candidate?.username || 'Unnamed user').trim();
    const username = String(candidate?.username || '').trim();
    return username ? `${name} (@${username})` : name;
}

function normalizeCandidateIds(candidates) {
    return [...new Set((candidates || [])
        .map((candidate) => Number(candidate?.id))
        .filter(Number.isInteger))];
}

export function buildPrivateViewerOptions(candidates) {
    const viewerOptions = (candidates || []).map((candidate) => ({
        value: candidate.id,
        label: formatPrivateViewerLabel(candidate),
    }));

    if (viewerOptions.length === 0) return [];

    return [
        {
            value: PRIVATE_VIEWER_ALL_OPTION_VALUE,
            label: 'All eligible read-only viewers',
            isSelectAll: true,
        },
        ...viewerOptions,
    ];
}

export function resolvePrivateViewerUserIds(selectedOptions, candidates) {
    const selected = Array.isArray(selectedOptions) ? selectedOptions : [];
    if (selected.some((option) => option?.value === PRIVATE_VIEWER_ALL_OPTION_VALUE)) {
        return normalizeCandidateIds(candidates);
    }

    return [...new Set(selected
        .map((option) => Number(option?.value))
        .filter(Number.isInteger))];
}
