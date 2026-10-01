import { Hono } from 'hono';
import { getCalendar } from '../controllers/calendarController.js';
import { normalizeRole } from './roles.js';

const DISPLAY_LIMIT = 5;
const MY_PLANS_ROUTE = '/dashboard/calendar?section=plans';

export function guidePlansIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    // Provider questions about other people's plans are never this account's list.
    if (/\b(?:who|which\s+people|how\s+many|people|members|users|attendees|visitors)\b/.test(query)
        && /\b(?:programmes?|programs?|services?|offerings?|activities?)\b/.test(query)) return null;
    if (!/\b(?:my|i|me)\b/.test(query)
        || !/\bmy (?:upcoming |future |next )?plans\b|\bplans? (?:do i|have i) have\b/.test(query)) return null;
    if (/\b(?:where|open|go to|navigate|find|how do i see)\b/.test(query)) return 'navigation';
    if (/\b(?:what|which|list|show|any|have|count|many|upcoming|next)\b/.test(query)) return 'list';
    return null;
}

export function createGuidePlansLoader({ calendar = getCalendar } = {}) {
    return async (actor, env) => {
        if (!actor?.id || normalizeRole(actor.role) === 'guest' || actor.isImpersonating)
            throw new Error('My Plans are unavailable');
        const internal = new Hono();
        internal.use('*', async (c, next) => { c.set('user', actor); await next(); });
        internal.get('/plans', calendar);
        const response = await internal.fetch(new Request('http://guide.internal/plans?scope=plans'), env);
        if (!response.ok) throw new Error('My Plans are unavailable');
        const payload = await response.json();
        if (!Array.isArray(payload?.personalItems) || !payload?.range?.from || !payload?.range?.to)
            throw new Error('My Plans are unavailable');
        const items = payload.personalItems.filter((item) =>
            (item?.itemType === 'planned_session' || item?.itemType === 'map_note')
            && Number.isFinite(new Date(item.startsAt).getTime()))
            .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt));
        const sessions = items.filter((item) => item.itemType === 'planned_session');
        const notes = items.filter((item) => item.itemType === 'map_note');
        return {
            from: payload.range.from,
            to: payload.range.to,
            totalCount: items.length,
            sessionCount: sessions.length,
            noteCount: notes.length,
            sessions: sessions.slice(0, DISPLAY_LIMIT).map((item) => ({
                title: String(item.title || 'Planned session').replace(/\s+/g, ' ').trim().slice(0, 120),
                startsAt: item.startsAt,
                status: ['planned', 'completed', 'cancelled'].includes(item.status) ? item.status : 'unknown',
                needsReview: Boolean(item.needsReview),
            })),
        };
    };
}

export function answerGuidePlans({ question, actor, plans } = {}) {
    const intent = guidePlansIntent(question);
    if (!intent) return null;
    if (!actor?.id || normalizeRole(actor.role) === 'guest') return {
        topicId: 'my-plans', message: 'Sign in to check your own My Plans in Care Calendar.',
        actions: [{ label: 'Sign in', route: '/login' }],
    };
    if (actor.isImpersonating) return {
        topicId: 'my-plans', message: 'Exit User View to check your own My Plans.', actions: [],
    };
    const actions = [{ label: 'Open My Plans', route: MY_PLANS_ROUTE }];
    if (intent === 'navigation') return {
        topicId: 'my-plans', message: 'Open Care Calendar and choose My Plans to see sessions you planned and dated My Map notes.', actions,
    };
    if (!plans) return null;
    if (!plans.totalCount) return {
        topicId: 'my-plans', message: 'I found no personal plans in this account over the next 60 days. Open My Plans to check a wider date range or earlier plans. Saving a Programme/service alone does not add a session to My Plans.', actions,
    };
    const date = (value) => new Intl.DateTimeFormat('en-SG', {
        timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date(value));
    const names = plans.sessions.map((item) => `${item.title} (${date(item.startsAt)}${item.status !== 'planned' ? `, ${item.status}` : ''}${item.needsReview ? ', check schedule update' : ''})`);
    return {
        topicId: 'my-plans',
        message: `This account has ${plans.totalCount} personal plan${plans.totalCount === 1 ? '' : 's'} over the next 60 days: ${plans.sessionCount} planned session${plans.sessionCount === 1 ? '' : 's'} and ${plans.noteCount} dated My Map note${plans.noteCount === 1 ? '' : 's'}. ${names.length ? `Sessions: ${names.join('; ')}${plans.sessionCount > names.length ? '; and more' : ''}. ` : ''}Open My Plans for the full list and current schedule details. A plan is not a provider booking or registration.`,
        actions,
    };
}
