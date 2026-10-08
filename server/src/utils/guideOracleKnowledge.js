import { HELP_CONTENT_VERSION, GUIDE_EXTRA_FACTS as extraFacts, GUIDE_ORACLE_FACTS } from '../generated/helpKnowledge.js';
import { createGuideFactIndex, guideFactContextMatches } from './guideFactRetrieval.js';
import { guideReviewedRelationFact, guideHiddenSavedResourceFact, guideProviderUsageLookup } from './guideProductRelations.js';
import { GUIDE_SAVED_DIRECTORY_ROUTE, guideDirectoryActionRoute } from './guideDirectoryRoutes.js';

// Reviewed user-facing facts. The Obsidian map is a discovery aid, not a live
// authority: each addition here must be checked against the current app and
// regression ledger before it can be used in an answer.
export const GUIDE_ORACLE_VERSION = HELP_CONTENT_VERSION;
export { GUIDE_ORACLE_FACTS };

const rankGuideFacts = createGuideFactIndex(GUIDE_ORACLE_FACTS);

export function guidePrivateResourceChangeIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!/\b(?:remove|delete|hide|unhide|unsave)\b/.test(query)
        || !/\b(?:resources?|places?|programmes?|programs?|services?|offerings?|sessions?|pins?|cards?)\b/.test(query)) return null;
    const removingFromOneMap = /\b(?:remove|delete)\b.{0,100}\b(?:from|off)\s+(?:one|a|my|the|this|that)\s+maps?\b/.test(query)
        || /\b(?:hide|unhide)\b.{0,100}\bon\s+(?:one|a|my|the|this|that)\s+maps?\b/.test(query);
    const removingFromDirectory = /\bunsave\b|\b(?:remove|delete)\b.{0,100}\b(?:from|out of)\s+my\s+directory\b/.test(query);
    // "Keep it saved/on my map" describes the desired result, not a second removal target.
    if (removingFromOneMap && !removingFromDirectory) return 'map';
    if (removingFromDirectory && !removingFromOneMap && !/\b(?:bulk|multiple|many|all)\b/.test(query)) return 'saved';
    const contexts = [
        /\b(?:my|care)\s+maps?\b/.test(query) ? 'map' : null,
        /\bmy\s+plans?\b/.test(query) ? 'plans' : null,
        /\bmy\s+directory\b|\bsaved\b|\bunsave\b/.test(query) ? 'saved' : null,
    ].filter(Boolean);
    if (contexts.length > 1) return 'compound';
    // Keep bulk unsave on the established map-aware review and confirmation answer.
    if (contexts[0] === 'saved' && /\b(?:bulk|multiple|many|all)\b/.test(query)) return null;
    if (contexts[0] === 'saved' && /\b(?:remove|delete|unsave)\b/.test(query)) return 'saved';
    if (contexts[0] === 'map') return 'map';
    if (contexts[0] === 'plans' && /\b(?:remove|delete)\b/.test(query)) return 'plans';
    return null;
}

export function guideProviderUsageIntent(question = '') {
    return guideProviderUsageLookup(question);
}

function guideProviderPlanLifecycleIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    return /\b(?:hid(?:e|ing|den)|unpublish\w*|turn(?:ed|ing)?\s+off|switch(?:ed|ing)?\s+off)\b/.test(query)
        && /\b(?:plans?|planned)\b/.test(query)
        && /\b(?:people|members|users|others|their|someone|existing)\b/.test(query)
        && /\b(?:programmes?|programs?|services?|offerings?|activities?|calendar|sessions?)\b/.test(query);
}

function guideProviderPlanPrivacyIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    return /\b(?:plans?|planned|planning)\b/.test(query)
        && /\b(?:programmes?|programs?|services?|offerings?|activities?)\b/.test(query)
        && /\b(?:who|which\s+people|how\s+many|members|participants|attendees|users|visitors)\b/.test(query)
        && /\b(?:see|show|list|who|which|how\s+many|count)\b/.test(query)
        && !/\bwho\s+can\s+see\b/.test(query);
}

export function guideUnverifiedWorkflowIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (/\b(?:my|care)\s+maps?\b/.test(query)
        && /\b(?:edit|change|update)\b/.test(query)
        && /\b(?:resources?|places?|programmes?|programs?|services?|offerings?)\b/.test(query)) return 'map-resource-edit';
    if (/\bmy\s+plans?\b/.test(query)
        && /\b(?:edit|change|update)\b/.test(query)
        && /\b(?:programmes?|programs?|services?|offerings?|sessions?)\b/.test(query)) return 'plan-resource-edit';
    if (/\b(?:my directory|saved)\b/.test(query)
        && /\b(?:hide|unhide)\b/.test(query)
        && /\b(?:resources?|places?|programmes?|programs?|services?|offerings?)\b/.test(query)) return 'saved-resource-hide';
    if (/\b(?:(?:my|care) maps?|map assets?|map notes?)\b/.test(query)
        && /\b(?:import|upload)\b/.test(query)
        && /\b(?:workbook|spreadsheet|excel|csv|xlsx)\b/.test(query)) return 'map-workbook';
    if (/\barchive\b/.test(query)
        && /\b(?:resources?|places?|programmes?|programs?|services?|offerings?|listings?|groups?)\b/.test(query)
        && !/\b(?:(?:my|care) maps?|my directory|my plans?|personal places?|saved)\b/.test(query)
        && !/\b(?:governance|coordination|org|region)\s+groups?\b/.test(query)) return 'resource-archive';
    return null;
}

export function answerGuideUnverifiedWorkflow(question = '') {
    const intent = guideUnverifiedWorkflowIntent(question);
    if (intent === 'map-resource-edit') return {
        topicId: 'unverified-workflow',
        message: 'Do you mean changing a resource’s place on your Care Map, or editing the public Place or Offering listing? Those are separate controls. Open your Care Map for map changes; public listing edits require access to that specific resource in Manage My Resources.',
        actions: [{ label: 'Open Care Maps', route: '/my-directory' }],
    };
    if (intent === 'plan-resource-edit') return {
        topicId: 'unverified-workflow',
        message: 'Do you mean changing your own planned session or editing the provider’s Programme/service listing? Those are separate. Open Care Calendar → My Plans for your plan; public listing edits require access to that specific resource in Manage My Resources.',
        actions: [{ label: 'Open My Plans', route: '/dashboard/calendar?section=plans' }],
    };
    if (intent === 'saved-resource-hide') return {
        topicId: 'unverified-workflow',
        message: 'Do you mean removing a resource from your saved list in My Directory, or hiding the public listing from the app? Unsave affects your list only. Hide from app is a separate permission-checked control in Manage My Resources.',
        actions: [{ label: 'Open My Directory', route: GUIDE_SAVED_DIRECTORY_ROUTE }],
    };
    if (intent === 'map-workbook') return {
        topicId: 'unverified-workflow',
        message: 'I cannot verify a workbook-upload workflow for Care Maps. Asset Workbook Tools create or update directory resources in Admin Data Tools; they do not add a resource to one of your Care Maps. Open Care Maps to use its current resource controls, or ask about bulk directory import if that is what you mean.',
        actions: [{ label: 'Open Care Maps', route: '/my-directory' }],
    };
    if (intent === 'resource-archive') return {
        topicId: 'unverified-workflow',
        message: 'I cannot verify an Archive control for a public Place, Offering or Resource Group. Manage My Resources has separate Hide from app and Delete controls when this account is allowed to use them. Hide changes visibility; Delete removes the listing after confirmation. Check the exact resource before choosing either; the Guide cannot perform that change.',
        actions: [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }],
    };
    return null;
}

function eligibleGuideOracleFact(fact, query) {
    if (fact.id === 'offering-host-change'
        && !/\b(?:programmes?|programs?|services?|offerings?|activities?)\b.*\b(?:places?|centres?|centers?|hosts?)\b|\b(?:places?|centres?|centers?|hosts?)\b.*\b(?:programmes?|programs?|services?|offerings?|activities?)\b/.test(query)) return false;
    if (fact.id === 'offering-multi-host'
        && !/\b(?:programmes?|programs?|services?|offerings?|activities?)\b/.test(query)) return false;
    if (fact.id === 'place-owner-transfer-boundary' && !/\b(?:places?|centres?|centers?)\b/.test(query)) return false;
    if (fact.id === 'group-staff-visibility' && !/\b(?:resource|public)\s+groups?\b/.test(query)) return false;
    if (fact.id === 'saved-to-shared-map' && !/\bshared\s+maps?\b/.test(query)) return false;
    if (fact.id.startsWith('offering-template-') && /\b(?:workbook|spreadsheet|xlsx|csv|excel|boundary|metadata)\b/.test(query)) return false;
    if (fact.id === 'map-note-privacy' && !/\bmap\b|\bshare(?:d)?\s+link\b/i.test(query)) return false;
    if (fact.id === 'my-map-note-edit' && !/\bmap\b|\b(?:my|care)\s+maps\b/i.test(query)) return false;
    return true;
}

export function guideOracleDiscoveryFacts(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!query || guideUnverifiedWorkflowIntent(query)) return [];
    // Discovery cannot widen an existing reviewed/private boundary.
    if (guideProviderPlanLifecycleIntent(query) || guideProviderPlanPrivacyIntent(query)
        || guidePrivateResourceChangeIntent(query) || guideReviewedRelationFact(query))
        return retrieveGuideOracleFacts(query);
    return GUIDE_ORACLE_FACTS.filter((fact) => eligibleGuideOracleFact(fact, query)
        && guideFactContextMatches(fact, query));
}

export function retrieveGuideOracleFacts(question = '', topicId = null, limit = 4) {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    // These actions are not covered by the reviewed Group or workbook facts.
    if (guideUnverifiedWorkflowIntent(query)) return [];
    if (guideProviderPlanLifecycleIntent(query)) return extraFacts.filter((fact) => fact.id === 'provider-plan-lifecycle');
    if (guideProviderPlanPrivacyIntent(query)) return extraFacts.filter((fact) => fact.id === 'provider-plan-privacy');
    const publicSaved = guideHiddenSavedResourceFact(query);
    if (publicSaved) return extraFacts.filter((fact) => fact.id === publicSaved);
    const privateChange = guidePrivateResourceChangeIntent(query);
    if (privateChange) {
        const id = ({ map: 'my-map-resource-removal', plans: 'remove-plan',
            saved: 'saved-resource-removal', compound: 'map-membership' })[privateChange];
        return extraFacts.filter((fact) => fact.id === id);
    }
    const relation = guideReviewedRelationFact(query);
    if (relation) return extraFacts.filter((fact) => fact.id === relation);
    return rankGuideFacts(query, { topicId, limit, eligible: (fact) => eligibleGuideOracleFact(fact, query) });
}

const factDestinationLabels = {
    '/discover': 'Open Discover',
    '/dashboard': 'Open dashboard',
    '/my-directory': 'Open My Directory',
    '/my-directory?section=my-places': 'Open My Places',
    '/dashboard/resources': 'Open Manage My Resources',
    '/dashboard/calendar': 'Open Care Calendar',
    '/dashboard/calendar?section=calendar': 'Open Care Calendar',
    '/dashboard/calendar?section=plans': 'Open My Plans',
    '/dashboard/calendar?section=updates': 'Open Care Calendar Updates',
    '/dashboard/profile': 'Open Profile',
    '/dashboard/admin': 'Open Admin Data Tools',
    '/dashboard/organization': 'Open Organisation Workspace',
    '/help?tab=inbox': 'Open Updates',
    '/help?tab=report': 'Draft a support report',
};
export const guideOracleFactAction = (fact) => ({
    label: fact.actionLabel || factDestinationLabels[fact.route] || `Open ${fact.title}`,
    route: guideDirectoryActionRoute(fact.route, fact.id),
});
const factAction = guideOracleFactAction;

export function answerGuideOracleFact(question = '') {
    const groupQuery = String(question).toLowerCase().replace(/[’']/g, '');
    if (/\b(?:governance|coordination|org|organisation|organization|region)\s+groups?\b/.test(groupQuery)) {
        const id = /\bmembers?\b|\bgroup\s+access\b|\b(?:admin|staff)\s+roles?\b/.test(groupQuery) ? 'governance-group-membership'
            : /\bregion\s+groups?\b/.test(groupQuery) ? 'governance-region-group'
            : /\b(?:org|organisation|organization)\s+groups?\b/.test(groupQuery) ? 'governance-org-group'
                : 'governance-group-overview';
        const fact = extraFacts.find((item) => item.id === id);
        return { topicId: fact.id, message: fact.message,
            actions: [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    if (/\btemplates?\b/.test(groupQuery)
        && /\b(?:workbook|spreadsheet|xlsx|csv|excel|boundary|metadata)\b/.test(groupQuery)) {
        if (/^how\b/.test(groupQuery) && /\b(?:download|get|import|upload)\b/.test(groupQuery)) {
            const fact = extraFacts.find((item) => item.id === 'asset-workbook-import');
            return { topicId: fact.id, message: fact.message,
                actions: [factAction(fact)],
                sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
        }
        return null;
    }
    const templateQuestion = !/\b(?:workbook|spreadsheet|xlsx|csv|excel|boundary|metadata)\b/.test(groupQuery)
        && /\btemplates?\b|\bplace\s+versions?\b/.test(groupQuery);
    if (templateQuestion) {
        const id = /\b(?:delet\w*|remov\w*|recover\w*|restor\w*|undelet\w*)\b/.test(groupQuery) ? 'offering-template-delete'
            : /\b(?:edit\w*|chang\w*|updat\w*|overrid\w*|propagat\w*)\b/.test(groupQuery) ? 'offering-template-propagation'
                : 'offering-template-overview';
        const fact = extraFacts.find((item) => item.id === id);
        return { topicId: fact.id, message: fact.message,
            actions: [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const regionFactId = /\bregion\s+scope\b/.test(groupQuery)
        || /\b(?:which|what|show|see|view|my|assigned)\b.{0,50}\bsubregions?\b.{0,35}\b(?:assigned|administer|manage)\b/.test(groupQuery)
        ? 'admin-region-scope'
        : /\b(?:configur\w*\s+regions?|regions?\s+configur\w*|regions?\s+tab|regions?\s+boundar\w*|subregions?\s+boundar\w*|mapping\s+workbook|unmapped\s+postcodes?|creat\w*\s+(?:a\s+)?subregion|upload\s+boundar\w*)\b/.test(groupQuery)
            ? 'region-boundary-layers' : null;
    if (regionFactId) {
        const fact = extraFacts.find((item) => item.id === regionFactId);
        return { topicId: fact.id, message: fact.message,
            actions: [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const publicSaved = !guideProviderPlanLifecycleIntent(question) && !guideProviderPlanPrivacyIntent(question)
        && guideHiddenSavedResourceFact(question);
    if (publicSaved) {
        const fact = extraFacts.find((item) => item.id === publicSaved);
        return { topicId: fact.id, message: fact.message, actions: [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const privateChange = guidePrivateResourceChangeIntent(question);
    if (privateChange) {
        const id = ({ map: 'my-map-resource-removal', plans: 'remove-plan',
            saved: 'saved-resource-removal', compound: 'map-membership' })[privateChange];
        const fact = extraFacts.find((item) => item.id === id);
        return { topicId: fact.id, message: fact.message,
            actions: [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const relation = guideProviderPlanLifecycleIntent(question) ? 'provider-plan-lifecycle'
        : guideProviderPlanPrivacyIntent(question) ? 'provider-plan-privacy' : guideReviewedRelationFact(question);
    if (relation) {
        const fact = extraFacts.find((item) => item.id === relation);
        return { topicId: fact.id, message: fact.message,
            actions: relation === 'saved-versus-managed'
                ? [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }] : [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const savedEffectQuestion = /\b(?:heart|bookmark|favou?rit(?:e|ed|ing)|sav(?:e|ed|ing))\b/i.test(question)
        && /\b(?:resource|place|programme|program|service|offering|activity|activities)s?\b/i.test(question)
        && /\b(?:edit|chang(?:e|ed|ing)|manag(?:e|ed|ing)|register(?:ed)?|enroll?(?:ed|ing|ment)?|book(?:ed|ing)?|sign(?:ed)?\s*up|confirmed?\s+(?:seat|place))\b/i.test(question);
    if (savedEffectQuestion && !/^how\b/i.test(String(question).trim())) {
        const fact = extraFacts.find((item) => item.id === 'saved-versus-managed');
        return { topicId: fact.id, message: fact.message,
            actions: [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const mapRemovalQuestion = /\bremov(?:e|ed|ing)\b/i.test(question)
        && /\bmap\b/i.test(question) && /\b(?:directory|saved?)\b/i.test(question);
    const resourceTypeQuestion = /\bdifference\b/i.test(question)
        && /\bplaces?\b/i.test(question)
        && /\b(?:programmes?|programs?|services?|offerings?)\b/i.test(question);
    const savedListPrivacyQuestion = /\b(?:who|anyone|others?|other\s+people)\b.*\b(?:see|view|access)\b.*\b(?:saved|my\s+directory)\b/i.test(question)
        || /\b(?:staff|admins?)\b.*\b(?:see|view|access)\b.*\bmy\s+(?:saved\s+(?:resources?|list)|directory)\b/i.test(question)
        || /\b(?:saved\s+(?:resources?|list)|my\s+directory)\b.*\b(?:private|public|visible\s+to\s+others?)\b/i.test(question)
        || /\bsav(?:e|ing)\b.*\b(?:places?|programmes?|programs?|services?|resources?)\b.*\b(?:my\s+)?(?:whole\s+)?directory\b.*\bpublic\b/i.test(question)
        || /\b(?:colleague|co-?worker|team\s+member|friend)\b.*\b(?:see|view|access)\b.*\bmy\s+(?:saved\s+(?:resources?|list)|directory)\b/i.test(question);
    const otherAccountSavedQuestion = /\b(?:colleague|co-?worker|team\s+member|teammate|friend|another\s+(?:user|person)|someone\s+else)(?:['’]s)?\s+(?:sav(?:e|ed)|has\s+saved|favo(?:u)?rites?|directory)\b/i.test(question)
        && /\b(?:what|which|show|see|list|resources?|places?|programmes?|services?|directory)\b/i.test(question);
    const savePlaceSeparatelyQuestion = /\bsav(?:e|ing)\b.*\bplaces?\b.*\b(?:without|separately|not)\b.*\b(?:follow(?:ing)?|programmes?|programs?|services?|offerings?)\b/i.test(question)
        && /\b(?:programmes?|programs?|services?|offerings?)\b/i.test(question);
    const otherPersonMapEditQuestion = /\b(?:someone\s+else|another\s+user|other\s+people|friends?|visitors?|invite|collaborat\w*)\b/i.test(question)
        && /\b(?:edit|change|modify|co-?edit)\b/i.test(question)
        && /\bmaps?\b/i.test(question);
    const otherPersonMapAdditionQuestion = /\b(?:someone\s+else|another\s+user|other\s+people|friends?|visitors?|colleagues?)\b/i.test(question)
        && /\b(?:add|insert|contribute)\b/i.test(question)
        && /\b(?:places?|programmes?|programs?|services?|resources?)\b/i.test(question)
        && /\b(?:my\s+(?:private\s+)?(?:care\s+)?maps?|care\s+maps?)\b/i.test(question);
    const savedToSharedMapQuestion = /\b(?:sav(?:e|ed|ing)|bookmark|heart)\b/i.test(question)
        && /\b(?:places?|programmes?|programs?|services?|resources?)\b/i.test(question)
        && /\bshared\s+maps?\b/i.test(question)
        && /\b(?:appear|show|visible|publish|automatic\w*)\b/i.test(question);
    const staffOnlyGroupQuestion = /\b(?:resource|public)\s+groups?\b/i.test(question)
        && /\bstaff[-\s]*only\b|\bonly\s+(?:to|for)\s+(?:my\s+)?staff\b/i.test(question);
    const providerRegistrationQuestion = /\b(?:register|enrol|enroll|sign\s+up|book)\b/i.test(question)
        && /\b(?:programmes?|programs?|services?|offerings?|activities?)\b/i.test(question)
        && /\b(?:carearound|through\s+(?:the\s+)?app|on\s+(?:this\s+)?site)\b|\b(?:can|could|would|will)\s+you\b/i.test(question);
    const providerSeatBookingQuestion = /\b(?:book|reserve|register)\b/i.test(question)
        && /\bseats?\b/i.test(question)
        && /\b(?:carearound|guide|you|through\s+(?:the\s+)?app)\b/i.test(question);
    const providerWaitTimeQuestion = /\b(?:wait(?:ing)?\s+time|queue\s+(?:length|time))\b/i.test(question)
        && /\b(?:current|today|now|right\s+now|how\s+long|places?|centres?|centers?|programmes?|programs?|services?|providers?)\b/i.test(question);
    const savedScheduleNotificationQuestion = (/\b(?:notify|notification|alert)\b|\b(?:get|receive|send|inbox)\b.{0,25}\bupdates?\b/i.test(question))
        && /\b(?:saved|programme|program|service|schedule|date)\b/i.test(question)
        && /\b(?:chang\w*|mov\w*|reschedul\w*|schedule)\b/i.test(question);
    const sharedMapViewerQuestion = /\b(?:shared\s+map|published\s+map)\b/i.test(question)
        && ((/\b(?:who|which\s+people|how\s+many)\b/i.test(question)
            && /\b(?:open\w*|view\w*|visit\w*)\b/i.test(question))
            || (/\b(?:any\s+visitors?|visitor\s+count|view\s+count)\b/i.test(question)
                && /\b(?:see|tell|know|track|count|check|show)\b/i.test(question)));
    const savedNotOnMapQuestion = /\b(?:saved|favo(?:u)?rit\w*)\b/i.test(question)
        && /\b(?:programmes?|programs?|services?|places?|resources?)\b/i.test(question)
        && /\b(?:not\s+showing|missing|not\s+on|doesn.t\s+appear)\b/i.test(question)
        && /\b(?:my|care)\s+maps?\b/i.test(question);
    const savedToMyMapQuestion = /\b(?:save|saved|bookmark|heart)\b/i.test(question)
        && /\b(?:places?|programmes?|programs?|services?|resources?)\b/i.test(question)
        && /\b(?:my|care)\s+maps?\b/i.test(question)
        && /\b(?:appear|show|add|automatic\w*)\b/i.test(question);
    const savedResourceMissingQuestion = /\b(?:saved|favo(?:u)?rit\w*)\b/i.test(question)
        && /\b(?:places?|programmes?|programs?|services?|offerings?|resources?|listings?)\b/i.test(question)
        && /\b(?:disappear\w*|missing|gone|unavailable)\b/i.test(question);
    const providerMessageQuestion = /\b(?:message|chat\s+with|dm)\b/i.test(question)
        && /\b(?:providers?|centres?|centers?)\b/i.test(question);
    const listedFreeQuestion = /\bfree\b/i.test(question)
        && /\b(?:services?|programmes?|programs?|offerings?|activities?|listings?|places?)\b/i.test(question)
        && !/\b(?:create|add|make|edit|change|update)\b/i.test(question);
    const remainingSeatsLiveQuestion = /\bremaining[-\s]*(?:seats?|spots?|places?)\b/i.test(question)
        && /\b(?:live|current|real[-\s]*time|up[-\s]*to[-\s]*date)\b/i.test(question);
    const otherProviderGroupEditQuestion = /\b(?:resource\s+groups?|groups?)\b/i.test(question)
        && /\b(?:another|other)\s+(?:providers?|organisations?|organizations?)\b/i.test(question)
        && /\b(?:edit|change|manage)\b/i.test(question)
        && /\b(?:places?|programmes?|programs?|services?|offerings?|listings?)\b/i.test(question);
    const accountDeletionQuestion = /\b(?:delete|remove|erase)\b.*\bmy\s+(?:account|personal\s+data|data)\b/i.test(question)
        || /\bmy\s+(?:account|personal\s+data|data)\b.*\b(?:delete|remove|erase)\b/i.test(question);
    const personalAppointmentQuestion = /\b(?:add|create|put|schedule)\b.*\b(?:personal|own)\b.*\b(?:appointment|event|date)\b.*\b(?:care\s+calendar|calendar)\b/i.test(question)
        || /\b(?:care\s+calendar|calendar)\b.*\b(?:personal|own)\b.*\b(?:appointment|event)\b/i.test(question);
    const ownPlanDateQuestion = /\b(?:change|move|reschedule|edit)\b.*\b(?:date|time)\b.*\b(?:personal|own|my)\s+plans?\b/i.test(question)
        || /\b(?:personal|own|my)\s+plans?\b.*\b(?:change|move|reschedule|edit)\b.*\b(?:date|time)\b/i.test(question);
    const nearbyQuestion = /\b(?:near\s+(?:me|my\s+home)|nearby|postal\s*code|postcode)\b/i.test(question)
        && /\b(?:find|search|browse|look\s+for|show|support|resources?|places?|programmes?|services?)\b/i.test(question);
    const providerContactQuestion = /\b(?:contact|reach|call|email|whatsapp)\b/i.test(question)
        && /\b(?:providers?|services?|programmes?|programs?|places?|centres?|centers?|listings?)\b/i.test(question)
        && /\b(?:how|where|can i|could i|details?|number)\b/i.test(question)
        && !/\b(?:edit|change|update|set|remove)\b/i.test(question);
    const providerAvailabilityQuestion = /\b(?:vacanc(?:y|ies)|availability|available\s+(?:slots?|seats?|places?)|spots?\s+left|fees?|prices?|costs?)\b/i.test(question)
        && /\b(?:verify|confirm|guarantee|real\s*time|live|up\s*to\s*date|programmes?|services?|listings?|providers?)\b/i.test(question)
        && !/\b(?:edit|change|update|set|increase|decrease|adjust)\b/i.test(question);
    const languageChoiceQuestion = /\b(?:language|mandarin|chinese|malay|tamil)\b/i.test(question)
        && /\b(?:change|switch|set|choose|translate)\b/i.test(question);
    const offeringTranslationQuestion = (/\b(?:translate|translation)\b/i.test(question)
        || /\b(?:make|provide|get)\b.*\b(?:programmes?|programs?|services?|offerings?)\b.*\bavailable\s+in\s+(?:malay|mandarin|chinese|tamil)\b/i.test(question))
        && /\b(?:programmes?|programs?|services?|offerings?)\b/i.test(question)
        && /\b(?:guide|ai|how|where|manage|edit|my|can i)\b/i.test(question);
    const accountRecoveryQuestion = /\b(?:forgot|forget|reset|recover)\b.*\bpassword\b|\bpassword\b.*\b(?:reset|forgot|recover)\b/i.test(question);
    const embeddedNoteQuestion = /\b(?:notes?|annotations?)\b/i.test(question)
        && /\b(?:embed(?:ded)?|website)\b/i.test(question);
    const mapNoteEditQuestion = /\b(?:add|write|create|edit)\b.*\bnotes?\b|\bnotes?\b.*\b(?:add|write|create|edit)\b/i.test(question)
        && /\b(?:my\s+map|map\s+resources?|resources?\s+(?:in|on)\s+(?:my\s+)?map)\b/i.test(question);
    const individualNoteShareQuestion = /\bshar(?:e|ed|ing)\b.*\b(?:one|single|individual|specific)\b.*\bnotes?\b|\b(?:one|single|individual|specific)\b.*\bnotes?\b.*\bshar(?:e|ed|ing)\b/i.test(question);
    const profileUpdateQuestion = /\b(?:update|edit|change|save|complete)\b/i.test(question)
        && /\b(?:my\s+)?profile\b/i.test(question);
    const mapExportQuestion = /\b(?:download|export|excel|pdf)\b/i.test(question)
        && /\b(?:my\s+)?maps?\b/i.test(question)
        && /\b(?:resources?|assets?|notes?|list|workbook)\b/i.test(question);
    const noteVisibilityQuestion = /\bnotes?\b/i.test(question)
        && /\b(?:share(?:d)?|visitors?|published|visible|seen|see)\b/i.test(question)
        && /\bmap\b|\bshare(?:d)?\s+(?:link|map)\b/i.test(question);
    const personalPlaceVisibilityQuestion = /\b(?:personal|private\s+planning)\s+(?:places?|locations?)\b|\bprivate\s+(?:address|planning)\s+pins?\b/i.test(question)
        && /\b(?:shar(?:e|ed|ing)|publish(?:ed)?|visitors?|public|exports?|downloads?|pdf|excel|spreadsheets?)\b/i.test(question);
    const fieldEditQuestion = /\b(?:edit|update|change|correct|replace)\b/i.test(question)
        && /\b(?:phone|email|whatsapp|contact\s+(?:details?|number|info)|hours?)\b/i.test(question);
    const offeringHostChangeQuestion = /\b(?:move|transfer|reassign|change|replace|switch)\b/i.test(question)
        && /\b(?:programmes?|programs?|services?|offerings?|activities?)\b/i.test(question)
        && /\b(?:places?|centres?|centers?|hosts?)\b/i.test(question)
        && /\b(?:another|different|new|other|from\s+one|linked|host)\b/i.test(question)
        && !/\b(?:(?:my|care)\s+maps?|my\s+plans?|care\s+calendar|saved)\b/i.test(question);
    const offeringMultiHostQuestion = /\b(?:create|make|link|add|run)\b/i.test(question)
        && /\b(?:one|single|same|a)\s+(?:programmes?|programs?|services?|offerings?|activities?)\b/i.test(question)
        && /\b(?:several|multiple|two|more\s+than\s+one|different)\s+(?:places?|centres?|centers?|hosts?)\b/i.test(question);
    const providerSaversQuestion = guideProviderUsageLookup(question)
        && /\b(?:sav(?:e|ed)|bookmark(?:ed)?|heart(?:ed)?)\b/i.test(question)
        && /\b(?:my|our)\b.{0,35}\b(?:programmes?|programs?|services?|offerings?|listings?|places?)\b/i.test(question);
    const placeOwnerTransferQuestion = /\b(?:transfer|reassign|move|change\s+(?:the\s+)?(?:owner(?:ship)?|owning\s+organi[sz]ation))\b/i.test(question)
        && /\b(?:places?|centres?|centers?)\b/i.test(question)
        && /\b(?:organisations?|organizations?|partners?|providers?|owners?|ownership)\b/i.test(question);
    const placeContactEditQuestion = fieldEditQuestion && /\b(?:places?|centres?|centers?)\b/i.test(question)
        && !/\b(?:programmes?|programs?|services?|offerings?)\b/i.test(question);
    const offeringContactEditQuestion = fieldEditQuestion && /\b(?:programmes?|programs?|services?|offerings?)\b/i.test(question);
    const offeringScheduleEditQuestion = /\b(?:edit|update|change|unpublish|switch\s+off|turn\s+off)\b/i.test(question)
        && /\b(?:schedules?|sessions?|dates?)\b/i.test(question)
        && /\b(?:programmes?|programs?|services?|offerings?)\b/i.test(question)
        && !/\b(?:my\s+plans?|personal\s+plans?)\b/i.test(question);
    const listingPublicationQuestion = /\b(?:resource\s+claims?|directory\s+listings?|listing\s+approval)\b/i.test(question)
        && /\b(?:approv\w*|publish\w*|visib\w*)\b/i.test(question)
        || /\bapprov\w*\b.*\bpublish\w*\b.*\b(?:places?|programmes?|offerings?)\b/i.test(question);
    const otherProviderGroupQuestion = /\b(?:resource\s+groups?|groups?)\b/i.test(question)
        && /\b(?:another|other)\s+(?:providers?|organisations?|organizations?)\b/i.test(question)
        && /\b(?:add|adding|include|member)\b/i.test(question);
    const targetRegionGroupQuestion = /\b(?:resource\s+groups?|groups?)\b/i.test(question)
        && /\bregions?\b/i.test(question)
        && /\b(?:target|visible|shown|only|limit|restrict)\b/i.test(question);
    const plannedSessionShiftQuestion = /\b(?:planned|my\s+plans?)\b/i.test(question)
        && /\b(?:activity|session|programme|program|service|offering|timetable|entry)\b/i.test(question)
        && /\b(?:mov(?:e|es|ed|ing)|reschedul\w*|chang(?:e|es|ed|ing))\b/i.test(question)
        && /\b(?:date|time|schedule|day|timetable)\b/i.test(question)
        && /\b(?:what\s+(?:happens|if)|when|does|will)\b/i.test(question);
    const personalPlaceAddressEditQuestion = /\b(?:edit|update|change|correct)\b/i.test(question)
        && /\b(?:address|postal\s*code|location)\b/i.test(question)
        && /\b(?:my\s+places?|personal\s+places?|private\s+(?:planning\s+)?places?|planning\s+locations?)\b/i.test(question);
    const wholeDirectoryExportQuestion = /\b(?:download|export|excel|spreadsheet|csv)\b/i.test(question)
        && (/\b(?:my\s+directory|all\s+(?:my\s+)?saved\s+resources?|entire\s+(?:saved\s+)?list|whole\s+(?:saved\s+)?list)\b/i.test(question)
            || /\b(?:every|all)\b.{0,60}\b(?:resources?|places?|programmes?|programs?|services?|offerings?)\b.{0,40}\b(?:i\s+(?:have\s+)?saved|saved)\b/i.test(question))
        && !/\b(?:one|single|particular|specific)\s+(?:my\s+)?map\b|\b(?:on|in|from)\s+(?:one|a|my|the|this|that)\s+map\b/i.test(question);
    const guideExistingResourceEditQuestion = /\b(?:guide|ai|you)\b/i.test(question)
        && /\b(?:edit|update|change)\b/i.test(question)
        && /\b(?:existing|published)\b/i.test(question)
        && /\b(?:places?|programmes?|programs?|services?|offerings?|listings?|schedules?)\b/i.test(question)
        && !/\bdraft\b/i.test(question);
    const privateMapExportQuestion = /\b(?:private|personal)\b/i.test(question)
        && /\b(?:my|care)\s+maps?\b/i.test(question)
        && /\b(?:export|download|excel|spreadsheet)\b/i.test(question)
        && /\b(?:shar(?:e|ed|ing)|send|email|give)\b/i.test(question);
    const volunteerPlaceCreationQuestion = /\bvolunteers?\b/i.test(question)
        && /\b(?:create|add|make)\b/i.test(question)
        && /\b(?:places?|centres?|centers?)\b/i.test(question);
    const regionalAdminEditQuestion = /\b(?:region|regional)\s+admin\b/i.test(question)
        && /\b(?:edit|change|update|manage)\b/i.test(question)
        && /\b(?:any|all|every)\s+places?\b/i.test(question);
    const publishedStudioQuestion = /\b(?:map\s+)?studio\b/i.test(question)
        && /\b(?:shared\s+map|publish\w*|embed\w*)\b/i.test(question)
        && /\b(?:sav\w*|chang\w*|updat\w*|refresh\w*|live)\b/i.test(question);
    const accessibilityResourceQuestion = /\b(?:wheelchair|step[-\s]*free|mobility[-\s]*accessible)\b/i.test(question)
        && /\b(?:find|search|filter|nearby|near\s+me|resources?|places?|programmes?|programs?|services?|offerings?)\b/i.test(question);
    const forcedFact = guideProviderPlanLifecycleIntent(question) ? 'provider-plan-lifecycle'
        : guideProviderPlanPrivacyIntent(question) ? 'provider-plan-privacy'
        : mapRemovalQuestion ? 'map-membership' : resourceTypeQuestion ? 'resource-types'
        : providerSaversQuestion ? 'provider-usage-boundary'
        : offeringMultiHostQuestion ? 'offering-multi-host'
        : guideExistingResourceEditQuestion ? 'guide-existing-resource-edit-scope'
        : offeringHostChangeQuestion ? 'offering-host-change'
        : placeOwnerTransferQuestion ? 'place-owner-transfer-boundary'
        : savedToSharedMapQuestion ? 'saved-to-shared-map'
        : staffOnlyGroupQuestion ? 'group-staff-visibility'
        : otherAccountSavedQuestion ? 'other-account-saved-privacy'
        : savedListPrivacyQuestion ? 'saved-list-privacy' : savePlaceSeparatelyQuestion ? 'save-place-separately'
        : savedNotOnMapQuestion || savedToMyMapQuestion ? 'map-membership'
        : otherPersonMapEditQuestion || otherPersonMapAdditionQuestion ? 'shared-map-copy'
        : savedScheduleNotificationQuestion ? 'saved-schedule-notifications'
        : sharedMapViewerQuestion ? 'shared-map-viewer-boundary'
        : savedResourceMissingQuestion ? 'saved-resource-status'
        : providerRegistrationQuestion || providerSeatBookingQuestion || providerMessageQuestion ? 'provider-contact'
        : providerWaitTimeQuestion ? 'provider-wait-time'
        : listedFreeQuestion || remainingSeatsLiveQuestion ? 'provider-availability'
        : otherProviderGroupEditQuestion ? 'group-other-provider-members'
        : accountDeletionQuestion ? 'account-deletion-help'
        : personalAppointmentQuestion ? 'calendar-personal-entry'
        : ownPlanDateQuestion ? 'plan-date-change'
        : embeddedNoteQuestion ? 'embedded-map-notes'
        : regionalAdminEditQuestion ? 'regional-admin-place-edit-boundary'
        : publishedStudioQuestion ? 'map-studio'
        : volunteerPlaceCreationQuestion ? 'volunteer-place-create-boundary'
        : privateMapExportQuestion ? 'private-map-export-sharing'
        : personalPlaceAddressEditQuestion ? 'personal-place-address-edit'
        : wholeDirectoryExportQuestion ? 'directory-export-boundary'
        : accessibilityResourceQuestion ? 'accessibility-search-boundary'
        : nearbyQuestion ? 'discover-nearby' : providerContactQuestion ? 'provider-contact'
        : providerAvailabilityQuestion ? 'provider-availability'
        : offeringTranslationQuestion ? 'offering-translation-review'
        : languageChoiceQuestion ? 'language-choice'
        : accountRecoveryQuestion ? 'account-recovery-help'
        : mapNoteEditQuestion ? 'my-map-note-edit' : individualNoteShareQuestion ? 'map-note-privacy'
        : profileUpdateQuestion ? 'profile-update' : mapExportQuestion ? 'my-map-exports'
        : noteVisibilityQuestion ? 'map-note-privacy'
        : personalPlaceVisibilityQuestion ? 'personal-place-sharing'
        : placeContactEditQuestion ? 'place-contact-edit'
        : offeringContactEditQuestion ? 'offering-contact-edit'
        : offeringScheduleEditQuestion ? 'offering-schedule-edit'
        : listingPublicationQuestion ? 'listing-publication-boundary'
        : otherProviderGroupQuestion ? 'group-other-provider-members'
        : targetRegionGroupQuestion ? 'group-target-regions'
        : plannedSessionShiftQuestion ? 'plan-schedule-update'
        : guideProviderUsageIntent(question) ? 'provider-usage-boundary' : null;
    if (forcedFact) {
        const fact = extraFacts.find((item) => item.id === forcedFact);
        return { topicId: fact.id, message: fact.message,
            actions: [factAction(fact)],
            sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
    }
    const [fact] = retrieveGuideOracleFacts(question, null, 1);
    if (!fact || !extraFacts.includes(fact)) return null;
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!fact.keywords.some((keyword) => keyword.length >= 5 && query.includes(keyword))) return null;
    return { topicId: fact.id, message: fact.message,
        actions: [factAction(fact)],
        sources: [{ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed }] };
}
