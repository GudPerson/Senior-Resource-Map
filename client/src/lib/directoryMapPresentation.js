export function buildDirectoryMapClassNames({
    mapHeightClassName = 'h-[340px]',
    className = '',
    interactive = true,
} = {}) {
    return {
        frameClassName: `relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm ${mapHeightClassName} ${className}`.trim(),
        containerClassName: `carearound-map h-full min-h-0 w-full ${interactive ? '' : 'pointer-events-none cursor-default selection:bg-transparent'}`.trim(),
    };
}

const DIRECTORY_PRINT_BADGE_BASE_Z_INDEX = 100000;
const DIRECTORY_ACTIVE_MARKER_Z_INDEX = 1000000;

export function getDirectoryMarkerZIndexOffset({
    markerMode = 'count',
    isMatched = false,
    number = 0,
} = {}) {
    const normalizedNumber = Number.isFinite(Number(number))
        ? Math.max(0, Math.trunc(Number(number)))
        : 0;

    if (markerMode === 'print-badge') {
        return isMatched
            ? DIRECTORY_ACTIVE_MARKER_Z_INDEX + normalizedNumber
            : DIRECTORY_PRINT_BADGE_BASE_Z_INDEX + (normalizedNumber * 1000);
    }

    return isMatched ? DIRECTORY_PRINT_BADGE_BASE_Z_INDEX : 0;
}
