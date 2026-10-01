import { normalizeRole } from './roles.js';
import { answerGuideResourceAccessQuestion } from './guideAccess.js';

export const GUIDE_KNOWLEDGE_VERSION = '2026-09-29.14';
// Reviewed app guidance, not a model-generated source of permissions or care advice.
export const GUIDE_TOPICS = [
    {
        id: 'overview', title: 'What can I do with CareAround?',
        keywords: ['what can i do with carearound', 'what is carearound', 'what can i do here', 'how does carearound work', 'carearound features', 'getting started'],
        message: 'CareAround SG helps you find community Places and Programmes/services in Discover. Sign in to save resources to My Directory, create private My Maps and share a view-only snapshot, and use Care Calendar for supported saved schedules and personal plans. You can also report app problems and follow replies in Inbox. If you manage a Place, the Guide can help you draft and review a Programme/service before you choose Create. Check eligibility, fees, availability, and registration with the provider.',
        route: '/discover', label: 'Explore Discover',
    },
    {
        id: 'discover', title: 'Find a resource', keywords: ['discover', 'search', 'find resource', 'find a resource', 'nearby'],
        message: 'Use resource search for a name, service, tag, or address. Open a result to check its current details. Discover also lets you browse Places and Programmes/services on the map. Search results are information, not a booking or a confirmation of eligibility.',
        route: '/discover', label: 'Open Discover',
    },
    {
        id: 'save', title: 'Save resources', keywords: ['save resource', 'save a resource', 'heart', 'save to', 'saved resources'],
        message: 'Use the heart on a resource to save it to My Directory. You must be signed in to save. Saving an Offering is not registration for its programme or service.',
        route: '/my-directory', label: 'Open My Directory', signedIn: true,
    },
    {
        id: 'add-resource', title: 'Add or create a resource',
        keywords: ['add a resource', 'adding a resource', 'add resource', 'create resource', 'new resource', 'add a place'],
        message: 'Do you mean save an existing resource, create a Programme/service, or add a new Place? To save an existing resource, find it in Discover and use its heart to add it to My Directory. If you manage a Place and want a new Programme/service, ask me to “create a programme” or “create a service”; review the draft and choose Create to save it. To add a new Place, authorized resource managers can open Manage My Resources and choose New Place; that uses the standard resource form.',
        route: '/discover', label: 'Find an existing resource',
    },
    {
        id: 'unsave', title: 'Remove saved resources safely', keywords: ['unsave', 'bulk remove', 'bulk unsave', 'not used', 'remove saved', 'remove saved resources', 'delete multiple saved resources', 'remove multiple saved resources'],
        message: 'In My Directory, filter saved resources by Used in My Maps or Not used in My Maps. Select unused resources and review the removal confirmation. Bulk removal protects resources used in your maps. Unsaving an Offering can remove its saved schedule source from Care Calendar; check that warning before confirming.',
        route: '/my-directory', label: 'Review saved resources', signedIn: true,
    },
    {
        id: 'maps', title: 'Create and manage My Maps', keywords: ['create map', 'create a map', 'make a map', 'my map', 'personal map', 'manage map', 'map studio'],
        message: 'If your signed-in account can use My Directory, open it and choose My Maps to create or open a map. The Create/Manage Resources controls let you search for resources and add them to that map. Use the map menu for Map Studio. Changes to your private map do not silently update an already published Shared Map.',
        route: '/my-directory', label: 'Open My Maps', signedIn: true,
    },
    {
        id: 'sharing', title: 'Share a map', keywords: ['share map', 'share a map', 'shared map', 'sharing', 'publish', 'embed'],
        message: 'Open your own map and review its sharing controls. A Shared Map is a view-only snapshot; update the shared version explicitly after changing your private map. Review what will be visible before sharing the link. You can stop sharing from the same controls.',
        route: '/my-directory', label: 'Open My Directory', signedIn: true,
    },
    {
        id: 'calendar', title: 'Use Care Calendar', keywords: ['calendar', 'schedule', 'my plans', 'planning'],
        message: 'Open Care Calendar from your dashboard to view supported saved Offering schedules and your personal plans. Saving an Offering does not guarantee it has a supported schedule to show in Care Calendar, and a personal plan is not a provider booking or registration. Review source changes before relying on dates, and confirm attendance with the provider. Unsaving an Offering in My Directory can remove its saved calendar source.',
        route: '/dashboard/calendar', label: 'Open Care Calendar', signedIn: true,
    },
    {
        id: 'detailed-map', title: 'Check Detailed map display', keywords: ['detailed map', 'block number', 'zoom', 'map background', 'wrong map'],
        message: 'In Discover, open Map settings to choose Standard or Detailed. Detailed uses the overview map from zoom 14 up to, but not including, zoom 16; zoom 16 or above shows native detail with block numbers where the surface is available. A loading bar appears while Detailed prepares, and you can keep using the map. Discover and your editable My Map use 0.5 steps for the zoom buttons and keyboard; trackpad and pinch zoom stay smooth. My Map and its owner Print View keep native detail from zoom 15. Shared, embedded, and print map controls keep their existing behavior. If the view looks wrong, report the page and zoom level.',
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
        id: 'privacy', title: 'Keep private information out of chat',
        keywords: ['privacy', 'private information', 'private details', 'private data', 'private link',
            'private sharing link', 'personal data', 'medical', 'password', 'verification code', 'identity number'],
        message: 'Do not include identity numbers, passwords, verification codes, medical histories, private notes, or private sharing links. Support only needs a description of the app problem. The Guide cannot give medical advice or confirm provider eligibility, fees, or availability.',
        route: '/privacy', label: 'Read Privacy',
    },
];

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
        message: 'I can help you find or save a resource, make a My Map, use Care Calendar, report an app problem, or prepare a Programme/service at a Place you manage. Which task did you mean? Keep private and medical details out of chat; confirm care, eligibility, fees, and availability with the provider.',
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
