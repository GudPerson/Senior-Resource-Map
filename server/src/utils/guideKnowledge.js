import { normalizeRole } from './roles.js';

export const GUIDE_KNOWLEDGE_VERSION = '2026-09-07.1';
// Reviewed app guidance, not a model-generated source of permissions or care advice.
export const GUIDE_TOPICS = [
    {
        id: 'discover', title: 'Find a resource', keywords: ['discover', 'search', 'find resource', 'nearby'],
        message: 'Use resource search for a name, service, tag, or address. Open a result to check its current details. Discover also lets you browse Places and Programmes/services on the map. Search results are information, not a booking or a confirmation of eligibility.',
        route: '/discover', label: 'Open Discover',
    },
    {
        id: 'save', title: 'Save resources', keywords: ['save resource', 'heart', 'save to', 'saved resources'],
        message: 'Use the heart on a resource to save it to My Directory. You must be signed in to save. Saving an Offering is not registration for its programme or service.',
        route: '/my-directory', label: 'Open My Directory', signedIn: true,
    },
    {
        id: 'unsave', title: 'Remove saved resources safely', keywords: ['unsave', 'bulk remove', 'bulk unsave', 'not used', 'remove saved'],
        message: 'In My Directory, filter saved resources by Used in My Maps or Not used in My Maps. Select unused resources and review the removal confirmation. Bulk removal protects resources used in your maps. Unsaving an Offering can remove its saved schedule source from Care Calendar; check that warning before confirming.',
        route: '/my-directory', label: 'Review saved resources', signedIn: true,
    },
    {
        id: 'maps', title: 'Create and manage My Maps', keywords: ['create map', 'my map', 'personal map', 'manage map', 'map studio'],
        message: 'Open My Directory and choose My Maps to create or open a map. The Create/Manage Resources controls let you search for resources and add them to that map. Use the map menu for Map Studio. Changes to your private map do not silently update an already published Shared Map.',
        route: '/my-directory', label: 'Open My Maps', signedIn: true,
    },
    {
        id: 'sharing', title: 'Share a map', keywords: ['share map', 'shared map', 'sharing', 'publish', 'embed'],
        message: 'Open your own map and review its sharing controls. A Shared Map is a view-only snapshot; update the shared version explicitly after changing your private map. Review what will be visible before sharing the link. You can stop sharing from the same controls.',
        route: '/my-directory', label: 'Open My Directory', signedIn: true,
    },
    {
        id: 'calendar', title: 'Use Care Calendar', keywords: ['calendar', 'schedule', 'my plans', 'planning'],
        message: 'Open Care Calendar from your dashboard to view supported saved Offering schedules and your personal plans. A provider schedule and a personal plan are different things. Review source changes before relying on dates, and confirm attendance or registration with the provider. Removing a saved Offering can remove its saved calendar source.',
        route: '/dashboard/calendar', label: 'Open Care Calendar', signedIn: true,
    },
    {
        id: 'detailed-map', title: 'Check Detailed map display', keywords: ['detailed map', 'block number', 'zoom', 'map background', 'wrong map'],
        message: 'With Detailed map selected, displayed zoom 14 is the overview and zoom 15 or above shows native detail with block numbers where the Detailed surface is available. If the view looks wrong, report the page and zoom level. Do not repeatedly save the map to try to repair a display problem.',
        route: '/help?tab=report', label: 'Report a map problem',
    },
    {
        id: 'login', title: 'Help with signing in', keywords: ['login', 'log in', 'sign in', 'whatsapp', 'session expired', 'account'],
        message: 'Try the sign-in method already linked to your account. If your session expired, sign in again. Avoid starting several WhatsApp verification attempts at once. You can report a sign-in problem here without signing in; keep the private recovery code to return to your report. Never send passwords or verification codes.',
        route: '/login', label: 'Open sign in',
    },
    {
        id: 'support', title: 'Report a problem and follow its progress', keywords: ['bug', 'report', 'broken', 'support', 'fix', 'not working', 'inbox'],
        message: 'Describe what happened and what you expected, review the report, then submit it. Replies and progress updates stay in your inbox. A proposed fix needs human approval and release verification before a fix-available update is sent. You can confirm it is resolved or reopen it if the problem remains.',
        route: '/help?tab=report', label: 'Draft a report',
    },
    {
        id: 'privacy', title: 'Keep private information out of chat', keywords: ['privacy', 'private', 'personal data', 'medical', 'password'],
        message: 'Do not include identity numbers, passwords, verification codes, medical histories, private notes, or private sharing links. Support only needs a description of the app problem. The Guide cannot give medical advice or confirm provider eligibility, fees, or availability.',
        route: '/privacy', label: 'Read Privacy',
    },
];

export function answerGuideQuestion({ question = '', topicId = '' } = {}, user = null) {
    const query = question.toLowerCase().replace(/[’']/g, '').trim();
    const scored = GUIDE_TOPICS.map((topic) => ({ topic, score: topic.keywords.reduce((score, keyword) => (
        query.includes(keyword) ? Math.max(score, keyword.length) : score
    ), 0) })).sort((a, b) => b.score - a.score);
    const topic = topicId ? GUIDE_TOPICS.find((item) => item.id === topicId)
        : scored[0]?.score ? scored[0].topic : null;
    if (!topic) return {
        version: GUIDE_KNOWLEDGE_VERSION, topicId: null,
        message: 'I do not have a verified answer for that yet. Try one of the help topics, search the resource directory, or draft a report for the support team. Please do not include private or medical details.',
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
