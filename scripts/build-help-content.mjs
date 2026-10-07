import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateCmsMedia } from '../shared/helpContentCms.js';
import { normalizeCareMapTerminology } from '../shared/careMapTerminology.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const visibilities = new Set(['public', 'signed-in', 'resource-manager', 'organization', 'admin', 'support-review', 'audit']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const nonempty = value => typeof value === 'string' && value.trim() && value.length <= 16000;
const fail = message => { throw new Error('Help content: ' + message); };
const strings = (value, label, required = false) => {
    if (!Array.isArray(value) || value.some(item => !nonempty(item)) || required && !value.length) fail(label + ' must be a text array');
};
const json = path => JSON.parse(readFileSync(path, 'utf8'));

export function helpSectionMessage(section) {
    return [...(section.paragraphs || []), ...(section.steps || []).map((step, index) => (index + 1) + '. ' + step), ...(section.notes || []), ...(section.media || []).filter(item => item.type === 'video' && item.transcriptReviewed).map(item => item.transcript)].join('\n\n');
}

export function publicHelpArticle(article) {
    return { id: article.id, slug: article.slug, title: article.title, summary: article.summary,
        category: article.category, audiences: article.audiences, reviewedAt: article.reviewedAt,
        ...(article.position !== undefined ? { position: article.position } : {}),
        articleRoute: article.articleRoute, relatedArticleIds: article.relatedArticleIds,
        sections: article.sections.map(section => ({ id: section.id, title: section.title,
            paragraphs: section.paragraphs, steps: section.steps, notes: section.notes,
            ...(section.media?.length ? { stepIds: section.stepIds, media: section.media } : {}) })) };
}

export function compileHelpContent({ root = projectRoot, normalizeTerminology = true } = {}) {
    const manifest = json(resolve(root, 'content/help/manifest.json'));
    if (!nonempty(manifest.version) || !Array.isArray(manifest.categories) || !Array.isArray(manifest.topics)
        || !Array.isArray(manifest.guideFactOrder)) fail('invalid manifest');
    const categories = new Map();
    for (const category of manifest.categories) {
        if (!slugPattern.test(category.id) || !nonempty(category.title) || categories.has(category.id)) fail('duplicate/invalid category');
        categories.set(category.id, { id: category.id, title: category.title, ...(category.archived ? { archived: true } : {}),
            ...(manifest.articleOrder ? { position: categories.size } : {}) });
    }
    const articles = [], facts = [], allIds = new Set(), allSlugs = new Set(), factIds = new Set(), retiredFactIds = new Set();
    const folder = resolve(root, 'content/help/articles');
    if (!existsSync(folder)) fail('article folder missing');
    for (const file of readdirSync(folder).filter(name => name.endsWith('.json')).sort()) {
        const source = json(resolve(folder, file));
        if (!/^HC-[0-9]{2,3}$/.test(source.id) || allIds.has(source.id) || !slugPattern.test(source.slug) || allSlugs.has(source.slug)) fail('duplicate/invalid article identity in ' + file);
        allIds.add(source.id); allSlugs.add(source.slug);
        if (!nonempty(source.title) || !nonempty(source.summary) || !categories.has(source.category)) fail('article title/summary/category in ' + file);
        strings(source.audiences, 'audiences', true);
        if (!visibilities.has(source.visibility) || !['draft', 'approved', 'retired'].includes(source.status)) fail('visibility/status in ' + file);
        if (!Array.isArray(source.sections) || !source.sections.length) fail('sections in ' + file);
        if (source.status === 'retired') {
            for (const section of source.sections) for (const fact of section.facts || []) retiredFactIds.add(fact.id);
        }
        if (source.status !== 'approved') continue;
        if (categories.get(source.category).archived) fail('approved article in archived category');
        if (!source.review || !/^\d{4}-\d{2}-\d{2}$/.test(source.review.date) || !/^[a-f0-9]{40}$/.test(source.review.sourceRevision)
            || !nonempty(source.review.method) || !nonempty(source.review.owner)) fail('review evidence in ' + file);
        strings(source.review.evidence, 'review evidence', true);
        const articleRoute = '/help-centre/' + source.slug;
        const sections = [], sectionIds = new Set();
        for (const section of source.sections) {
            if ('visibility' in section) fail('section visibility is unsupported; use an article policy in ' + file);
            if (!slugPattern.test(section.id) || sectionIds.has(section.id) || !nonempty(section.title)) fail('duplicate/invalid section in ' + file);
            sectionIds.add(section.id);
            const paragraphs = section.paragraphs || [], steps = section.steps || [], notes = section.notes || [];
            strings(paragraphs, 'paragraphs'); strings(steps, 'steps'); strings(notes, 'notes');
            if (section.queryRequiresAny) strings(section.queryRequiresAny, 'section query qualifications', true);
            if (!Array.isArray(section.facts)) fail('facts must be an array in ' + file);
            const media = section.media || [];
            if (media.length) validateCmsMedia(media, section.stepIds || [], source.visibility);
            const body = helpSectionMessage({ paragraphs, steps, notes, media });
            const readingParagraphs = paragraphs.length || steps.length ? paragraphs : section.facts.map(fact => fact.message).filter(nonempty);
            if (!readingParagraphs.length && !steps.length) fail('empty section in ' + file);
            sections.push({ id: section.id, title: section.title, paragraphs: readingParagraphs, steps, notes,
                ...(media.length ? { stepIds: section.stepIds, media } : {}) });
            // Reviewed reader-only sections also become retrievable evidence.
            // Their body is derived here, rather than separately authored for AI.
            const sectionFacts = section.facts.length ? section.facts : [{
                id: 'article-' + source.id.toLowerCase() + '-' + section.id,
                title: source.title + ': ' + section.title,
                keywords: [source.title.toLowerCase(), section.title.toLowerCase(), source.slug.replaceAll('-', ' ')],
                ...(steps.length ? { answerKind: 'procedure' } : { message: body }),
                route: articleRoute, evidence: source.review.evidence.join('; '), reviewed: source.review.date,
                ...(section.queryRequiresAny ? { queryRequiresAny: section.queryRequiresAny } : {}),
            }];
            for (const fact of sectionFacts) {
                if ('visibility' in fact) fail('fact visibility is unsupported; use an article policy in ' + file);
                if (!slugPattern.test(fact.id) || factIds.has(fact.id) || !nonempty(fact.title) || !nonempty(fact.route) || !/^\/(?!\/)/.test(fact.route)) fail('duplicate/invalid fact in ' + file);
                strings(fact.keywords, 'fact keywords', true);
                if (!nonempty(fact.evidence) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.reviewed)) fail('fact evidence in ' + file);
                if (fact.queryRequiresAny) strings(fact.queryRequiresAny, 'query qualifications');
                const message = fact.answerKind === 'procedure' ? body : fact.message;
                if (!nonempty(message)) fail('missing fact body in ' + file);
                if (fact.answerKind === 'procedure' && !steps.length) fail('procedure requires ordered steps in ' + file);
                factIds.add(fact.id);
                facts.push({ ...fact, message, articleId: source.id, sectionId: section.id,
                    articleRoute: articleRoute + '#' + section.id, visibility: source.visibility });
            }
        }
        const relatedArticleIds = source.relatedArticleIds || [];
        strings(relatedArticleIds, 'related article IDs');
        articles.push({ id: source.id, slug: source.slug, title: source.title, summary: source.summary,
            category: source.category, audiences: source.audiences, visibility: source.visibility,
            reviewedAt: source.review.date, articleRoute, relatedArticleIds, sections, review: source.review });
    }
    if (manifest.articleOrder) {
        if (!Array.isArray(manifest.articleOrder) || manifest.articleOrder.length !== allIds.size || new Set(manifest.articleOrder).size !== allIds.size || manifest.articleOrder.some(id => !allIds.has(id))) fail('article order must contain every identity exactly once');
        articles.forEach(article => { article.position = manifest.articleOrder.indexOf(article.id); });
        articles.sort((a, b) => a.position - b.position);
    }
    const declaredRetirements = new Set(manifest.retiredFactIds || []);
    if (declaredRetirements.size !== (manifest.retiredFactIds || []).length || [...declaredRetirements].some(id => !retiredFactIds.has(id) || factIds.has(id))) fail('invalid Guide retirement record');
    const byId = new Map(articles.map(article => [article.id, article]));
    for (const article of articles) for (const related of article.relatedArticleIds) {
        const target = byId.get(related);
        if (!target || related === article.id) fail('broken related article link in ' + article.id);
        if (article.visibility === 'public' && target.visibility !== 'public') fail('restricted title/link in public related articles');
    }
    const order = new Map(manifest.guideFactOrder.map((id, index) => [id, index]));
    if (order.size !== manifest.guideFactOrder.length) fail('duplicate legacy fact order');
    facts.sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) || a.id.localeCompare(b.id));
    for (const id of manifest.guideFactOrder) if (!factIds.has(id) && !declaredRetirements.has(id)) fail('unmapped existing Guide fact ' + id);
    const byFact = new Map(facts.map(fact => [fact.id, fact]));
    const topics = manifest.topics.filter(topic => !declaredRetirements.has('help-' + topic.id)).map(topic => {
        const fact = byFact.get('help-' + topic.id);
        if (!fact || !nonempty(topic.label)) fail('unmapped legacy topic ' + topic.id);
        return { id: topic.id, title: fact.title, keywords: fact.keywords, message: fact.message, route: fact.route,
            label: topic.label, ...(topic.signedIn ? { signedIn: true } : {}) };
    });
    if (new Set(topics.map(topic => topic.id)).size !== topics.length) fail('duplicate topics');
    const publicArticles = articles.filter(article => article.visibility === 'public').map(publicHelpArticle);
    const publicCategories = [...categories.values()].filter(category => !category.archived && publicArticles.some(article => article.category === category.id));
    const compiled = { version: manifest.version, articles, facts, topics, categories: [...categories.values()].filter(category => !category.archived), publicData: { version: manifest.version, categories: publicCategories, articles: publicArticles } };
    return normalizeTerminology ? normalizeCareMapTerminology(compiled) : compiled;
}

export function generateHelpContent({ root = projectRoot, check = false } = {}) {
    const compiled = compileHelpContent({ root });
    const contentDigest = createHash('sha256').update(JSON.stringify(compiled)).digest('hex');
    const seed = { manifest: json(resolve(root, 'content/help/manifest.json')), articles: readdirSync(resolve(root, 'content/help/articles')).filter(name => name.endsWith('.json')).sort().map(name => json(resolve(root, 'content/help/articles', name))) };
    const generated = '// Generated by scripts/build-help-content.mjs. Edit content/help/articles instead.\n';
    const outputs = [
        ['client/src/generated/helpArticles.json', JSON.stringify({ ...compiled.publicData, contentDigest }, null, 2) + '\n'],
        ['server/src/generated/helpKnowledge.js', generated
            + 'export const HELP_CONTENT_DIGEST = ' + JSON.stringify(contentDigest) + ';\n'
            + 'export const HELP_CONTENT_VERSION = ' + JSON.stringify(compiled.version) + ';\n'
            + 'export const HELP_CATEGORIES = ' + JSON.stringify(compiled.categories, null, 2) + ';\n'
            + 'export const HELP_ARTICLES = ' + JSON.stringify(compiled.articles, null, 2) + ';\n'
            + 'export const GUIDE_TOPICS = ' + JSON.stringify(compiled.topics, null, 2) + ';\n'
            + 'export const GUIDE_ORACLE_FACTS = ' + JSON.stringify(compiled.facts, null, 2) + ';\n'
            + 'export const GUIDE_EXTRA_FACTS = GUIDE_ORACLE_FACTS.filter(fact => !fact.id.startsWith("help-"));\n'],
        ['client/public/help-content-status.json', JSON.stringify({ version: compiled.version, contentDigest }) + '\n'],
    ];
    for (const [relative, data] of outputs) {
        const path = resolve(root, relative);
        if (check) {
            if (!existsSync(path) || readFileSync(path, 'utf8') !== data) fail('generated output is stale: ' + relative);
        } else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); }
    }
    // The full authoring seed is an ignored server build artifact. Checking a
    // cold checkout validates tracked outputs first, then bootstraps only this
    // private module; it never repairs client/knowledge/status drift silently.
    const seedPath = resolve(root, 'server/src/generated/helpCmsSeed.js');
    const seedData = generated + 'export const HELP_CMS_SEED = ' + JSON.stringify(seed, null, 2) + ';\n';
    if (!existsSync(seedPath) || readFileSync(seedPath, 'utf8') !== seedData) {
        mkdirSync(dirname(seedPath), { recursive: true });
        writeFileSync(seedPath, seedData, { mode: 0o600 });
    }
    return { articles: compiled.articles.length, publicArticles: compiled.publicData.articles.length,
        facts: compiled.facts.length, topics: compiled.topics.length, version: compiled.version,
        contentDigest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { console.log(JSON.stringify(generateHelpContent({ check: process.argv.includes('--check') }))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
