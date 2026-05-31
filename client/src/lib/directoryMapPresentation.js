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
