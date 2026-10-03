import { Hono } from 'hono';
import { HELP_CONTENT_DIGEST, HELP_ARTICLES } from '../generated/helpKnowledge.js';
import { canReadHelpContent, loadHelpArticleCapabilities } from '../utils/helpArticleAccess.js';
import { addGuideHelpCitations, answerGuideHelpWorkflow, guideAnswerHelpFacts, guideHelpWorkflowIntent, guideHelpFactSource } from '../utils/guideHelpWorkflows.js';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth.js';
import { requirePlatformDirectoryAccess } from '../middleware/platformAccess.js';
import { createRateLimiter } from '../middleware/security.js';
import { getHardAssets } from '../controllers/hardAssetsController.js';
import { getSoftAssets } from '../controllers/softAssetsController.js';
import { GUIDE_TOPICS, GUIDE_KNOWLEDGE_VERSION, answerGuideQuestion, extractGuideSearchCriteria, serializeGuideResource } from '../utils/guideKnowledge.js';
import { sanitizeSupportText } from '../utils/supportDomain.js';
import { normalizeRole } from '../utils/roles.js';
import { canRequestManagedResourceList } from '../utils/resourceListScope.js';
import { createGuideHistoryRoutes } from './guideHistory.js';
import { createGuideActionRoutes } from './guideActions.js';
import { answerGuideWithCloudflare, guideChatAvailable, safeGuideChatTurns } from '../utils/guideChat.js';
import { answerGuideStudioFollowup } from '../utils/guideProductFollowup.js';
import { answerGuideManagedResources, createGuideManagedAccessLoader, createGuideManagedResourceLoader, guideManagedResourceIntent } from '../utils/guideManagedResources.js';
import { answerGuideNavigationQuestion } from '../utils/guideNavigation.js';
import { answerGuideSavedResources, createGuideSavedResourceLoader, guideSavedResourceIntent } from '../utils/guideSavedResources.js';
import { answerGuidePersonalPlaces, createGuidePersonalPlaceLoader, guidePersonalPlaceIntent } from '../utils/guidePersonalPlaces.js';
import { answerGuidePlans, createGuidePlansLoader, guidePlansIntent } from '../utils/guidePlans.js';
import { answerGuideOracleFact, answerGuideUnverifiedWorkflow } from '../utils/guideOracleKnowledge.js';
import { guideReviewedRelationFact } from '../utils/guideProductRelations.js';
import { answerGuideGroupAccessQuestion, answerGuideLifecycleAccessQuestion, answerGuideResourceAccessQuestion, answerGuideTemplateAccessQuestion, answerGuideWorkbookAccessQuestion, guideTemplateAccessIntent } from '../utils/guideAccess.js';
import { createGuideTemplateLoader } from '../utils/guideTemplates.js';
import { answerGuideCompositeQuestion, guideCompositeIntent } from '../utils/guideCompositeQuestions.js';
import { answerGuideVerifiedBoundaryQuestion } from '../utils/guideVerifiedBoundary.js';
import { answerGuideAuditAccess, guideAuditAccessIntent, loadGuideAuditAccess } from '../utils/guideAuditAccess.js';
import { answerGuideAuditActivity, createGuideAuditActivityLoader, guideAuditActivityIntent } from '../utils/guideAuditActivity.js';
import { answerGuideOrganizationAccess, guideOrganizationAccessIntent, loadGuideOrganizationAccess } from '../utils/guideOrganizationAccess.js';
import { answerGuideGovernanceGroupCreation, guideGovernanceGroupCreationIntent } from '../utils/guideGovernanceGroups.js';
import { answerGuideOwnRegionScope, createGuideOwnRegionScopeLoader, guideOwnRegionScopeIntent } from '../utils/guideOwnRegionScope.js';

// Internal requests reuse existing visibility/eligibility-aware public controllers.
// No caller headers, identity, region, managed scope, or private profile are forwarded.
export function createGuideResourceLoader({ hard = getHardAssets, soft = getSoftAssets, pageSize = 10, keyset = false } = {}) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new Error('Invalid Guide page size.');
    const resources = new Hono();
    resources.use('*', async (c, next) => {
        c.set('user', { role: 'guest' });
        // This context is set only on internal scan requests, never from headers
        // or query flags accepted by the application's public resource routes.
        if (keyset) c.set('publicResourceScan', { beforeId: Number(c.req.query('scanBefore')) || null });
        await next();
    });
    resources.get('/hard', hard);
    resources.get('/soft', soft);
    return async (criteria, env) => {
        const types = (criteria.type === 'all' ? ['hard', 'soft'] : [criteria.type])
            .filter((type) => !keyset || criteria.cursor?.[type] !== null);
        const groups = await Promise.all(types.map(async (type) => {
            const params = new URLSearchParams({ q: criteria.query, scope: 'visible', page: keyset ? '1' : String(criteria.page), pageSize: String(pageSize) });
            if (keyset && criteria.cursor?.[type] !== undefined) {
                if (!Number.isSafeInteger(criteria.cursor[type]) || criteria.cursor[type] <= 0) throw new Error('Invalid scan cursor.');
                params.set('scanBefore', String(criteria.cursor[type]));
            }
            if (type === 'hard') params.set('summary', 'true');
            else params.set('assetMode', 'offerings');
            const response = await resources.fetch(new Request(`http://guide.internal/${type}?${params}`), env);
            if (!response.ok) throw new Error('Resource search unavailable');
            const payload = await response.json();
            if (!Array.isArray(payload?.data)) throw new Error('Resource search unavailable');
            const results = payload.data.map((item) => serializeGuideResource(item, type)).filter(Boolean);
            const hasMore = Number(payload.pagination?.totalPages) > (keyset ? 1 : criteria.page);
            if (keyset && (results.length !== payload.data.length || (hasMore && !results.length))) throw new Error('Invalid scan results.');
            return { type, results, hasMore };
        }));
        return { results: groups.flatMap((group) => group.results), hasMore: groups.some((group) => group.hasMore),
            page: criteria.page, scope: 'public',
            discoverRoute: `/discover?${new URLSearchParams({ q: criteria.query })}`,
            ...(keyset ? { nextCursor: { ...criteria.cursor, ...Object.fromEntries(groups.map((group) =>
                [group.type, group.hasMore ? group.results.at(-1).id : null])) } } : {}) };
    };
}

const questionSchema = z.object({ question: z.string().trim().min(1).max(600).optional(),
    topicId: z.enum(GUIDE_TOPICS.map((topic) => topic.id)).optional(),
    pageContext: z.enum(['CareAround', 'Discover', 'My Directory', 'My Maps', 'Manage resources', 'Care Calendar', 'Resource details', 'Dashboard', 'Help Centre']).optional(),
    useAi: z.boolean().optional(),
    turns: z.array(z.object({ question: z.string().max(600), answer: z.string().max(1600) }).strict()).max(4).optional() }).strict()
    .refine((value) => value.question || value.topicId);
export const guideSearchSchema = z.object({ query: z.string().trim().min(2).max(120),
    type: z.enum(['all', 'hard', 'soft']).default('all'), page: z.number().int().min(1).max(100).default(1) }).strict();
const managedAccessSchema = z.string().trim().min(2).max(120);

export function createGuideRoutes({
    authenticate = optionalAuth,
    directoryAccess = requirePlatformDirectoryAccess(),
    search = createGuideResourceLoader(),
    managed = createGuideManagedResourceLoader(),
    managedAccess = createGuideManagedAccessLoader(),
    saved = createGuideSavedResourceLoader(),
    personalPlaces = createGuidePersonalPlaceLoader(),
    plans = createGuidePlansLoader(),
    auditAccess = loadGuideAuditAccess,
    auditActivity = createGuideAuditActivityLoader(),
    organizationAccess = loadGuideOrganizationAccess,
    ownRegionScope = createGuideOwnRegionScopeLoader(),
    templates = createGuideTemplateLoader(),
    historyRepositoryForContext,
    actionOptions,
    helpCapabilities = loadHelpArticleCapabilities,
} = {}) {
    const router = new Hono();
    router.use('*', async (c, next) => {
        c.header('Cache-Control', 'no-store');
        if (c.env?.SUPPORT_INBOX_ENABLED !== 'true') return c.json({ error: 'CareAround Guide is not yet available.' }, 503);
        await next();
    });
    router.use('*', createRateLimiter({ name: 'guide', limit: 60, windowMs: 60000,
        keyFn: (c) => `ip:${c.req.header('cf-connecting-ip') || 'anonymous'}` }));
    router.route('/actions', createGuideActionRoutes(actionOptions));
    router.route('/history', createGuideHistoryRoutes({ authenticate, repositoryForContext: historyRepositoryForContext }));
    router.get('/topics', (c) => c.json({ version: GUIDE_KNOWLEDGE_VERSION, contentDigest: HELP_CONTENT_DIGEST,
        chatMode: guideChatAvailable(c.env) ? c.env.GUIDE_CHAT_SIMULATED === 'true' ? 'simulation' : 'cloudflare' : 'guide',
        topics: GUIDE_TOPICS.map(({ id, title }) => ({ id, title })) }));
    router.use('/answer', async (c, next) => {
        await next();
        if (c.res.status !== 200) return;
        const answer = await c.res.clone().json().catch(() => null);
        if (!answer) return;
        const facts = guideAnswerHelpFacts(answer);
        const restricted = facts.filter((fact) => (fact.visibility ?? 'public') !== 'public');
        if (restricted.length) {
            const articleIds = new Set(restricted.map((fact) => fact.articleId));
            const articles = HELP_ARTICLES.filter((article) => articleIds.has(article.id));
            const capabilities = await helpCapabilities(c.get('user'), c.env, articles);
            if (restricted.some((fact) => !canReadHelpContent(fact, c.get('user'), capabilities))) {
                const publicBoundaryId = answer.topicId === 'composite-guidance' && ({
                    'other-person-group-role': 'guide-other-account-access-boundary',
                    'other-person-organization-role': 'guide-other-account-access-boundary',
                    'public-group-people': 'public-group-people-boundary',
                    'archive-group-members': 'governance-archive-chat-boundary',
                })[guideCompositeIntent(answer.input?.question)];
                const [publicBoundary] = publicBoundaryId ? guideAnswerHelpFacts({ topicId: publicBoundaryId }) : [];
                if (publicBoundary?.visibility === 'public') {
                    c.res = c.json({ ...answer, message: publicBoundary.message, actions: [],
                        sources: [guideHelpFactSource(publicBoundary)], answerSource: 'reviewed' });
                    return;
                }
                // These two existing composites construct only checked permission
                // guidance, not article prose. Keep the account decision and omit
                // any citation to instructions the viewer may not read.
                if (answer.answerSource === 'account' && answer.topicId === 'composite-guidance'
                    && ['programme-workbook', 'workbook-guide-publish'].includes(guideCompositeIntent(answer.input?.question))) {
                    const deniedIds = new Set(restricted.filter((fact) => !canReadHelpContent(fact, c.get('user'), capabilities)).map((fact) => fact.id));
                    c.res = c.json(addGuideHelpCitations({ ...answer, sources: (answer.sources || []).filter((source) => !deniedIds.has(source.id)) }));
                    return;
                }
                c.res = c.json({ version: GUIDE_KNOWLEDGE_VERSION, topicId: 'help-access',
                    message: 'These instructions require current permitted access. Sign in outside User View to check access, or browse the public Help Centre.',
                    actions: [{ label: 'Browse help', route: '/help-centre' }], sources: [],
                    input: answer.input ?? null, answerSource: 'reviewed' });
                return;
            }
        }
        c.res = c.json(addGuideHelpCitations(answer));
    });
    const aiLimiter = createRateLimiter({ name: 'guide-chat', limit: 10, windowMs: 60 * 60 * 1000,
        keyFn: (c) => `user:${c.get('user')?.id || c.req.header('cf-connecting-ip') || 'anonymous'}` });
    router.post('/answer', authenticate, async (c) => {
        const body = await c.req.json().catch(() => null);
        const parsed = questionSchema.safeParse(body);
        if (!parsed.success) return c.json({ error: 'Enter a short app question or choose a help topic.' }, 400);
        const input = { ...(parsed.data.question ? { question: parsed.data.question } : {}),
            ...(parsed.data.topicId ? { topicId: parsed.data.topicId } : {}) };
        if (parsed.data.question && sanitizeSupportText(parsed.data.question) !== parsed.data.question) {
            return c.json({ ...answerGuideQuestion({ topicId: 'privacy' }, c.get('user')), input: null });
        }
        const actor = c.get('user');
        const auditIntent = !parsed.data.topicId && guideAuditActivityIntent(parsed.data.question);
        if (auditIntent) {
            const base = answerGuideAuditActivity({ actor, intent: auditIntent });
            if (base) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...base, input });
            try {
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION,
                    ...answerGuideAuditActivity({ actor, intent: auditIntent,
                        activity: await auditActivity(actor, c.env, auditIntent) }), input });
            } catch { return c.json({ error: 'Recorded resource updates could not be checked right now. No editor has been inferred.' }, 503); }
        }
        if (!parsed.data.topicId && guideOwnRegionScopeIntent(parsed.data.question)) {
            const base = answerGuideOwnRegionScope(actor);
            if (base) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...base, input });
            try {
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION,
                    ...answerGuideOwnRegionScope(actor, await ownRegionScope(actor, c.env)), input });
            } catch { return c.json({ error: 'Your Admin Region Scope could not be checked right now. No assignment has been inferred.' }, 503); }
        }
        if (!parsed.data.topicId && guideAuditAccessIntent(parsed.data.question)) {
            const base = answerGuideAuditAccess(actor);
            if (base) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...base, input });
            try {
                const scope = await auditAccess(actor, c.env);
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION,
                    ...answerGuideAuditAccess(actor, scope), input });
            } catch { return c.json({ error: 'Audit Trail access could not be checked right now. No permission has been inferred.' }, 503); }
        }
        if (!parsed.data.topicId && guideOrganizationAccessIntent(parsed.data.question)) {
            const base = answerGuideOrganizationAccess(actor);
            if (base) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...base, input });
            try {
                const access = await organizationAccess(actor, c.env);
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION,
                    ...answerGuideOrganizationAccess(actor, access), input });
            } catch { return c.json({ error: 'Organisation access could not be checked right now. No permission has been inferred.' }, 503); }
        }
        const governanceGroupCreation = !parsed.data.topicId
            && guideGovernanceGroupCreationIntent(parsed.data.question);
        if (governanceGroupCreation) {
            const base = answerGuideGovernanceGroupCreation(actor, null, governanceGroupCreation);
            if (base) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...base, input });
            try {
                const access = await organizationAccess(actor, c.env);
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION,
                    ...answerGuideGovernanceGroupCreation(actor, access, governanceGroupCreation), input });
            } catch { return c.json({ error: 'Governance-group access could not be checked right now. No permission has been inferred.' }, 503); }
        }
        const workflowIntent = !parsed.data.topicId && guideHelpWorkflowIntent(parsed.data.question,
            parsed.data.pageContext, safeGuideChatTurns(parsed.data.turns));
        const helpWorkflow = workflowIntent === 'public-place-create'
            ? answerGuideResourceAccessQuestion('Can I create a Place?', actor)
            : !parsed.data.topicId && answerGuideHelpWorkflow({ question: parsed.data.question,
                pageContext: parsed.data.pageContext, turns: safeGuideChatTurns(parsed.data.turns) });
        if (helpWorkflow) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...helpWorkflow, input,
            answerSource: workflowIntent === 'public-place-create' ? 'account' : 'reviewed' });
        const navigation = !parsed.data.topicId && answerGuideNavigationQuestion(parsed.data.question,
            parsed.data.pageContext, Boolean(actor?.id) && normalizeRole(actor.role) !== 'guest');
        if (navigation) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...navigation, input, answerSource: 'reviewed' });
        if (!parsed.data.topicId && guideTemplateAccessIntent(parsed.data.question) === 'list'
            && guideManagedResourceIntent(parsed.data.question) === 'list') {
            const managedBase = answerGuideManagedResources({ question: parsed.data.question, actor });
            const templateBase = answerGuideTemplateAccessQuestion(parsed.data.question, actor);
            if (!managedBase || !templateBase) {
                let directoryAllowed = false;
                const deniedResponse = await directoryAccess(c, async () => { directoryAllowed = true; });
                if (!directoryAllowed) return deniedResponse;
            }
            try {
                const [groups, templateList] = await Promise.all([
                    managedBase ? Promise.resolve(null) : managed(actor, c.env),
                    templateBase ? Promise.resolve(null) : templates(actor, c.env),
                ]);
                const managedAnswer = managedBase || answerGuideManagedResources({ question: parsed.data.question, actor, groups });
                const templateAnswer = templateBase || answerGuideTemplateAccessQuestion(parsed.data.question, actor, templateList);
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION, topicId: 'managed-resources',
                    message: `${managedAnswer.message}\n\n${templateAnswer.message}`,
                    actions: [...new Map([...managedAnswer.actions, ...templateAnswer.actions]
                        .map((action) => [action.route, action])).values()], input, answerSource: 'account' });
            } catch { return c.json({ error: 'Your managed resources and Offering templates could not be checked right now. No list has been inferred.' }, 503); }
        }
        const composite = !parsed.data.topicId && answerGuideCompositeQuestion(parsed.data.question, actor);
        if (composite) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...composite, input });
        const verifiedBoundary = !parsed.data.topicId && answerGuideVerifiedBoundaryQuestion(parsed.data.question, actor);
        if (verifiedBoundary) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...verifiedBoundary, input });
        const oracleFact = !parsed.data.topicId && answerGuideOracleFact(parsed.data.question);
        // These reviewed product questions can contain first-person create/save
        // words without requesting an account permission or the user's saved list.
        if (oracleFact && ['provider-usage-boundary', 'provider-plan-lifecycle', 'provider-plan-privacy',
            'offering-multi-host', 'offering-translation-review', 'place-assignment-scope',
            'saved-identity-privacy', 'offering-host-versus-membership',
            'saved-versus-membership', 'guide-provider-identity-check', 'place-membership-navigation', 'other-place-memberships',
            'plan-schedule-update', 'personal-place-sharing']
            .includes(oracleFact.topicId))
            return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...oracleFact, input, answerSource: 'reviewed' });
        const resourceCreationAccess = !parsed.data.topicId && answerGuideResourceAccessQuestion(parsed.data.question, actor);
        if (resourceCreationAccess?.topicId === 'resource-access' || resourceCreationAccess?.topicId === 'template-access')
            return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...resourceCreationAccess, input, answerSource: 'account' });
        if (!parsed.data.topicId && guideTemplateAccessIntent(parsed.data.question) === 'list') {
            let directoryAllowed = false;
            const deniedResponse = await directoryAccess(c, async () => { directoryAllowed = true; });
            if (!directoryAllowed) return deniedResponse;
            try {
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION,
                    ...answerGuideTemplateAccessQuestion(parsed.data.question, actor, await templates(actor, c.env)),
                    input, answerSource: 'account' });
            } catch { return c.json({ error: 'Your Offering templates could not be checked right now. No list has been inferred.' }, 503); }
        }
        if (!parsed.data.topicId && guideManagedResourceIntent(parsed.data.question) === 'list'
            && guideSavedResourceIntent(parsed.data.question) === 'list') {
            const savedBase = answerGuideSavedResources({ question: parsed.data.question, actor });
            if (savedBase) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...savedBase, input, answerSource: 'account' });
            let directoryAllowed = false;
            const deniedResponse = await directoryAccess(c, async () => { directoryAllowed = true; });
            if (!directoryAllowed) return deniedResponse;
            try {
                const [savedItems, managedGroups] = await Promise.all([
                    saved(actor, c.env), canRequestManagedResourceList(actor) ? managed(actor, c.env) : Promise.resolve(null),
                ]);
                const savedAnswer = answerGuideSavedResources({ question: parsed.data.question, actor, saved: savedItems });
                const managedAnswer = answerGuideManagedResources({ question: parsed.data.question, actor, groups: managedGroups });
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION, topicId: 'managed-resources',
                    message: `${savedAnswer.message}\n\n${managedAnswer.message}`,
                    actions: [...savedAnswer.actions, ...managedAnswer.actions], input, answerSource: 'account' });
            } catch { return c.json({ error: 'Your saved and managed resources could not be checked right now. No list has been inferred.' }, 503); }
        }
        const workbookAccess = !parsed.data.topicId && answerGuideWorkbookAccessQuestion(parsed.data.question, actor);
        if (workbookAccess) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...workbookAccess, input, answerSource: 'account' });
        const groupAccess = !parsed.data.topicId && answerGuideGroupAccessQuestion(parsed.data.question, actor);
        if (groupAccess) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...groupAccess, input, answerSource: 'account' });
        const unverifiedWorkflow = !parsed.data.topicId && answerGuideUnverifiedWorkflow(parsed.data.question);
        if (unverifiedWorkflow) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...unverifiedWorkflow, input, answerSource: 'reviewed' });
        const lifecycleAccess = !parsed.data.topicId && answerGuideLifecycleAccessQuestion(parsed.data.question, actor);
        if (lifecycleAccess) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...lifecycleAccess, input, answerSource: 'account' });
        if (!parsed.data.topicId && guidePersonalPlaceIntent(parsed.data.question)) {
            const base = answerGuidePersonalPlaces({ question: parsed.data.question, actor });
            if (base) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...base, input, answerSource: 'account' });
            let directoryAllowed = false;
            const deniedResponse = await directoryAccess(c, async () => { directoryAllowed = true; });
            if (!directoryAllowed) return deniedResponse;
            try {
                const places = await personalPlaces(actor, c.env);
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION,
                    ...answerGuidePersonalPlaces({ question: parsed.data.question, actor, places }),
                    input, answerSource: 'account' });
            } catch { return c.json({ error: 'Your personal places could not be checked right now. No list has been inferred.' }, 503); }
        }
        if (!parsed.data.topicId && guidePlansIntent(parsed.data.question)) {
            const base = answerGuidePlans({ question: parsed.data.question, actor });
            if (base) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...base, input, answerSource: 'account' });
            let directoryAllowed = false;
            const deniedResponse = await directoryAccess(c, async () => { directoryAllowed = true; });
            if (!directoryAllowed) return deniedResponse;
            try {
                const currentPlans = await plans(actor, c.env);
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION,
                    ...answerGuidePlans({ question: parsed.data.question, actor, plans: currentPlans }),
                    input, answerSource: 'account' });
            } catch { return c.json({ error: 'Your plans could not be checked right now. No list has been inferred.' }, 503); }
        }
        if (!parsed.data.topicId && guideManagedResourceIntent(parsed.data.question)) {
            const base = answerGuideManagedResources({ question: parsed.data.question, actor });
            if (base) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...base, input,
                answerSource: 'account' });
            let directoryAllowed = false;
            const deniedResponse = await directoryAccess(c, async () => { directoryAllowed = true; });
            if (!directoryAllowed) return deniedResponse;
            try {
                const groups = await managed(actor, c.env);
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION,
                    ...answerGuideManagedResources({ question: parsed.data.question, actor, groups }),
                    input, answerSource: 'account' });
            } catch { return c.json({ error: 'Your managed resources could not be checked right now. No list has been inferred.' }, 503); }
        }
        if (!parsed.data.topicId && guideSavedResourceIntent(parsed.data.question)) {
            const base = answerGuideSavedResources({ question: parsed.data.question, actor });
            if (base) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...base, input,
                answerSource: 'account' });
            let directoryAllowed = false;
            const deniedResponse = await directoryAccess(c, async () => { directoryAllowed = true; });
            if (!directoryAllowed) return deniedResponse;
            try {
                const items = await saved(actor, c.env);
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION,
                    ...answerGuideSavedResources({ question: parsed.data.question, actor, saved: items }),
                    input, answerSource: 'account' });
            } catch { return c.json({ error: 'Your saved resources could not be checked right now. No list has been inferred.' }, 503); }
        }
        const criteria = !parsed.data.topicId && extractGuideSearchCriteria(parsed.data.question);
        if (criteria) {
            let directoryAllowed = false;
            const deniedResponse = await directoryAccess(c, async () => {
                directoryAllowed = true;
            });
            if (!directoryAllowed) return deniedResponse;
            try {
                const result = await search(criteria, c.env);
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION, topicId: 'resource-search', criteria, input,
                    message: result.results.length ? `Here are public directory matches for “${criteria.query}”. Open a result to check current details with the provider.`
                        : `I found no public directory matches for “${criteria.query}”. Try a shorter name, service, tag, or address.`,
                    resources: result.results, actions: [{ route: '/discover', label: 'Open Discover' }], hasMore: result.hasMore });
            } catch { return c.json({ error: 'Resource search is temporarily unavailable. No results have been inferred.' }, 503); }
        }
        const studioFollowup = !parsed.data.topicId
            && answerGuideStudioFollowup(parsed.data.question, parsed.data.turns);
        if (studioFollowup) return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...studioFollowup, input, answerSource: 'reviewed' });
        const canUseAi = parsed.data.useAi && !parsed.data.topicId && guideChatAvailable(c.env)
            && actor?.id && normalizeRole(actor.role) !== 'guest' && !actor.isImpersonating;
        // Ordinary lexical product matches can be checked by opted-in semantic
        // retrieval. Account reads and fixed boundaries above keep precedence.
        const semanticReview = canUseAi && c.env.GUIDE_SEMANTIC_RETRIEVAL_ENABLED === 'true'
            && !guideReviewedRelationFact(parsed.data.question);
        if (oracleFact && !semanticReview)
            return c.json({ version: GUIDE_KNOWLEDGE_VERSION, ...oracleFact, input, answerSource: 'reviewed' });
        const reviewed = oracleFact ? { version: GUIDE_KNOWLEDGE_VERSION, ...oracleFact }
            : answerGuideQuestion(input, actor);
        // Current-account permissions stay on the server; never ask a model to infer them.
        if (reviewed.topicId === 'resource-access')
            return c.json({ ...reviewed, input, answerSource: 'account' });
        if (reviewed.topicId === 'unsave' || reviewed.topicId === 'privacy')
            return c.json({ ...reviewed, input, answerSource: 'reviewed' });
        if (canUseAi) {
            let allowed = false;
            await aiLimiter(c, async () => { allowed = true; });
            if (!allowed) return c.json({ ...reviewed, input, answerSource: 'reviewed', aiStatus: 'limited' });
            const grounded = await answerGuideWithCloudflare({ question: parsed.data.question,
                topicId: reviewed.topicId,
                pageContext: parsed.data.pageContext,
                turns: safeGuideChatTurns(parsed.data.turns), env: c.env });
            if (grounded) return c.json({ ...reviewed, ...grounded, input,
                answerSource: c.env.GUIDE_CHAT_SIMULATED === 'true' ? 'simulation' : 'ai' });
        }
        return c.json({ ...reviewed, input, answerSource: 'reviewed' });
    });
    router.post('/search', authenticate, directoryAccess, async (c) => {
        const parsed = guideSearchSchema.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success) return c.json({ error: 'Enter 2–120 characters and a valid resource filter.' }, 400);
        try { return c.json(await search(parsed.data, c.env)); }
        catch { return c.json({ error: 'Resource search is temporarily unavailable. No results have been inferred.' }, 503); }
    });
    router.get('/managed-access', authenticate, directoryAccess, async (c) => {
        const parsed = managedAccessSchema.safeParse(c.req.query('q'));
        if (!parsed.success) return c.json({ error: 'Enter 2–120 characters from a managed listing name.' }, 400);
        const actor = c.get('user');
        if (!actor?.id || normalizeRole(actor.role) === 'guest' || actor.isImpersonating)
            return c.json({ error: 'Sign in outside User View to check a managed listing.' }, 403);
        if (!canRequestManagedResourceList(actor)) return c.json({ resources: [], hasMore: false, canManage: false });
        try { return c.json(await managedAccess(actor, parsed.data, c.env)); }
        catch { return c.json({ error: 'Managed listing access could not be checked right now. No permissions have been inferred.' }, 503); }
    });
    return router;
}

export default createGuideRoutes();
