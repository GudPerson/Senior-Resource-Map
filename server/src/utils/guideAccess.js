import { normalizeRole } from './roles.js';
import { canRequestManagedResourceList } from './resourceListScope.js';
import { getActiveHardAssetStaffAccess } from './hardAssetStaff.js';
import { hasAnyPartnerStaffAccess } from './partnerStaff.js';

export function guideWorkbookAccessIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    const importIntent = /\b(?:import|upload)\b/.test(query);
    const templateDownloadIntent = /\b(?:download|get)\b/.test(query)
        && /\b(?:asset|offering|programme|program|template|rollout|standalone)\b/.test(query);
    if (/^how\b/.test(query)
        || !/\b(?:workbook|spreadsheet|xlsx|csv|excel)\b/.test(query)
        || !(importIntent || templateDownloadIntent)
        || /\b(?:personal places?|my maps?|map assets?|map notes?|my directory|saved resources?)\b/.test(query)
        || !/\b(?:can i|could i|am i|do i|may i|my account)\b/.test(query)) return null;
    return importIntent ? 'import' : 'download';
}

export function answerGuideWorkbookAccessQuestion(question, user) {
    const intent = guideWorkbookAccessIntent(question);
    if (!intent) return null;
    const role = normalizeRole(user?.role);
    if (!user?.id || role === 'guest') return {
        topicId: 'workbook-access', message: 'Sign in to check whether this account has the Asset Workbook Tools.',
        actions: [{ label: 'Sign in', route: '/login' }],
    };
    if (user.isImpersonating) return {
        topicId: 'workbook-access', message: 'Exit User View to check your own workbook-import access.', actions: [],
    };
    if (role !== 'super_admin') return {
        topicId: 'workbook-access',
        message: 'The current Admin Data Tools workbook-import screen is not available to this account. It is shown to Super Admin. Creating a Programme/service at an assigned Place does not grant bulk workbook import or workbook template access, and the Guide cannot upload a workbook for you.',
        actions: [],
    };
    return {
        topicId: 'workbook-access',
        message: intent === 'download'
            ? 'This account can open Admin → Data Tools → Asset Workbook Tools. Choose Offering Templates or Template Rollouts for the matching Excel template, then choose Download Template. Downloading does not import or create anything. Upload Workbook is a separate immediate bulk action; review any file before using it. The Guide cannot download account-only files in chat.'
            : 'This account can open Admin → Data Tools → Asset Workbook Tools. Choose the matching resource type, download and check its template, then use Upload Workbook only when ready: upload starts the bulk import immediately and may create or update rows. Check the Import Report afterward. This is separate from the Guide’s reviewed Programme/service Create action.',
        actions: [{ label: 'Open Admin', route: '/dashboard/admin' }],
    };
}

export function guideTemplateAccessIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!/\btemplates?\b|\bplace\s+versions?\b/.test(query)
        || /\b(?:workbook|spreadsheet|xlsx|csv|excel|boundary|metadata)\b/.test(query)
        || !/\b(?:can i|could i|am i|do i|may i|my account)\b/.test(query)
        || /^how\b/.test(query)) return null;
    if (/^(?:what|which|list|show)\b/.test(query)
        && /\b(?:manage|managed|edit|own|owned|access)\b/.test(query)) return 'list';
    if ((/\b(?:generate|roll\s*out|from\s+(?:a|the)\s+template)\b/.test(query)
        || (/\bplace\s+versions?\b/.test(query) && /\b(?:create|make)\b/.test(query)))
        && /\b(?:create|make|generate|roll\s*out)\b/.test(query)) return 'generate';
    if (/\b(?:delete|remove)\b/.test(query)) return 'delete';
    if (/\b(?:edit|change|update)\b/.test(query)) return 'edit';
    if (/\b(?:create|add|make|new|start)\b/.test(query)) return 'create';
    if (/\b(?:access|manage|view|see|open|allowed|authori[sz]ed)\b/.test(query)) return 'access';
    return null;
}

export function canOpenGuideTemplateTools(user) {
    const role = normalizeRole(user?.role);
    return Boolean(user?.id) && !user.isImpersonating && role !== 'guest'
        && (['super_admin', 'regional_admin', 'partner'].includes(role) || hasAnyPartnerStaffAccess(user));
}

export function answerGuideTemplateAccessQuestion(question, user, templates = undefined) {
    const intent = guideTemplateAccessIntent(question);
    if (!intent) return null;
    const role = normalizeRole(user?.role);
    if (!user?.id || role === 'guest') return {
        topicId: 'template-access', message: 'Sign in to check this account’s Offering-template access.',
        actions: [{ label: 'Sign in', route: '/login' }],
    };
    if (user.isImpersonating) return {
        topicId: 'template-access', message: 'Exit User View to check your own Offering-template access.', actions: [],
    };
    const canOpenTemplates = canOpenGuideTemplateTools(user);
    if (!canOpenTemplates) return {
        topicId: 'template-access',
        message: 'This account does not currently have access to create or manage Offering templates. Managing an assigned Place alone does not grant template access. The Guide cannot create or change a template in chat.',
        actions: [],
    };
    if (intent === 'list' && templates === undefined) return null;
    const detail = intent === 'list'
        ? templates.totalCount > 0
            ? `This account can manage ${templates.totalCount} Offering template${templates.totalCount === 1 ? '' : 's'}: ${templates.names.join('; ')}${templates.totalCount > templates.names.length ? '; and more' : ''}. Open Manage My Resources → Templates for the full, current list. This list does not prove edit, generation or deletion permission for a particular template or host Place.`
            : 'I found no Offering templates this account may manage right now. Open Manage My Resources → Templates to check the current list.'
        : intent === 'create'
        ? 'This account can open New Template in Manage My Resources. The selected ownership and audience are checked when saving; this does not confirm permission to generate a version at any particular Place.'
        : `This account can open Templates in Manage My Resources, but ${intent === 'generate' ? 'generation for' : `${intent} access to`} a particular template${intent === 'generate' ? ' and each selected host Place' : ''} depends on its current ownership and scope. The server checks the exact selection before a change.`;
    return {
        topicId: 'template-access',
        message: `${detail} The Guide cannot create, edit, delete or generate Offering templates and place versions in chat.`,
        actions: [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }],
    };
}

export function guideLifecycleAccessIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    // Organisation ownership is not the ordinary Place edit-permission check.
    if (/\b(?:places?|centres?|centers?)\b/.test(query)
        && /\b(?:organisations?|organizations?|partners?|providers?)\b/.test(query)
        && /\b(?:transfer|reassign|change\s+(?:the\s+)?(?:owner(?:ship)?|owning\s+organi[sz]ation))\b/.test(query)) return null;
    if (/^how\b/.test(query)
        || /\b(?:personal\s+places?|my\s+places|my\s+maps?|my\s+directory|my\s+plans?|care\s+calendar|saved|favo(?:u)?rites?|heart|booking|registration)\b/.test(query)
        || /\b(?:from|off|on)\s+(?:(?:one|a|my|the|this|that)\s+)?maps?\b/.test(query)
        || (/\b(?:region|regional)\s+admin\b/.test(query) && /\b(?:any|all|every)\s+places?\b/.test(query))
        || /\b(?:resource|public|governance|coordination)\s+groups?\b/.test(query)
        || !(/\b(?:can i|could i|am i|do i|may i|my account)\b/.test(query)
            || /\bwhich\b.{0,50}\bresources?\b.{0,25}\bi\s+can\b/.test(query))
        || !/\b(?:resources?|places?|programmes?|programs?|services?|offerings?|listings?)\b|\bthis one\b/.test(query)) return null;
    if (/\b(?:delete|remove)\b/.test(query)) return 'delete';
    if (/\b(?:hide|unhide|show)\b/.test(query)) return 'visibility';
    if (/\b(?:edit|change|update)\b/.test(query)) return 'edit';
    return null;
}

export function answerGuideLifecycleAccessQuestion(question, user) {
    const intent = guideLifecycleAccessIntent(question);
    if (!intent) return null;
    const role = normalizeRole(user?.role);
    if (!user?.id || role === 'guest') return {
        topicId: 'lifecycle-access', message: 'Sign in to check this account’s access to Manage My Resources.',
        actions: [{ label: 'Sign in', route: '/login' }],
    };
    if (user.isImpersonating) return {
        topicId: 'lifecycle-access', message: 'Exit User View to check your own resource-management access.', actions: [],
    };
    if (!canRequestManagedResourceList(user)) return {
        topicId: 'lifecycle-access',
        message: 'This account does not currently have Manage My Resources access. Saving a Place or Offering in My Directory does not grant editing, visibility or deletion rights.',
        actions: [],
    };
    const action = intent === 'visibility' ? 'hide or show' : intent;
    return {
        topicId: 'lifecycle-access',
        message: `This account can open Manage My Resources, but that alone does not confirm it may ${action} a particular Place or Offering. Choose the exact managed listing below to check its current edit, visibility and deletion permissions; the server rechecks permission before a change is saved. The Guide cannot make this change for you.`,
        canCheckManagedListing: true,
        actions: [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }],
    };
}

export function guideGroupAccessIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (/^how\b/.test(query) || /\b(?:governance|coordination)\s+groups?\b/.test(query)
        || !/\b(?:resource|public)\s+groups?\b/.test(query)
        || !/\b(?:can i|could i|am i|do i|may i|my account)\b/.test(query)) return null;
    // Staff-only visibility is a product-setting question, not a request to create a Group.
    if (/\bstaff[-\s]*only\b|\bonly\s+(?:to|for)\s+(?:my\s+)?staff\b/.test(query)) return null;
    if (/^(?:what|which|list|show|where)\b/.test(query)
        && /\b(?:manage|managed|assigned|own|owned)\b/.test(query)) return null;
    if (/^do i\b/.test(query)
        && /\b(?:manage|managed|assigned|own|owned)\b/.test(query)
        && !/\b(?:add|remove|edit|change|update|delete|hide|unhide|create|make|start)\b/.test(query)) return null;
    if (/\b(?:add|remove)\b.*\b(?:place|programme|program|service|offering|member)s?\b.*\bgroup\b/.test(query)) return 'edit';
    if (/\b(?:edit|change|manage|update)\b/.test(query)) return 'edit';
    if (/\b(?:delete|remove)\b/.test(query)) return 'delete';
    if (/\b(?:hide|unhide|show)\b/.test(query)) return 'visibility';
    if (/\b(?:create|make|start)\b|\badd\s+(?:a\s+|new\s+)?(?:resource|public)\s+group\b/.test(query)) return 'create';
    return null;
}

export function answerGuideGroupAccessQuestion(question, user) {
    const intent = guideGroupAccessIntent(question);
    if (!intent) return null;
    const role = normalizeRole(user?.role);
    if (!user?.id || role === 'guest') return {
        topicId: 'group-access', message: 'Sign in to check this account’s Resource Group access.',
        actions: [{ label: 'Sign in', route: '/login' }],
    };
    if (user.isImpersonating) return {
        topicId: 'group-access', message: 'Exit User View to check your own Resource Group access.', actions: [],
    };
    const canManage = canRequestManagedResourceList(user);
    const actions = canManage ? [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }] : [];
    if (intent === 'edit') {
        const crossProviderMember = /\b(?:another|other)\s+(?:providers?|organisations?|organizations?)\b/i
            .test(String(question).replace(/[’']/g, '')) && /\b(?:add|adding|include)\b/i.test(question);
        // Group membership never grants access to edit the member listing.
        const memberContext = crossProviderMember
            ? 'An eligible public, non-hidden Place or Offering from another provider may be included in a Resource Group. This does not give you editing rights to that member listing. '
            : '';
        return {
            topicId: 'group-access',
            message: canManage
                ? `${memberContext}Open Manage My Resources and choose Groups. Edit is available only on a Group this account may edit. Choose the exact managed Group below to check its current permission. A Resource Group is separate from a governance coordination group.`
                : `${memberContext}This account does not currently have Manage My Resources access to edit Resource Groups.`,
            actions, canCheckManagedListing: canManage,
        };
    }
    if (intent === 'delete' || intent === 'visibility') return {
        topicId: 'group-access',
        message: canManage
            ? `Open Manage My Resources and choose Groups. This account’s general resource access does not confirm it may ${intent === 'delete' ? 'delete' : 'hide or show'} a particular Group. Choose the exact managed Group below to check its current permission; the server rechecks before a change is saved. The Guide cannot make this change for you.`
            : 'This account does not currently have Manage My Resources access to change Resource Groups.',
        actions, canCheckManagedListing: canManage,
    };
    const canCreate = canManage && (['super_admin', 'admin', 'regional_admin', 'partner'].includes(role)
        || hasAnyPartnerStaffAccess(user));
    return {
        topicId: 'group-access',
        message: canCreate
            ? 'This account can open New Group in Manage My Resources. The form requires an owner and checks any selected target Regions before saving; selected members must be eligible public resources. A Group without public members is not ready for Discover. This creates a Resource Group, not a governance coordination group.'
            : 'This account cannot create a new Resource Group. New Group requires an admin or partner resource-staff role; managing an assigned Place alone does not grant it.',
        actions,
    };
}

export function guideStandaloneOfferingIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    return /\b(?:offerings?|programmes?|programs?|services?|activities?|events?)\b/.test(query)
        && (/\bstandalone\b/.test(query)
            || /\b(?:without|no|not|unlinked|unattached)\b.{0,45}\b(?:places?|centres?|centers?|hosts?)\b/.test(query)
            || /\b(?:places?|centres?|centers?|hosts?)\b.{0,45}\b(?:without|not|unlinked|unattached)\b/.test(query))
        && (/\b(?:create|add|make|start|publish|list)\b/.test(query)
            || /\bstandalone\b/.test(query) && /\b(?:possible|allowed)\b/.test(query));
}

function answerGuideStandaloneOfferingQuestion(question, user) {
    if (!guideStandaloneOfferingIntent(question)) return null;
    const role = normalizeRole(user?.role);
    if (!user?.id || role === 'guest') return {
        topicId: 'resource-access', message: 'CareAround supports a standalone Programme/service without a linked Place. Sign in to check whether this account can open New Offering; the Guide cannot create a standalone Offering in chat.',
        actions: [{ label: 'Sign in', route: '/login' }],
    };
    if (user.isImpersonating) return {
        topicId: 'resource-access', message: 'Exit User View before checking your own New Offering access. The Guide cannot create a standalone Offering in chat.', actions: [],
    };
    const canCreate = ['super_admin', 'admin', 'regional_admin', 'partner'].includes(role)
        || hasAnyPartnerStaffAccess(user);
    return { topicId: 'resource-access',
        message: canCreate
            ? 'CareAround supports a standalone Programme/service without a linked Place. This account can open Manage My Resources → New Offering, leave Host Locations empty, and choose at least one service Region or a permitted Audience Zone. Review Visibility, including Public or Target areas, linked-member access and whether the listing is hidden; creation alone does not guarantee every visitor can see it. The server checks the owner, coverage, and final visibility when saving. The Guide’s reviewed Create action currently requires a manageable Place and cannot create a standalone Offering.'
            : 'CareAround supports a standalone Programme/service without a linked Place, but this account cannot open New Offering for one. Place staff may instead use Add Offering on a Place they can edit; the Guide’s reviewed Create action also requires a manageable Place. Ask an authorised resource manager if a standalone Offering is needed. Visibility and audience still determine who can see a listing; the Guide cannot publish a standalone Offering in chat.',
        actions: [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }] };
}

function resourceAccessIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (/\b(?:resource|public)\s+groups?\b/.test(query)) return null;
    if (/\btemplates?\b|\bplace\s+versions?\b/.test(query)) return null;
    // My Places are private planning locations, not the public Place resource
    // whose creation and management permissions are checked here.
    if (/\bpersonal\s+places?\b|\bmy\s+places\b|\bprivate\s+planning\s+places?\b/.test(query)) return null;
    if (/\b(?:workbook|spreadsheet|xlsx|csv|excel)\b/.test(query)
        && /\b(?:import|upload)\b/.test(query)) return null;
    const asksAboutSelf = /\b(?:am i|can i|could i|do i|im|i am|my account)\b/.test(query);
    const asksAboutResources = /\b(?:resources?|places?|programmes?|programs?|services?|offerings?)\b/.test(query);
    const asksPermission = /\b(?:allow(?:ed)?|authori[sz]ed|permitted|permissions?|able|rights|resource manager)\b/.test(query)
        || (/\baccess\b/.test(query) && /\b(?:manage|management|resource manager)\b/.test(query));
    const asksHowToCreateSpecificType = /\b(?:how do i|how can i)\b/.test(query)
        && /\b(?:places?|programmes?|programs?|services?|offerings?)\b/.test(query);
    const asksToCreate = (/\b(?:can i|could i)\b/.test(query) || asksHowToCreateSpecificType)
        && (/\b(?:create|make)\b/.test(query)
            || /\badd\s+(?:a\s+)?(?:new\s+)?(?:resource|place|programme|program|service|offering)\b/.test(query)
            || /\bmanage\s+(?:a\s+|the\s+|my\s+)?(?:resource|place|programme|program|service|offering)s?\b/.test(query));
    if (!asksAboutSelf || !asksAboutResources || !(asksPermission || asksToCreate)
        || (/^how\b/.test(query) && !asksPermission && !asksToCreate)) return null;
    // Contrasting resource types need both independently checked capabilities.
    if (/\bplaces?\b/.test(query) && /\b(?:programmes?|programs?|services?|offerings?)\b/.test(query)
        && /\b(?:or|and|both|also|versus|vs)\b/.test(query)) return 'resource';
    if (/\b(?:create|add|make|start|set\s+up)\b.*\b(?:programmes?|programs?|services?|offerings?)\b/.test(query)) return 'programme';
    if (/\bplaces?\b/.test(query)) return 'place';
    if (/\b(?:programmes?|programs?|services?|offerings?)\b/.test(query)) return 'programme';
    return 'resource';
}

export function isGuideResourceAccessQuestion(question) {
    return guideTemplateAccessIntent(question) !== null || guideWorkbookAccessIntent(question) !== null
        || guideGroupAccessIntent(question) !== null || guideLifecycleAccessIntent(question) !== null
        || guideStandaloneOfferingIntent(question) || resourceAccessIntent(question) !== null;
}

export function answerGuideResourceAccessQuestion(question, user) {
    const templateAnswer = answerGuideTemplateAccessQuestion(question, user);
    if (templateAnswer) return templateAnswer;
    const workbookAnswer = answerGuideWorkbookAccessQuestion(question, user);
    if (workbookAnswer) return workbookAnswer;
    const groupAnswer = answerGuideGroupAccessQuestion(question, user);
    if (groupAnswer) return groupAnswer;
    const lifecycleAnswer = answerGuideLifecycleAccessQuestion(question, user);
    if (lifecycleAnswer) return lifecycleAnswer;
    const standaloneAnswer = answerGuideStandaloneOfferingQuestion(question, user);
    if (standaloneAnswer) return standaloneAnswer;
    const intent = resourceAccessIntent(question);
    if (!intent) return null;
    const role = normalizeRole(user?.role);
    const signedIn = Boolean(user?.id) && role !== 'guest';
    if (!signedIn) return {
        topicId: 'resource-access',
        message: 'Sign in to check this account’s resource permissions. You can still find public resources in Discover without creating a listing.',
        actions: [{ label: 'Sign in', route: '/login' }],
    };
    if (user.isImpersonating) return {
        topicId: 'resource-access',
        message: 'You are in User View. Exit User View to check your own resource permissions and use Guide actions.',
        actions: [],
    };

    const canManage = canRequestManagedResourceList(user);
    const canCreatePlace = ['super_admin', 'admin', 'regional_admin', 'partner'].includes(role)
        || hasAnyPartnerStaffAccess(user);
    const canCreateProgramme = role === 'super_admin'
        || (canManage && getActiveHardAssetStaffAccess(user).length > 0);
    const manage = canManage
        ? 'This account has resource-management access.'
        : 'This account does not currently have resource-management access.';
    const place = canCreatePlace
        ? 'This account can open New Place in Manage My Resources. The selected location and your scope are checked before a Place is created.'
        : 'This account cannot create a new Place.';
    const programme = canCreateProgramme
        ? 'It can prepare a Programme/service at a Place it manages. Ask the Guide to create a Programme/service, select the Place, review the draft, then choose Create.'
        : 'It cannot create a Programme/service through the Guide without access to a manageable Place.';
    const message = (intent === 'place' ? [place, manage, programme]
        : intent === 'programme' ? [programme, manage] : [manage, place, programme]).join(' ');
    return { topicId: 'resource-access', message,
        actions: canManage ? [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }] : [] };
}
