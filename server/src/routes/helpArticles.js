import { Hono } from 'hono';
import { optionalAuth } from '../middleware/auth.js';
import { HELP_ARTICLES, HELP_CATEGORIES, HELP_CONTENT_VERSION } from '../generated/helpKnowledge.js';
import { loadHelpArticleCapabilities, visibleHelpArticles } from '../utils/helpArticleAccess.js';

export function helpArticleSummary(article) {
    return { id: article.id, slug: article.slug, title: article.title, summary: article.summary,
        category: article.category, audiences: article.audiences || [], reviewedAt: article.reviewedAt,
        articleRoute: article.articleRoute };
}

export function helpArticleResponse(article, visibleArticles = []) {
    const visibleById = new Map(visibleArticles.map((item) => [item.id, item]));
    const relatedArticles = (article.relatedArticleIds || []).filter((id) => visibleById.has(id))
        .map((id) => helpArticleSummary(visibleById.get(id)));
    return { ...helpArticleSummary(article),
        relatedArticleIds: relatedArticles.map((item) => item.id),
        relatedArticles,
        sections: (article.sections || []).map((section) => ({ id: section.id, title: section.title,
            paragraphs: section.paragraphs || [], steps: section.steps || [], notes: section.notes || [] })),
    };
}

const terms = (value) => String(value || '').toLowerCase().match(/[a-z0-9]+/g) || [];
export function searchHelpArticles(articles, question) {
    const query = [...new Set(terms(question))];
    if (!query.length) return [];
    return articles.map((article, index) => {
        const title = new Set(terms(article.title));
        const content = new Set(terms([article.summary, ...(article.sections || []).flatMap((section) =>
            [section.title, ...(section.paragraphs || []), ...(section.steps || []), ...(section.notes || [])])].join(' ')));
        const matches = query.filter((word) => title.has(word) || content.has(word));
        return { article, index, score: matches.reduce((score, word) => score + (title.has(word) ? 3 : 1), 0) };
    }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || a.index - b.index)
        .map(({ article }) => article);
}

export function createHelpArticleRoutes({ authenticate = optionalAuth, articles = HELP_ARTICLES,
    version = HELP_CONTENT_VERSION, categories = HELP_CATEGORIES, capabilities = loadHelpArticleCapabilities } = {}) {
    const router = new Hono();
    router.use('*', async (c, next) => {
        c.header('Cache-Control', 'private, no-store');
        c.header('Vary', 'Cookie, Authorization, X-CareAround-Session');
        await next();
    });
    router.use('*', authenticate);
    const visible = async (c) => visibleHelpArticles(articles, c.get('user'),
        await capabilities(c.get('user'), c.env, articles));
    const categorySummaries = (visibleArticles) => {
        const visibleCategoryIds = new Set(visibleArticles.map((article) => article.category));
        return categories.filter((category) => visibleCategoryIds.has(category.id)).map(({ id, title }) => ({ id, title }));
    };
    router.get('/', async (c) => {
        try {
            const visibleArticles = await visible(c);
            return c.json({ version, categories: categorySummaries(visibleArticles), articles: visibleArticles.map(helpArticleSummary) });
        }
        catch { return c.json({ error: 'Help articles are temporarily unavailable.' }, 503); }
    });
    router.get('/search', async (c) => {
        const query = String(c.req.query('q') || '').trim();
        if (!query || query.length > 120) return c.json({ error: 'Enter 1–120 characters to search help.' }, 400);
        try {
            const visibleArticles = await visible(c);
            return c.json({ version, query, categories: categorySummaries(visibleArticles), articles: searchHelpArticles(visibleArticles, query).map(helpArticleSummary) });
        }
        catch { return c.json({ error: 'Help articles are temporarily unavailable.' }, 503); }
    });
    router.get('/:slug', async (c) => {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.req.param('slug'))) return c.json({ error: 'Help article not found.' }, 404);
        try {
            const visibleArticles = await visible(c);
            let article = visibleArticles.find((item) => item.slug === c.req.param('slug'));
            const sectionId = c.req.query('section');
            if (!article || sectionId !== undefined && !article.sections.some((section) => section.id === sectionId))
                return c.json({ error: 'Help article not found.' }, 404);
            if (sectionId !== undefined) article = { ...article, sections: article.sections.filter((section) => section.id === sectionId) };
            return c.json({ version, article: helpArticleResponse(article, visibleArticles) });
        } catch { return c.json({ error: 'Help articles are temporarily unavailable.' }, 503); }
    });
    return router;
}

export default createHelpArticleRoutes();
