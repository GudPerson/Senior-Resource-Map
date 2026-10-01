import { answerGuideGroupAccessQuestion, answerGuideResourceAccessQuestion } from './guideAccess.js';
import { GUIDE_ORACLE_FACTS } from './guideOracleKnowledge.js';
import { guideHiddenSavedResourceFact, guidePlaceAssignmentScopeFact, guideSavedIdentityPrivacyFact, guideHostMembershipRelationFact,
    guideSavedMembershipRelationFact, guideProviderIdentityCheckFact } from './guideProductRelations.js';

const facts = new Map(GUIDE_ORACLE_FACTS.map((fact) => [fact.id, fact]));
const source = (fact) => ({ id: fact.id, title: fact.title, route: fact.route, reviewed: fact.reviewed });

export function guideVerifiedBoundaryIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    // A public-visibility effect is not a diagnosis of this user's eligibility.
    if (guideHiddenSavedResourceFact(query)) return null;
    if (guidePlaceAssignmentScopeFact(query)) return null;
    if (guideSavedIdentityPrivacyFact(query) || guideHostMembershipRelationFact(query)
        || guideSavedMembershipRelationFact(query) || guideProviderIdentityCheckFact(query)) return null;
    if (/\b(?:private|personal|my)\s+(?:my\s+)?places?\b/.test(query)
        && /\b(?:public|publish|convert|turn\s+into\s+a\s+public)\b/.test(query))
        return 'private-place-public';
    if (/\b(?:governance|coordination)\s+groups?\b/.test(query)) return null;
    if (/\btemplates?\b|\bplace\s+versions?\b/.test(query)) return null;
    if (/\b(?:can|could|would|will)\s+you\b|\bplease\b/.test(query)
        && /\b(?:create|make)\b|\badd\s+(?:a\s+|new\s+)?(?:place|group)\b/.test(query)
        && /\b(?:places?|groups?)\b/.test(query)) return /\bgroups?\b/.test(query) ? 'create-group' : 'create-place';
    if (/\b(?:places?|centres?|centers?)\b/.test(query)
        && /\b(?:staff|owners?)\b/.test(query)
        && /\b(?:add|assign|invite|remove|revoke|manage|grant)\b/.test(query)) return 'place-staff';
    if (/\b(?:volunteers?|colleagues?|co-?workers?|team\s+members?)\b/.test(query)
        && /\b(?:edit|change|update|manage)\b/.test(query)
        && /\b(?:places?|centres?|centers?)\b/.test(query)
        && /\b(?:listings?|resources?)\b/.test(query)) return 'third-party-place-editor';
    // A Programme's linked host Place is not a person's Place membership.
    const personMembership = /\b(?:join|joined|joining|members?|membership)\b/.test(query)
        || /\b(?:link|linked|linking|connect|connected|connecting)\b.{0,60}\b(?:accounts?|myself|yourself|ourselves)\b|\baccounts?\b.{0,60}\b(?:link|linked|linking|connect|connected|connecting)\b/.test(query);
    if (personMembership
        && /\b(?:edit|change|manage)\b/.test(query)
        && /\b(?:places?|centres?|centers?|programmes?|programs?|services?|offerings?)\b/.test(query)) return 'membership-edit';
    if (/^(?:find|search(?: for)?|look for|show me)\b/.test(query)) return null;
    const offering = /\b(?:programmes?|programs?|services?|offerings?|activities|activity|class)\b/.test(query);
    if (!offering) return null;
    if (/\b(?:sav(?:e|ed|ing)|heart)\b/.test(query)
        && /\b(?:eligib\w*|qualif\w*|access|register\w*|book\w*)\b/.test(query)) return 'saved-eligibility';
    if (/\b(?:missing|incomplete|chas|profile|date of birth|caregiver|gender)\b/.test(query)
        && /\b(?:eligib\w*|qualif\w*|restricted|member.only|access|appear|visible)\b/.test(query)) return 'missing-profile';
    if (/\b(?:why|cannot|cant|hidden|missing)\b|\bnot\s+(?:visible|showing|listed)\b/.test(query)
        && /\b(?:see|find|visible|appear|hidden|missing)\b/.test(query)) return 'not-visible';
    if (/\b(?:eligib\w*|qualif\w*|member.only|restricted)\b/.test(query)
        && /\b(?:access|join|see|view|find|appear|qualif\w*|eligib\w*)\b/.test(query)) return 'eligibility';
    return null;
}

export function answerGuideVerifiedBoundaryQuestion(question, actor) {
    const intent = guideVerifiedBoundaryIntent(question);
    if (!intent) return null;
    if (intent === 'private-place-public') {
        const privatePlace = facts.get('personal-place-sharing');
        const creation = facts.get('guide-create-scope');
        return { topicId: 'verified-boundary', answerSource: 'reviewed',
            message: 'A private My Place is a personal planning location, not a public directory Place. I cannot verify a one-click conversion or publish it from Guide chat. To offer a public location, an authorised resource manager must create a separate Place in Manage My Resources and review its visibility. Your private My Place is still separate.',
            actions: [{ label: 'Open My Places', route: privatePlace.route }],
            sources: [source(privatePlace), source(creation)] };
    }
    if (intent === 'create-place' || intent === 'create-group') {
        const fact = facts.get('guide-create-scope');
        const access = intent === 'create-group'
            ? answerGuideGroupAccessQuestion('Can I create a Resource Group?', actor)
            : answerGuideResourceAccessQuestion('Can I create a Place?', actor);
        return { topicId: 'verified-boundary', answerSource: 'account',
            message: `${fact.message} ${access.message}`,
            actions: access.actions, sources: [source(fact)] };
    }
    const factId = ({ 'place-staff': 'place-staff-assignment', 'third-party-place-editor': 'place-staff-assignment',
        'membership-edit': 'place-membership',
        'saved-eligibility': 'saved-not-eligible', 'missing-profile': 'offering-profile-missing',
        'not-visible': 'offering-not-visible', eligibility: 'offering-eligibility' })[intent];
    const fact = facts.get(factId);
    return { topicId: 'verified-boundary', answerSource: 'reviewed',
        message: intent === 'third-party-place-editor'
            ? `A volunteer or colleague title does not tell me whether that person can edit your Place listing. Check that account's access to the exact Place in Manage My Resources. ${fact.message}`
            : intent === 'membership-edit'
            ? `${fact.message} Joining a Place also does not grant editing rights to its Programmes/services; check the exact listing in Manage My Resources for any separate assignment.`
            : fact.message,
        actions: [{ label: `Open ${fact.title}`, route: fact.route }], sources: [source(fact)] };
}
