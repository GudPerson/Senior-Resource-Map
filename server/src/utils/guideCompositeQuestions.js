import { answerGuideGroupAccessQuestion, answerGuideResourceAccessQuestion, answerGuideWorkbookAccessQuestion } from './guideAccess.js';
import { GUIDE_ORACLE_FACTS } from './guideOracleKnowledge.js';
import { GUIDE_SAVED_DIRECTORY_ROUTE } from './guideDirectoryRoutes.js';

const relatedSources = (...ids) => GUIDE_ORACLE_FACTS.filter((fact) => ids.includes(fact.id))
    .map(({ id, title, route, reviewed }) => ({ id, title, route, reviewed }));

// Questions spanning two product concepts need both parts answered together.
// These cases are backed by reviewed workflows; they never infer live listing rights.
export function guideCompositeIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (/\b(?:mandarin|chinese|malay|tamil)\b/.test(query)
        && /\b(?:programmes?|programs?|services?|offerings?)\b/.test(query)
        && /\b(?:version|translation|translate|wording|text)\b/.test(query)) return 'offering-language-version';
    if (/\b(?:resource|public)\s+groups?\b/.test(query)
        && /\b(?:people|persons?|users?|volunteers?|staff)\b/.test(query)
        && /\b(?:add|invite|include|members?|belong|accounts?)\b/.test(query)) return 'public-group-people';
    if (/\b(?:colleague|co-?worker|teammate|friend|someone else|another person)(?:s)?\b/.test(query)
        && /\btemplates?\b/.test(query) && /\b(?:list|show|see|which|what)\b/.test(query)) return 'other-person-templates';
    if (/\b(?:can|could|would)\s+you\b/.test(query)
        && /\b(?:whether|if)\b.{1,55}\bis\s+(?:an?\s+)?(?:org|region|group)\s+admin\b/.test(query))
        return 'other-person-group-role';
    if (/\b(?:another|other)\s+(?:user|person)\b|\b(?:colleague|co-?worker|teammate)\b/.test(query)
        && /\b(?:organisation|organization)\s+admin\b/.test(query)
        && /\b(?:show|tell|whether|if|see|check)\b/.test(query)) return 'other-person-organization-role';
    if (/\b(?:who|which\s+person)\b/.test(query)
        && /\b(?:changed|edited|updated)\b/.test(query)
        && /\b(?:my\s+)?(?:place|programme|program|service|offering)\s+listing\b/.test(query)) return 'audit-actor-lookup';
    if (/\b(?:saved|my directory)\b/.test(query) && /\bshared\s+map\b/.test(query)
        && /\b(?:colleague|other|someone|anyone|see|view|publish|share)\b/.test(query)) return 'saved-shared-privacy';
    if (/\b(?:region|regional)\s+admin\b/.test(query) && /\btemplates?\b/.test(query)
        && /\b(?:all|every|any)\s+places?\b/.test(query)
        && /\b(?:edit|change|manage)\b/.test(query)) return 'region-template-scope';
    if (/\b(?:org|organisation|organization|region|governance|coordination)\s+groups?\b/.test(query)
        && /\barchiv\w*\b/.test(query) && /\bmembers?\b/.test(query)) return 'archive-group-members';
    if (/\b(?:workbook|spreadsheet|xlsx|csv|excel)\b/.test(query) && /\b(?:import|upload)\b/.test(query)
        && /\b(?:guide|ai|you)\b/.test(query) && /\bpublish\w*\b/.test(query)) return 'workbook-guide-publish';
    if (/\bmy plans?\b/.test(query) && /\b(?:book|reserve|seat|register)\b/.test(query)
        && /\b(?:edit|change|manage)\b/.test(query)
        && /\b(?:programmes?|programs?|services?|offerings?)\b/.test(query)) return 'plan-booking-edit';
    if (/\b(?:saved|my directory)\b/.test(query) && /\b(?:vacanc(?:y|ies)|availability|seats?|spots?)\b/.test(query)
        && /\b(?:today|now|current|live|which)\b/.test(query)) return 'saved-live-availability';
    const group = /\b(?:resource|public)\s+groups?\b|\bgroups?\b|\bpublic\s+resource\s+collection\b/.test(query)
        && !/\b(?:governance|coordination)\s+groups?\b/.test(query);
    const place = /\bplaces?\b/.test(query);
    if (group && /\b(?:private|personal|my)\s+(?:places?|locations?)\b/.test(query)
        && /\b(?:public|share|publish|add|member)\b/.test(query)) return 'private-place-group';
    if (group && place && /\bhidden\b/.test(query)
        && /\b(?:add|member|publish|discover)\b/.test(query)) return 'hidden-place-group';
    if (group && /\b(?:hide|unhide|show)\b/.test(query)
        && /\b(?:places?|members?|resources?)\b/.test(query)
        && /\b(?:without|also|affect|hiding|hide)\b/.test(query)) return 'group-member-visibility';
    if (group && /\b(?:discover|appear|publish|visible|ready)\b/.test(query)
        && /\b(?:discover|publish|public)\b/.test(query)) return 'group-discover';
    if (group && place && /\b(?:create|make|new)\b/.test(query)
        && /\b(?:add|include|member)\b/.test(query)) return 'group-create-member';
    if (/\b(?:programmes?|programs?|services?|offerings?)\b/.test(query)
        && /\b(?:workbook|spreadsheet|xlsx|csv|excel)\b/.test(query)
        && /\b(?:import|upload)\b/.test(query)
        && /\b(?:can i|could i|am i|may i|my account)\b/.test(query)
        && /\b(?:create|add|make)\b/.test(query)) return 'programme-workbook';
    if (/\b(?:my directory|saved?)\b/.test(query)
        && /\bmy plans?\b/.test(query)
        && /\b(?:remove|delete|unsave|cancel)\b/.test(query)
        && /\b(?:programmes?|programs?|services?|offerings?|sessions?)\b/.test(query)) return 'unsave-plan';
    return null;
}

export function answerGuideCompositeQuestion(question, actor) {
    const intent = guideCompositeIntent(question);
    if (!intent) return null;
    const groupRoute = [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }];
    const common = { topicId: 'composite-guidance', answerSource: 'reviewed' };
    if (intent === 'offering-language-version') return { ...common,
        message: 'To read a Programme/service in another app language, use the Language selector in the top navigation; a particular provider listing may still have missing or unclear translated wording. If you manage that listing and Edit is available, open Manage My Resources → Offerings → Edit → Translate, review the language cards and choose Save review. The Guide cannot translate or edit an existing listing in chat, and the server checks permission for that listing.',
        sources: relatedSources('language-choice', 'offering-translation-review'),
        actions: [{ label: 'Open Discover', route: '/discover' }, ...groupRoute] };
    if (intent === 'public-group-people') return { ...common,
        message: 'A public Resource Group collects existing eligible Places and Programmes/services as members; people are not added as its members. Org Groups and Region Groups are separate governance coordination groups with Staff and Admin member access. Choose which type you mean before opening its permission-checked form. The Guide cannot create either Group or add people in chat.',
        sources: relatedSources('resource-groups', 'governance-group-membership', 'guide-create-scope'), actions: groupRoute };
    if (intent === 'other-person-templates') return { ...common,
        message: 'The Guide cannot list a colleague’s Offering templates or infer their template permissions. Ask about the templates this signed-in account can manage, or open Manage My Resources → Templates for your own permission-filtered list. The server checks each template and host Place before a change.',
        sources: relatedSources('offering-template-overview'), actions: groupRoute };
    if (intent === 'other-person-group-role') return { ...common,
        message: 'The Guide cannot check another person’s Group Admin role from chat. An authorised group administrator can open the exact Org Group or Region Group and review Group access; the server scopes who may see or change that group. A Group Admin role does not itself grant editing rights over linked resources.',
        sources: relatedSources('governance-group-membership'), actions: [] };
    if (intent === 'other-person-organization-role') return { ...common,
        message: 'The Guide cannot check another person’s Organisation Admin role or show their memberships from chat. An authorised Organisation Admin can review access for an organisation they administer in Organisation Workspace; the server limits that view to their current scope. Ask whether this signed-in account can open Organisation Workspace to check your own access.',
        sources: relatedSources('organization-workspace'), actions: [] };
    if (intent === 'audit-actor-lookup') return { ...common,
        message: 'The Guide cannot identify who changed a particular listing without a verified selection. Ask for a current Audit Trail access check; permitted accounts can request a bounded recent resource-update summary. Open Audit Trail for the permitted details using Category, Action type and Organisation filters. If you cannot access it, report the listing and the change you are concerned about without including another person’s private details.',
        sources: relatedSources('audit-trail'), actions: [{ label: 'Open Audit Trail', route: '/dashboard/audit' }] };
    if (intent === 'saved-shared-privacy') return { ...common,
        message: 'Your saved resources in My Directory are scoped to your account. Publishing a Shared Map makes only its selected snapshot available through that link; it does not expose your whole saved list to a colleague. Review the published map before sharing its link.',
        sources: relatedSources('saved-list-privacy'), actions: [{ label: 'Open My Directory', route: GUIDE_SAVED_DIRECTORY_ROUTE }] };
    if (intent === 'region-template-scope') return { ...common,
        message: 'A Region Admin title does not let someone edit every Place in a Region. Editing a Place requires permission for that exact Place. Region Admin can open Offering Templates, but editing or generating a particular template and each host Place still depends on current ownership and scope. Ask about this account’s managed Places and templates for separate scoped lists.',
        sources: relatedSources('regional-admin-place-edit-boundary', 'offering-template-overview'), actions: groupRoute };
    if (intent === 'archive-group-members') return { ...common,
        message: 'A governance group has an Archived status, but the Guide cannot archive it in chat or verify that its members will remain visible after that change. Review the exact group and its Group access in the authorised Org Groups or Region Groups panel before changing status. Do not use the public Resource Group Delete control for this.',
        sources: relatedSources('governance-group-overview', 'governance-group-membership'), actions: [] };
    if (intent === 'workbook-guide-publish') {
        const workbook = answerGuideWorkbookAccessQuestion('Can I import a workbook?', actor);
        return { ...common, answerSource: 'account',
            message: `${workbook.message} The Guide cannot publish services created or updated by an import. Importing does not confirm that a particular listing is visible to visitors; review the resulting listings and their visibility in Manage My Resources.`,
            sources: relatedSources('asset-workbook-import', 'listing-publication-boundary'), actions: workbook.actions };
    }
    if (intent === 'plan-booking-edit') return { ...common,
        message: 'Adding a Programme/service session to My Plans records intended attendance; it does not book or reserve a seat with the provider. Planning it also does not grant permission to edit the provider’s listing. Check Manage My Resources for your separate access to the exact Programme/service, and contact the provider about registration.',
        sources: relatedSources('plans-not-bookings', 'saved-versus-managed'),
        actions: [{ label: 'Open My Plans', route: '/dashboard/calendar?section=plans' }] };
    if (intent === 'saved-live-availability') return { ...common,
        message: 'The Guide cannot determine which of your saved resources has a vacancy today from My Directory. A displayed availability count may not be live or guarantee a seat. Open the current Programme/service details and contact its provider to confirm places, eligibility and registration.',
        sources: relatedSources('provider-availability'), actions: [{ label: 'Open My Directory', route: GUIDE_SAVED_DIRECTORY_ROUTE }] };
    if (intent === 'private-place-group') return { ...common,
        message: 'A private My Place is a planning location in My Directory, not a public directory Place. It cannot be selected as a member of a public Resource Group, and it is excluded from a published Shared Map. Your owner map exports can include personal places, so review a download before sharing it. To share a location publicly, ask an authorised resource manager about creating a public Place and review its visibility before publishing.',
        sources: relatedSources('personal-place-sharing', 'group-edit'),
        actions: [{ label: 'Open My Places', route: '/my-directory?section=my-places' }] };
    if (intent === 'hidden-place-group') return { ...common,
        message: 'A hidden Place is not eligible to be selected as a public Resource Group member. Publishing a Group does not publish or unhide its member listings. Check the Place’s own visibility and the Group’s owner, public members and target Regions separately before relying on Discover.',
        sources: relatedSources('group-create', 'group-edit'),
        actions: groupRoute };
    if (intent === 'group-member-visibility') {
        const access = answerGuideGroupAccessQuestion('Can I hide a Resource Group?', actor);
        return { ...common, answerSource: 'account',
            message: `Hiding a Resource Group changes the Group listing, not the visibility of its member Places or Programmes/services. ${access.message}`,
            sources: relatedSources('group-edit'),
            canCheckManagedListing: access.canCheckManagedListing, actions: access.actions };
    }
    if (intent === 'group-discover') return { ...common,
        message: 'Managing a Resource Group does not mean it automatically appears in Discover. The Group must have an owner, be public and not hidden, have eligible public members, and meet any target-Region requirements. Check the Group’s current details in Manage My Resources; the Guide cannot confirm a particular Group’s public visibility from its management assignment alone.',
        sources: relatedSources('group-create'),
        actions: groupRoute };
    if (intent === 'group-create-member') {
        const access = answerGuideGroupAccessQuestion('Can I create a Resource Group?', actor);
        return { ...common, answerSource: 'account',
            message: `${access.message} A Place does not need to be assigned to you personally to be considered as a Group member, but it must be an existing eligible public, non-hidden Place. The server checks the Group creation permission and each selected member when you save; the Guide cannot create or publish the Group for you.`,
            sources: relatedSources('group-create', 'group-edit'),
            actions: access.actions };
    }
    if (intent === 'programme-workbook') {
        const programme = answerGuideResourceAccessQuestion('Can I create a Programme/service?', actor);
        const workbook = answerGuideWorkbookAccessQuestion('Can I import a workbook?', actor);
        return { ...common, answerSource: 'account',
            message: `${programme.message} ${workbook.message}`,
            sources: relatedSources('asset-workbook-import'),
            actions: [...new Map([...programme.actions, ...workbook.actions].map((action) => [action.route, action])).values()] };
    }
    return { ...common,
        message: 'Removing a saved Programme/service from My Directory removes it from your saved list; it does not itself remove a personal session already in My Plans or cancel a booking with the provider. Its saved schedule may stop appearing in Care Calendar after you unsave it. Check My Plans separately, and contact the provider about any registration.',
        sources: relatedSources('saved-resource-removal', 'remove-plan'),
        actions: [{ label: 'Open My Plans', route: '/dashboard/calendar?section=plans' }] };
}
