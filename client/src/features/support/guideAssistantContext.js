// Page labels are intentionally coarse: never forward resource IDs, map names,
// share tokens, query strings or private page contents to the Guide.
export function guidePageLabel(pathname = '') {
    if (pathname === '/help-centre' || pathname.startsWith('/help-centre/')) return 'Help Centre';
    if (pathname.startsWith('/dashboard/resources')) return 'Manage resources';
    if (pathname.startsWith('/dashboard/calendar')) return 'Care Calendar';
    if (pathname.startsWith('/my-directory/maps/')) return 'My Maps';
    if (pathname.startsWith('/my-directory')) return 'My Directory';
    if (pathname.startsWith('/resource/')) return 'Resource details';
    if (pathname.startsWith('/dashboard')) return 'Dashboard';
    if (pathname === '/discover') return 'Discover';
    return 'CareAround';
}

export function isGuideSurfaceAllowed(pathname = '', search = '') {
    return !pathname.startsWith('/shared/') && !pathname.startsWith('/governed/maps/')
        && !pathname.startsWith('/auth/transition')
        && new URLSearchParams(search).get('view') !== 'print';
}

// Optional report context uses public page families only. Never keep route IDs,
// search terms, tokens, or fragments in a handoff or browser navigation state.
export function guideReportContext(pathname = '') {
    const route = String(pathname).split(/[?#]/, 1)[0];
    const family = ['/dashboard/resources', '/dashboard/calendar', '/my-directory/maps',
        '/my-directory', '/resource', '/dashboard/profile', '/dashboard/admin', '/dashboard/support',
        '/discover', '/help-centre', '/help', '/login', '/partner-login', '/inbox'].find((base) => route === base || route.startsWith(`${base}/`));
    return { pathname: family || '/' };
}
