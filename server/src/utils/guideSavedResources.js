import { Hono } from 'hono';
import { getFavorites } from '../controllers/favoritesController.js';
import { normalizeRole } from './roles.js';
import { guideSavedIdentityPrivacyFact, guideSavedMembershipRelationFact, guideProviderIdentityCheckFact,
    guideMembershipNavigationFact, guideProviderUsageLookup } from './guideProductRelations.js';

const DISPLAY_LIMIT = 6;

export function guideSavedResourceIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    // Privacy consequences are product facts, not a request to read saved names.
    if (guideSavedIdentityPrivacyFact(query) || guideSavedMembershipRelationFact(query)
        || guideProviderIdentityCheckFact(query) || guideMembershipNavigationFact(query)) return null;
    // A provider asking who saved its listing is not asking for this account's
    // own My Directory; keep that question on the reviewed usage boundary.
    if (guideProviderUsageLookup(query)) return null;
    // Downloading/exporting a saved list is a product-capability question, not
    // authorization to read this account's saved names into an answer.
    if (/\b(?:download|export|excel|spreadsheet|csv)\b/.test(query)) return null;
    // "My colleague saved" describes somebody else's owner-scoped list.
    if (/\b(?:colleague|co-?worker|team\s+member|teammate|friend|another\s+(?:user|person)|someone\s+else)(?:'s)?\s+(?:sav(?:e|ed)|has\s+saved|favo(?:u)?rites?|directory)\b/.test(query)) return null;
    if (/\bpersonal\s+places?\b|\bmy\s+places\b|\bprivate\s+planning\s+places?\b/.test(query)) return null;
    const ownsList = /\b(?:i|me|my)\b/.test(query);
    const mentionsSaved = /\b(?:saved|favo(?:u)?rites?)\b/.test(query) || /\bwhat (?:have|did) i save\b/.test(query);
    const mentionsDirectory = /\bmy directory\b/.test(query);
    if (!ownsList || !(mentionsSaved || mentionsDirectory)) return null;
    if (mentionsSaved && !mentionsDirectory && !/\b(?:resources?|places?|programmes?|programs?|services?|offerings?|favo(?:u)?rites?)\b/.test(query)
        && !/\bwhat (?:have|did) i save\b/.test(query)) return null;
    // Require a list-reading/navigation request, not just "where" or "what"
    // somewhere in a question about another saved-resource feature.
    const request = query.replace(/^please\s+/, '').replace(/^(?:can|could|would)\s+you\s+(?:please\s+)?/, '');
    if (/^(?:where\s+(?:is|are)\b|where\s+(?:do|can|should)\s+i\s+(?:see|find|view|check|open|access)\b|how\s+(?:do|can)\s+i\s+(?:find|see|view|check|open|access|get\s+to)\b|(?:open|navigate|go\s+to)\b)/.test(request)) return 'navigation';
    if (/^(?:(?:show|list|count)\b|how\s+many\b|do\s+i\s+have\b|have\s+i\s+saved\b|what\s+(?:have|did)\s+i\s+save\b)/.test(request)
        || /^(?:what|which)\s+(?:(?:are|is)\s+)?(?:my\s+)?(?:saved\s+)?(?:resources?|places?|programmes?|programs?|services?|offerings?|favo(?:u)?rites?)\b/.test(request)) return 'list';
    return null;
}

export function createGuideSavedResourceLoader({ list = getFavorites } = {}) {
    return async (actor, env) => {
        if (!actor?.id || normalizeRole(actor.role) === 'guest' || actor.isImpersonating)
            throw new Error('Saved resources are unavailable');
        const internal = new Hono();
        internal.use('*', async (c, next) => { c.set('user', actor); await next(); });
        internal.get('/saved', list);
        const response = await internal.fetch(new Request('http://guide.internal/saved'), env);
        if (!response.ok) throw new Error('Saved resources are unavailable');
        const items = await response.json();
        if (!Array.isArray(items)) throw new Error('Saved resources are unavailable');
        return {
            totalCount: items.length,
            placeCount: items.filter((item) => item.resourceType === 'hard').length,
            offeringCount: items.filter((item) => item.resourceType === 'soft').length,
            names: items.slice(0, DISPLAY_LIMIT).map((item) => ({
                name: String(item?.name || 'Saved resource').replace(/\s+/g, ' ').trim().slice(0, 120),
                unavailable: item?.status !== 'available',
            })),
        };
    };
}

export function answerGuideSavedResources({ question, actor, saved } = {}) {
    const intent = guideSavedResourceIntent(question);
    if (!intent) return null;
    if (!actor?.id || normalizeRole(actor.role) === 'guest') return {
        topicId: 'saved-resources',
        message: 'Sign in to see resources you saved in My Directory.',
        actions: [{ label: 'Sign in', route: '/login' }],
    };
    if (actor.isImpersonating) return {
        topicId: 'saved-resources',
        message: 'Exit User View to check resources saved to your own account.', actions: [],
    };
    const actions = [{ label: 'Open My Directory', route: '/my-directory' }];
    if (intent === 'navigation') return {
        topicId: 'saved-resources',
        message: 'Open My Directory to see resources you saved. Manage My Resources is a separate dashboard page for resources assigned to you to manage.',
        actions,
    };
    if (!saved) return null;
    if (!saved.totalCount) return {
        topicId: 'saved-resources',
        message: 'I found no saved resources in this account’s My Directory right now. You can save a resource from Discover using its heart.',
        actions,
    };
    const names = saved.names.map((item) => `${item.name}${item.unavailable ? ' (no longer available)' : ''}`);
    return {
        topicId: 'saved-resources',
        message: `This account has ${saved.totalCount} saved resource${saved.totalCount === 1 ? '' : 's'} in My Directory: ${saved.placeCount} Place${saved.placeCount === 1 ? '' : 's'} and ${saved.offeringCount} ${saved.offeringCount === 1 ? 'Programme/service' : 'Programmes/services'}.\nMost recently saved: ${names.join('; ')}${saved.totalCount > names.length ? '; and more' : ''}.\nOpen My Directory for the full current list. These are resources you saved, not necessarily resources you manage.`,
        actions,
    };
}
