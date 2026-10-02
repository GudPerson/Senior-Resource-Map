const HELP_ROUTE_PATTERN = /^\/help-centre\/[a-z0-9]+(?:-[a-z0-9]+)*(?:#[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const HELP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEARCH_STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'at', 'be', 'can', 'carearound', 'do', 'does', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'my', 'of', 'on', 'or', 'sg', 'that', 'the', 'this', 'to', 'use', 'with', 'you', 'your']);
const SEARCH_WORDS = { places: 'place', maps: 'map', resources: 'resource', services: 'service', programmes: 'programme', sessions: 'session', saved: 'save', saving: 'save', sharing: 'share', shared: 'share', printing: 'print', exports: 'export', exporting: 'export' };

// Reading links and action destinations deliberately have different allowlists.
export function safeHelpArticleRoute(route) {
    return typeof route === 'string' && route.length <= 280 && HELP_ROUTE_PATTERN.test(route) ? route : null;
}

export function helpArticleRoute(slug, sectionId = '') {
    if (!HELP_SLUG_PATTERN.test(slug || '') || (sectionId && !HELP_SLUG_PATTERN.test(sectionId))) return null;
    return safeHelpArticleRoute(`/help-centre/${slug}${sectionId ? `#${sectionId}` : ''}`);
}

export function normalizeHelpQuery(value = '') {
    return String(value).normalize('NFKC').trim().slice(0, 120);
}

function searchWords(value) {
    return String(value).normalize('NFKC').toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu)?.map((word) => SEARCH_WORDS[word] || word) || [];
}

function sectionText(article) {
    return (article.sections || []).flatMap((section) => [section.title, ...(section.paragraphs || []), ...(section.steps || []), ...(section.notes || [])]).join(' ');
}

export function searchHelpArticles(articles, query = '') {
    const normalized = normalizeHelpQuery(query);
    const words = [...new Set(searchWords(normalized).filter((word) => !SEARCH_STOP_WORDS.has(word)))];
    if (!normalized) return articles;
    if (!words.length) return [];
    return articles.map((article, index) => {
        const title = searchWords(article.title);
        const summary = searchWords(article.summary);
        const body = searchWords(sectionText(article));
        const score = words.reduce((total, word) => total + (title.includes(word) ? 8 : 0) + (summary.includes(word) ? 4 : 0) + (body.includes(word) ? 1 : 0), 0);
        return { article, index, score };
    }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.index - b.index).map(({ article }) => article);
}

export function mergeHelpArticles(publicArticles, permittedArticles = []) {
    const articles = [...publicArticles];
    const knownIds = new Set(articles.map((article) => article.id));
    const knownSlugs = new Set(articles.map((article) => article.slug));
    for (const article of permittedArticles) {
        if (!article || typeof article.id !== 'string' || typeof article.title !== 'string' || typeof article.summary !== 'string'
            || !helpArticleRoute(article.slug) || knownIds.has(article.id) || knownSlugs.has(article.slug)) continue;
        articles.push(article); knownIds.add(article.id); knownSlugs.add(article.slug);
    }
    return articles;
}

export function mergeHelpCategories(publicCategories, permittedCategories = []) {
    const categories = [...publicCategories];
    const knownIds = new Set(categories.map((category) => category.id));
    for (const category of permittedCategories) {
        if (!category || !HELP_SLUG_PATTERN.test(category.id || '') || typeof category.title !== 'string' || knownIds.has(category.id)) continue;
        categories.push({ id: category.id, title: category.title }); knownIds.add(category.id);
    }
    return categories;
}

export function helpIdentityKey(user, isImpersonating = false, isLoading = false) {
    return `${user?.id || 'guest'}:${user?.role || ''}:${Boolean(isImpersonating || user?.isImpersonating)}:${Boolean(isLoading)}`;
}

export function canReadAccountHelp(user, isImpersonating = false, isLoading = false) {
    return Boolean(user?.id) && user?.role !== 'guest' && !isLoading && !isImpersonating && !user?.isImpersonating;
}

export function helpAudienceLabel(audience) {
    return ({ everyone: 'Everyone', public: 'Everyone', guest: 'Visitors', caregiver: 'Caregivers', 'standard user': 'CareAround users', 'resource owner': 'Resource Owners', 'resource staff': 'Resource Staff', visitor: 'Visitors', visitors: 'Visitors', users: 'CareAround users', 'standard-user': 'CareAround users', 'signed-in': 'Signed-in users', 'signed-in-users': 'Signed-in users', providers: 'Resource teams', provider: 'Resource teams', staff: 'Resource staff', 'provider-staff': 'Resource teams', 'resource-manager': 'Resource managers', 'place-owner': 'Place Owners', 'place-staff': 'Place Staff', admin: 'Administrators', admins: 'Administrators', 'super-admin': 'Super Admins', 'super_admin': 'Super Admins', 'organisation-admin': 'Organisation Admins', organisation: 'Organisation teams', organization: 'Organisation teams', 'organization-admin': 'Organisation Admins', support: 'Support reviewers', 'support-review': 'Support reviewers', audit: 'People with Audit Trail access' })[audience] || 'CareAround users';
}

export function formatHelpReviewedDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}
