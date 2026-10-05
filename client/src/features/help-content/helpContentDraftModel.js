import { cmsHasSeparateAnswers, cmsSectionMessage, cmsSeparateAnswerMessage, safeCmsVideoUrl } from '../../../../shared/helpContentCms.js';

export const CMS_IMAGE_LIMIT = 12;
export const CMS_VIDEO_LIMIT = 12;
export const CMS_IMAGE_BYTES = 2 * 1024 * 1024;
export const cloneCms = (value) => JSON.parse(JSON.stringify(value));
export const cmsDirty = (workspace, saved) => Boolean(workspace && saved && JSON.stringify(workspace) !== JSON.stringify(saved));
export const cmsCanRequest = (user, impersonating = false, loading = false) => Boolean(user?.id) && !loading && !impersonating && !user?.isImpersonating;

export function cmsLocalId(prefix, existing = []) {
    const used = new Set(existing);
    let index = 1;
    while (used.has(`${prefix}-${index}`)) index += 1;
    return `${prefix}-${index}`;
}

export function updateCmsArticle(workspace, articleId, update) {
    return { ...workspace, articles: workspace.articles.map((article) => article.id === articleId ? update(cloneCms(article)) : article) };
}
export function updateCmsSection(workspace, articleId, sectionId, update) {
    return updateCmsArticle(workspace, articleId, (article) => ({ ...article,
        sections: article.sections.map((section) => section.id === sectionId ? update(section) : section) }));
}
export function cmsNewSection(article) {
    const id = `section-${globalThis.crypto.randomUUID()}`;
    return { id, title: 'New section', paragraphs: [], steps: [''], stepIds: [`${id}-step-1`], notes: [], media: [], facts: [] };
}
export function cmsAddStep(section) {
    const id = cmsLocalId('step', section.stepIds || []);
    return { ...section, steps: [...section.steps, ''], stepIds: [...(section.stepIds || []), id] };
}
export function cmsMoveStep(section, stepId, direction) {
    const index = section.stepIds.indexOf(stepId), target = index + direction;
    if (index < 0 || target < 0 || target >= section.steps.length || ![-1, 1].includes(direction)) return section;
    const next = cloneCms(section);
    [next.steps[index], next.steps[target]] = [next.steps[target], next.steps[index]];
    [next.stepIds[index], next.stepIds[target]] = [next.stepIds[target], next.stepIds[index]];
    return next;
}
// Removing an instruction must explicitly resolve its attachments.
export function cmsRemoveStep(section, stepId, placement) {
    const index = section.stepIds.indexOf(stepId);
    if (index < 0) return section;
    const owned = (section.media || []).filter((item) => item.afterStepId === stepId);
    if (owned.length && placement === undefined) throw new Error('Choose where to move this instruction’s attachments.');
    if (placement !== undefined && placement !== null && placement !== 'remove' && (!section.stepIds.includes(placement) || placement === stepId)) throw new Error('Choose an existing instruction for these attachments.');
    return { ...section, steps: section.steps.filter((_, i) => i !== index), stepIds: section.stepIds.filter((_, i) => i !== index),
        media: (section.media || []).filter((item) => placement !== 'remove' || item.afterStepId !== stepId)
            .map((item) => item.afterStepId === stepId ? { ...item, afterStepId: placement ?? null } : item) };
}
export function cmsMoveMedia(section, mediaId, direction) {
    const item = (section.media || []).find((value) => value.id === mediaId);
    if (!item || ![-1, 1].includes(direction)) return section;
    const indices = section.media.flatMap((value, index) => value.afterStepId === item.afterStepId ? [index] : []);
    const position = indices.findIndex((index) => section.media[index].id === mediaId), target = position + direction;
    if (target < 0 || target >= indices.length) return section;
    const media = [...section.media];
    [media[indices[position]], media[indices[target]]] = [media[indices[target]], media[indices[position]]];
    return { ...section, media };
}
export function cmsUpdateMedia(section, mediaId, key, value) {
    return { ...section, media: section.media.map((item) => item.id === mediaId ? { ...item, [key]: value,
        ...(['url', 'transcript'].includes(key) ? { transcriptReviewed: false } : {}) } : item) };
}
export function cmsArticleImpact(workspace, articleId) {
    const article = workspace.articles.find((item) => item.id === articleId);
    const incoming = workspace.articles.filter((item) => item.id !== articleId && item.status !== 'retired' && item.relatedArticleIds?.includes(articleId));
    const facts = (article?.sections || []).flatMap((section) => section.facts || []);
    return { incoming, factCount: facts.length, topicIds: (workspace.manifest.topics || []).filter((topic) => facts.some((fact) => fact.id === `help-${topic.id}`)).map((topic) => topic.id) };
}
export function cmsSafeVideo(value) {
    const url = safeCmsVideoUrl(value);
    if (!url) throw new Error('Enter a specific HTTPS YouTube or Vimeo video link.');
    return url;
}
export function cmsChangeSummary(workspace, saved) {
    if (!workspace || !saved) return [];
    const changes = [];
    const beforeCategories = new Map(saved.manifest.categories.map((item) => [item.id, item]));
    for (const category of workspace.manifest.categories) {
        const before = beforeCategories.get(category.id);
        if (!before) changes.push(`New topic: ${category.title}`);
        else if (JSON.stringify(before) !== JSON.stringify(category)) changes.push(`Topic changed: ${category.title}`);
    }
    for (const category of saved.manifest.categories) if (!workspace.manifest.categories.some((item) => item.id === category.id)) changes.push(`Topic removed: ${category.title}`);
    if (JSON.stringify(workspace.manifest.categories.map((item) => item.id)) !== JSON.stringify(saved.manifest.categories.map((item) => item.id))) changes.push('Topic order changed');
    const beforeArticles = new Map(saved.articles.map((item) => [item.id, item]));
    for (const article of workspace.articles) {
        const before = beforeArticles.get(article.id);
        if (!before) changes.push(`New article: ${article.title}`);
        else if (JSON.stringify(before) !== JSON.stringify(article)) changes.push(`Article changed: ${article.title}`);
    }
    for (const article of saved.articles) if (!workspace.articles.some((item) => item.id === article.id)) changes.push(`Article removed: ${article.title}`);
    if (JSON.stringify(workspace.manifest.articleOrder) !== JSON.stringify(saved.manifest.articleOrder)) changes.push('Article order changed');
    return changes;
}

export function cmsMoveArticleWithinTopic(workspace, articleId, direction) {
    const article = workspace.articles.find((value) => value.id === articleId);
    if (!article || ![-1, 1].includes(direction)) return workspace;
    const indices = workspace.manifest.articleOrder.flatMap((id, index) => workspace.articles.find((value) => value.id === id)?.category === article.category ? [index] : []);
    const position = indices.findIndex((index) => workspace.manifest.articleOrder[index] === articleId), target = position + direction;
    if (target < 0 || target >= indices.length) return workspace;
    const articleOrder = [...workspace.manifest.articleOrder];
    [articleOrder[indices[position]], articleOrder[indices[target]]] = [articleOrder[indices[target]], articleOrder[indices[position]]];
    return { ...workspace, manifest: { ...workspace.manifest, articleOrder } };
}

export function cmsLoadEnvelope(data) {
    if (!data?.workspace || !(data.etag === null || typeof data.etag === 'string')) throw new Error('This saved draft could not be opened.');
    return data;
}
export function cmsGuideMessages(section) {
    if (!cmsHasSeparateAnswers(section)) return [{ title: section.title, text: cmsSectionMessage(section) }];
    return section.facts.map((fact, index) => ({ title: fact.title || section.title,
        text: cmsSeparateAnswerMessage(section, index) }));
}

export function cmsCanSave(workspace, saved, etag, { configured = false, busy = false, conflict = false } = {}) {
    return Boolean(configured && !busy && !conflict && workspace && (etag === null || cmsDirty(workspace, saved)));
}
