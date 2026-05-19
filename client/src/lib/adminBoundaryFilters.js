const BOUNDARY_STATUS_FILTER_OPTIONS = [
    { value: 'inside', label: 'Inside boundary' },
    { value: 'outside', label: 'Outside boundary' },
    { value: 'missing-postal', label: 'Missing postal code' },
    { value: 'no-location', label: 'No linked location' },
    { value: 'no-boundary', label: 'No boundary set' },
];

const BOUNDARY_STATUS_VALUES = new Set(BOUNDARY_STATUS_FILTER_OPTIONS.map((option) => option.value));

export function buildBoundaryStatusFilterOptions(rows = [], getStatus = (row) => row?.boundaryStatus) {
    const activeStatuses = new Set(
        rows
            .map((row) => getStatus(row))
            .filter((status) => BOUNDARY_STATUS_VALUES.has(status))
    );

    return [
        { value: 'all', label: 'All boundary status' },
        ...BOUNDARY_STATUS_FILTER_OPTIONS.filter((option) => activeStatuses.has(option.value)),
    ];
}

export function normalizeBoundaryStatusFilterValue(value, options = []) {
    return options.some((option) => option.value === value) ? value : 'all';
}
