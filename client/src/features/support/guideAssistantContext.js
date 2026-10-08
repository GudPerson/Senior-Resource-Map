import { translateUi } from '../../lib/i18n.js';

// Page labels are intentionally coarse: never forward resource IDs, map names,
// share tokens, query strings or private page contents to the Guide.
export function guidePageLabel(pathname = '') {
    if (pathname === '/help-centre' || pathname.startsWith('/help-centre/')) return 'Help Centre';
    if (pathname.startsWith('/dashboard/resources')) return 'Manage resources';
    if (pathname.startsWith('/dashboard/calendar')) return 'Care Calendar';
    if (pathname.startsWith('/my-directory/maps/')) return 'Care Maps';
    if (pathname.startsWith('/my-directory')) return 'My Directory';
    if (pathname.startsWith('/resource/')) return 'Resource details';
    if (pathname.startsWith('/dashboard')) return 'Dashboard';
    if (pathname === '/discover') return 'Discover';
    return 'CareAround';
}

// Translate display copy without changing the coarse English server context.
export function guidePageCaption(pageLabel = '', locale = 'en') {
    const displayLabel = ['Care Maps', 'My Maps'].includes(pageLabel)
        ? translateUi(locale, 'myMaps') : pageLabel;
    return pageLabel ? translateUi(locale, 'guideCurrentPage', { page: displayLabel })
        : translateUi(locale, 'guideHelpWithCareAround');
}

// Keep the established server family alias separate from current display copy.
export function guideRequestPageContext(pageLabel = '') {
    return pageLabel === 'Care Maps' ? 'My Maps' : pageLabel || 'CareAround';
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
