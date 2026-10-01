import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { userPersonalPlaces } from '../db/schema.js';
import { normalizeRole } from './roles.js';

const DISPLAY_LIMIT = 6;
const MY_PLACES_ROUTE = '/my-directory?section=my-places';

export function guidePersonalPlaceIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!/\b(?:my|i|me)\b/.test(query)
        || !/\b(?:personal\s+places?|my\s+places|planning\s+locations?)\b/.test(query)
        || /^what (?:is|are) my places\??$/.test(query)) return null;
    if (/\b(?:where|open|go to|navigate|find)\b/.test(query)) return 'navigation';
    if (/\b(?:list|show|which|how many|count|any|have|created|added)\b/.test(query)) return 'list';
    return null;
}

async function listOwnedPersonalPlaceNames(actor, env) {
    const db = getDb(env);
    return db.query.userPersonalPlaces.findMany({
        columns: { name: true },
        where: eq(userPersonalPlaces.userId, actor.id),
        orderBy: [asc(userPersonalPlaces.name), asc(userPersonalPlaces.id)],
    });
}

export function createGuidePersonalPlaceLoader({ list = listOwnedPersonalPlaceNames } = {}) {
    return async (actor, env) => {
        if (!actor?.id || normalizeRole(actor.role) === 'guest' || actor.isImpersonating)
            throw new Error('My Places are unavailable');
        const rows = await list(actor, env);
        if (!Array.isArray(rows)) throw new Error('My Places are unavailable');
        return { totalCount: rows.length,
            names: rows.slice(0, DISPLAY_LIMIT).map((row) => String(row?.name || '')
                .replace(/\s+/g, ' ').trim().slice(0, 120)).filter(Boolean) };
    };
}

export function answerGuidePersonalPlaces({ question, actor, places } = {}) {
    const intent = guidePersonalPlaceIntent(question);
    if (!intent) return null;
    if (!actor?.id || normalizeRole(actor.role) === 'guest') return {
        topicId: 'personal-places', message: 'Sign in to see private planning locations in My Places.',
        actions: [{ label: 'Sign in', route: '/login' }],
    };
    if (actor.isImpersonating) return {
        topicId: 'personal-places', message: 'Exit User View to check your own My Places.', actions: [],
    };
    const actions = [{ label: 'Open My Places', route: MY_PLACES_ROUTE }];
    if (intent === 'navigation') return {
        topicId: 'personal-places',
        message: 'Open My Directory and choose My Places to see your private planning locations. They are separate from public Places and resources assigned to manage.',
        actions,
    };
    if (!places) return null;
    if (!places.totalCount) return {
        topicId: 'personal-places',
        message: 'I found no personal places in this account right now. Open My Places to add a private planning location.', actions,
    };
    return {
        topicId: 'personal-places',
        message: `This account has ${places.totalCount} personal place${places.totalCount === 1 ? '' : 's'} in My Places: ${places.names.join('; ')}${places.totalCount > places.names.length ? '; and more' : ''}. Open My Places for the full current list. These are private planning locations, not public Places or resources assigned to manage.`,
        actions,
    };
}
