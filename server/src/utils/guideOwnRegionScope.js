import { inArray } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { subregions } from '../db/schema.js';
import { normalizeAdminRegionScopeIds } from './adminRegionScope.js';
import { normalizeRole } from './roles.js';

const MAX_DISPLAYED_SUBREGIONS = 20;
const MAX_DISPLAYED_LABEL_CHARS = 1050;

export function guideOwnRegionScopeIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!/\b(?:region\s+scope|subregions?)\b/.test(query)) return false;
    const asksForOwnScope = /\bmy\b/.test(query)
        || /\b(?:am i assigned|assigned to me|do i (?:manage|administer|have)|which subregions? (?:can|do) i (?:manage|administer))\b/.test(query);
    if (!asksForOwnScope) return false;
    // The account fact is exclusively about the authenticated actor.
    return !/\b(?:another|other|colleague|co-?worker|someone\s+else|their|his|her|person|user\s+\d+)\b/.test(query)
        && !/\b[A-Za-z]{3,}['’]s\s+(?:admin\s+)?(?:region\s+scope|subregions?)\b/i.test(question);
}

export function createGuideOwnRegionScopeLoader({ dbFor = getDb } = {}) {
    return async (actor, env) => {
        if (normalizeRole(actor?.role) !== 'regional_admin' || actor?.isImpersonating)
            throw new Error('Own Admin Region Scope is unavailable.');
        const ids = normalizeAdminRegionScopeIds(actor.subregionIds || []);
        if (!ids.length) return [];
        const db = dbFor(env);
        return db.select({ id: subregions.id, name: subregions.name,
            code: subregions.subregionCode }).from(subregions)
            .where(inArray(subregions.id, ids));
    };
}

export function answerGuideOwnRegionScope(actor, rows) {
    const base = { topicId: 'own-region-scope', answerSource: 'account' };
    const actions = [{ label: 'Open dashboard', route: '/dashboard' }];
    if (!actor?.id || normalizeRole(actor.role) === 'guest') return { ...base,
        message: 'Sign in to check your own Admin Region Scope. The Guide cannot show another person’s assignment.',
        actions: [{ label: 'Sign in', route: '/login' }] };
    if (actor.isImpersonating) return { ...base,
        message: 'Exit User View before checking your own Admin Region Scope. The Guide cannot show another person’s assignment in chat.',
        actions };
    const role = normalizeRole(actor.role);
    if (role === 'super_admin') return { ...base,
        message: 'This is a Super Admin account. Its administrative access is not limited to an assigned Admin Region Scope. The Guide cannot show or change another Admin’s assignment in chat.',
        actions };
    if (role !== 'regional_admin') return { ...base,
        message: 'This account is not an Admin with an assigned Admin Region Scope. A Place staff or organisation role does not by itself assign Admin Subregions.',
        actions };
    if (!Array.isArray(rows)) return null;
    const ids = normalizeAdminRegionScopeIds(actor.subregionIds || []);
    if (!ids.length) return { ...base,
        message: 'This Admin account currently has no assigned Subregions in its live account scope. The Guide cannot infer access to a particular Subregion or edit rights over a Place from the Admin title alone.',
        actions };
    const byId = new Map();
    for (const row of rows) {
        if (!ids.includes(row?.id) || typeof row.name !== 'string' || !row.name.trim()
            || byId.has(row.id)) throw new Error('Invalid own Region Scope result.');
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        byId.set(row.id, [clean(row.code), clean(row.name)].filter(Boolean).join(' · '));
    }
    if (byId.size !== ids.length) throw new Error('Incomplete own Region Scope result.');
    const labels = ids.map((id) => byId.get(id));
    const shown = [];
    let displayedChars = 0;
    for (const label of labels) {
        if (shown.length === MAX_DISPLAYED_SUBREGIONS
            || displayedChars + label.length + 2 > MAX_DISPLAYED_LABEL_CHARS) break;
        shown.push(label);
        displayedChars += label.length + 2;
    }
    const more = labels.length - shown.length;
    return { ...base,
        message: `This Admin account is currently assigned ${labels.length} Subregion${labels.length === 1 ? '' : 's'}: ${shown.join('; ')}${more ? `; and ${more} more not shown in chat` : ''}. This is administrative scope; it does not itself grant editing rights over a Place or Programme/service. The Guide cannot change this assignment or show another account’s scope.`,
        actions };
}
