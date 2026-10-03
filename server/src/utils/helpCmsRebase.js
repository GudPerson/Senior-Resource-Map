import { cmsSeedWorkspace } from '../../../shared/helpContentCms.js';
import { HelpCmsError } from './helpCmsPolicy.js';

const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const editableArticleFields = ['title', 'summary', 'category', 'status', 'audiences', 'relatedArticleIds'];
const editableSectionFields = ['title', 'paragraphs', 'steps', 'stepIds', 'notes', 'media', 'queryRequiresAny'];
const mapById = list => new Map(list.map(item => [item.id, item]));

export function rebaseHelpCmsWorkspace(current, baselineSeed, publishedSeed, { restorationIntent = false, publicationWorkspace } = {}) {
    const baseline = cmsSeedWorkspace(baselineSeed), published = cmsSeedWorkspace(publishedSeed);
    const conflicts = [], changes = [];
    function mergeField(local, old, remote, path) {
        let value;
        if (same(local, remote)) value = local;
        else if (restorationIntent) value = local === undefined ? remote : local;
        else if (same(local, old)) value = remote;
        else if (same(remote, old) || remote === undefined) value = local;
        else { conflicts.push(path); value = local; }
        if (!same(local, value)) changes.push(path);
        return clone(value);
    }
    function mergeOrder(local, old, remote, ids, path) {
        const common = new Set(old.filter(id => local.includes(id) && remote.includes(id)));
        const localOrder = local.filter(id => common.has(id)), oldOrder = old.filter(id => common.has(id));
        const remoteOrder = remote.filter(id => common.has(id));
        const mergedOrder = mergeField(localOrder, oldOrder, remoteOrder, path);
        const source = restorationIntent || same(mergedOrder, localOrder) && !same(localOrder, oldOrder) ? local : remote;
        const output = source.filter(id => ids.has(id));
        for (const id of [...local, ...remote]) {
            if (!ids.has(id) || output.includes(id)) continue;
            const index = local.indexOf(id);
            const preceding = local.slice(0, index).reverse().find(candidate => output.includes(candidate));
            if (preceding) output.splice(output.indexOf(preceding) + 1, 0, id);
            else output.push(id);
        }
        return output;
    }
    const oldArticles = mapById(baseline.articles), newArticles = mapById(published.articles), localArticles = mapById(current.articles);
    const frozenArticles = mapById(publicationWorkspace?.articles || []);
    const articles = [];
    for (const id of new Set([...published.articles.map(a => a.id), ...current.articles.map(a => a.id)])) {
        const local = localArticles.get(id), remote = newArticles.get(id), old = oldArticles.get(id) || frozenArticles.get(id);
        if (!remote) { if (local) articles.push(clone(local)); continue; }
        if (!local) { articles.push(clone(remote)); continue; }
        const result = clone(remote);
        for (const field of editableArticleFields) result[field] = mergeField(local[field], old?.[field], remote[field], `${id}.${field}`);
        const localSections = mapById(local.sections), remoteSections = mapById(remote.sections), oldSections = mapById(old?.sections || []);
        const sections = [];
        for (const sectionId of new Set([...remote.sections.map(s => s.id), ...local.sections.map(s => s.id)])) {
            const own = localSections.get(sectionId), next = remoteSections.get(sectionId), previous = oldSections.get(sectionId);
            if (!next) { if (own) sections.push(clone(own)); continue; }
            if (!own) {
                if (previous && !restorationIntent) {
                    const remoteChanged = editableSectionFields.some(field => !same(next[field], previous[field]));
                    if (remoteChanged) conflicts.push(`${id}.${sectionId}.section`);
                    if (next.facts?.length) conflicts.push(`${id}.${sectionId}.required-evidence`);
                } else sections.push(clone(next));
                continue;
            }
            const section = clone(next);
            for (const field of editableSectionFields) section[field] = mergeField(own[field], previous?.[field], next[field], `${id}.${sectionId}.${field}`);
            // The publication supplies identity, access policy and evidence. Only
            // the owner's reading fields are merged back into that trusted shape.
            sections.push(section);
        }
        const sectionMap = mapById(sections);
        const order = mergeOrder(local.sections.map(s => s.id), (old?.sections || []).map(s => s.id), remote.sections.map(s => s.id), new Set(sectionMap.keys()), `${id}.section-order`);
        result.sections = order.map(sectionId => sectionMap.get(sectionId));
        articles.push(result);
    }
    const oldCategories = mapById(baseline.manifest.categories), remoteCategories = mapById(published.manifest.categories), localCategories = mapById(current.manifest.categories);
    const categories = [];
    for (const id of new Set([...published.manifest.categories.map(c => c.id), ...current.manifest.categories.map(c => c.id)])) {
        const local = localCategories.get(id), remote = remoteCategories.get(id), old = oldCategories.get(id);
        if (!remote) { if (local) categories.push(clone(local)); continue; }
        if (!local) { categories.push(clone(remote)); continue; }
        categories.push({ ...clone(remote), title: mergeField(local.title, old?.title, remote.title, `topic.${id}.title`),
            archived: mergeField(Boolean(local.archived), Boolean(old?.archived), Boolean(remote.archived), `topic.${id}.archived`) });
    }
    const categoryMap = mapById(categories);
    const categoryOrder = mergeOrder(current.manifest.categories.map(c => c.id), baseline.manifest.categories.map(c => c.id), published.manifest.categories.map(c => c.id), new Set(categoryMap.keys()), 'topic-order');
    const result = { ...published, articles, manifest: { ...published.manifest,
        categories: categoryOrder.map(id => categoryMap.get(id)),
        articleOrder: mergeOrder(current.manifest.articleOrder, baseline.manifest.articleOrder, published.manifest.articleOrder, new Set(articles.map(a => a.id)), 'article-order') } };
    if (conflicts.length) {
        const error = new HelpCmsError('The draft and published content both changed the same fields. Review them before rebasing.', 409);
        error.conflicts = [...new Set(conflicts)];
        throw error;
    }
    return { workspace: result, report: { fromVersion: current.baseContentVersion, toVersion: published.baseContentVersion,
        restoration: restorationIntent, mergedFields: [...new Set(changes)] } };
}
