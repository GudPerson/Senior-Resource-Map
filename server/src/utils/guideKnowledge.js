import { normalizeRole } from './roles.js';
import { answerGuideResourceAccessQuestion } from './guideAccess.js';

import { HELP_CONTENT_VERSION, GUIDE_TOPICS } from '../generated/helpKnowledge.js';

export const GUIDE_KNOWLEDGE_VERSION = HELP_CONTENT_VERSION;
export { GUIDE_TOPICS };

export function answerGuideQuestion({ question = '', topicId = '' } = {}, user = null) {
    const query = question.toLowerCase().replace(/[’']/g, '').trim();
    const accessAnswer = !topicId && answerGuideResourceAccessQuestion(question, user);
    if (accessAnswer) return { version: GUIDE_KNOWLEDGE_VERSION, ...accessAnswer };
    const scored = GUIDE_TOPICS.map((topic) => ({ topic, score: topic.keywords.reduce((score, keyword) => (
        // Match the beginning of a word so "save resource" cannot match "unsave resources".
        new RegExp(`\\b${keyword}`).test(query) ? Math.max(score, keyword.length) : score
    ), 0) })).sort((a, b) => b.score - a.score);
    const topic = topicId ? GUIDE_TOPICS.find((item) => item.id === topicId)
        : scored[0]?.score ? scored[0].topic : null;
    if (!topic) return {
        version: GUIDE_KNOWLEDGE_VERSION, topicId: null,
        message: 'I can help you find or save a resource, make a Care Map, use Care Calendar, report an app problem, or prepare a Programme/service at a Place you manage. Which task did you mean? Keep private and medical details out of chat; confirm care, eligibility, fees, and availability with the provider.',
        actions: [{ label: 'Draft a report', route: '/help?tab=report' }],
    };
    const signedIn = Boolean(user?.id) && normalizeRole(user.role) !== 'guest';
    return {
        version: GUIDE_KNOWLEDGE_VERSION, topicId: topic.id, message: topic.message,
        actions: [{ label: topic.signedIn && !signedIn ? 'Sign in to continue' : topic.label,
            route: topic.signedIn && !signedIn ? '/login' : topic.route }],
    };
}

export function serializeGuideResource(resource, type) {
    const id = Number(resource?.id);
    if (!Number.isSafeInteger(id) || id <= 0 || !['hard', 'soft'].includes(type) || !resource?.name) return null;
    const location = resource.location || resource.locations?.[0]?.hardAsset || resource.locations?.[0];
    // Return only public display fields. Never forward eligibility/permissions or private payloads.
    return { id, type, name: String(resource.name).slice(0, 300),
        category: String(resource.subCategory || '').slice(0, 160),
        address: String(resource.address || location?.address || '').slice(0, 400),
        route: `/resource/${type}/${id}` };
}

export function extractGuideSearchCriteria(question = '') {
    const match = String(question).trim().match(/^(?:find|search(?: for)?|look for|show me)\s+(.+)$/i);
    if (!match) return null;
    let query = match[1].trim();
    if (/^(?:a |an )?resources?$/i.test(query)) return null;
    let type = 'all';
    const typed = query.match(/^(places?|programmes?|services?|offerings?)\s*:\s*(.+)$/i);
    if (typed) { type = /^place/i.test(typed[1]) ? 'hard' : 'soft'; query = typed[2].trim(); }
    if (query.length < 2 || query.length > 120) return null;
    return { query, type, page: 1 };
}
