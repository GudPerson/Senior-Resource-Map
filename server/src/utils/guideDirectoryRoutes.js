export const GUIDE_SAVED_DIRECTORY_ROUTE = '/my-directory?section=saved-assets';

// Published evidence keeps its reviewed route. Only saved-list actions select
// the existing Saved Resources section when Directory opens Care Maps first.
const savedDirectoryEvidenceIds = new Set([
    'help-save', 'help-unsave', 'hidden-saved-resources', 'saved-versus-managed',
    'saved-identity-privacy', 'saved-list-privacy', 'other-account-saved-privacy',
    'saved-resource-removal', 'saved-not-eligible', 'saved-resource-status',
]);

export function guideDirectoryActionRoute(route, evidenceId) {
    return route === '/my-directory' && savedDirectoryEvidenceIds.has(evidenceId)
        ? GUIDE_SAVED_DIRECTORY_ROUTE
        : route;
}
