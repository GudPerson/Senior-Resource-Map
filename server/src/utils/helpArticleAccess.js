import { normalizeRole } from './roles.js';
import { canRequestManagedResourceList } from './resourceListScope.js';
import { canReviewSupport } from './supportDomain.js';
import { loadGuideOrganizationAccess } from './guideOrganizationAccess.js';
import { loadGuideAuditAccess } from './guideAuditAccess.js';

const signedIn = (actor) => Boolean(actor?.id) && normalizeRole(actor.role) !== 'guest' && !actor.isImpersonating;

// Audience labels organise navigation; only visibility controls delivery.
// Unknown policies deny access, including for administrators.
export function canReadHelpContent(record, actor = null, capabilities = {}) {
    const visibility = record?.visibility ?? 'public';
    if (visibility === 'public') return true;
    if (!signedIn(actor)) return false;
    switch (visibility) {
        case 'signed-in': return true;
        case 'resource-manager': return canRequestManagedResourceList(actor);
        case 'organization': return capabilities.organization?.workspaceView === true
            || capabilities.organization?.platformAdmin === true;
        case 'admin': return ['super_admin', 'regional_admin'].includes(normalizeRole(actor.role));
        case 'support-review': return canReviewSupport(actor);
        case 'audit': return ['all', 'organizations'].includes(capabilities.audit?.mode);
        default: return false;
    }
}

export function visibleHelpArticles(articles = [], actor = null, capabilities = {}) {
    return articles.filter((article) => canReadHelpContent(article, actor, capabilities)).map((article) => ({
        ...article, sections: (article.sections || []).filter((section) => canReadHelpContent(section, actor, capabilities)),
    }));
}

export function publicGuideFacts(facts = []) {
    // Current Guide inference intentionally has no restricted-evidence capability.
    return facts.filter((fact) => (fact.visibility ?? 'public') === 'public');
}

export async function loadHelpArticleCapabilities(actor, env, articles = [], {
    organization = loadGuideOrganizationAccess, audit = loadGuideAuditAccess,
} = {}) {
    if (!signedIn(actor)) return {};
    const policies = new Set(articles.flatMap((article) => [article.visibility, ...(article.sections || []).map((section) => section.visibility)]));
    const capabilities = {};
    // Existing loaders verify active membership. A failed lookup denies only
    // that capability; approved public reading remains available.
    if (policies.has('organization')) {
        try { capabilities.organization = await organization(actor, env); } catch { capabilities.organization = null; }
    }
    if (policies.has('audit')) {
        try { capabilities.audit = await audit(actor, env); } catch { capabilities.audit = null; }
    }
    return capabilities;
}
