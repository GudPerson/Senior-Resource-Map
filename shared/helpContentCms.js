// Shared authoring rules. Runtime permissions stay in the server, never in content.
export const CMS_LIMITS = Object.freeze({ articles: 200, categories: 40, sections: 24, steps: 60, media: 24, imageBytes: 2 * 1024 * 1024, workspaceBytes: 4 * 1024 * 1024 });
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const articleId = /^HC-\d{2,3}$/;
const assetId = /^[a-f0-9]{64}$/;
const policies = new Set(['public', 'signed-in', 'resource-manager', 'organization', 'admin', 'support-review', 'audit']);
const copy = value => JSON.parse(JSON.stringify(value));
const text = (value, max = 16000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const fail = message => { throw new Error(message); };
const texts = (value, label, max = 60) => { if (!Array.isArray(value) || value.length > max || value.some(item => !text(item))) fail(`${label} must contain valid text.`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function cmsSectionMessage(section) {
    return [...(section.paragraphs || []), ...(section.steps || []).map((step, index) => `${index + 1}. ${step}`), ...(section.notes || []), ...(section.media || []).filter(m => m.type === 'video' && m.transcriptReviewed).map(m => m.transcript)].join('\n\n');
}
export function cmsHasSeparateAnswers(section) {
    return Boolean(section.facts?.length && section.facts.every(fact => fact.answerKind !== 'procedure'));
}
export function cmsSeparateAnswerMessage(section, index) {
    return cmsSectionMessage({ ...section, paragraphs: [section.paragraphs?.[index] || ''] });
}
export function cmsSeedWorkspace(seed) {
    const result = { schemaVersion: 1, baseContentVersion: seed.manifest?.version || seed.version, manifest: copy(seed.manifest), articles: copy(seed.articles) };
    result.manifest.articleOrder ||= result.articles.map(a => a.id);
    for (const article of result.articles) for (const section of article.sections) {
        section.paragraphs ||= section.steps?.length ? [] : section.facts.map(f => f.message).filter(Boolean);
        section.steps ||= []; section.notes ||= [];
        section.stepIds ||= section.steps.map((_, i) => `${section.id}-step-${i + 1}`);
        section.media ||= [];
    }
    return result;
}
export function cmsReadingArticle(article) {
    return { ...copy(article), reviewedAt: article.review?.date, articleRoute: `/help-centre/${article.slug}`,
        sections: article.sections.map(section => ({ ...copy(section), guideMessage: cmsSectionMessage(section) })) };
}
export function safeCmsVideoUrl(value) {
    try {
        const u = new URL(value);
        if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
        const host = u.hostname.toLowerCase(), paths = u.pathname.split('/').filter(Boolean);
        let valid = false;
        if (['youtube.com','www.youtube.com','m.youtube.com'].includes(host)) {
            const id = paths[0] === 'watch' ? u.searchParams.get('v') : ['shorts','embed','live'].includes(paths[0]) ? paths[1] : '';
            valid = Boolean(id && /^[A-Za-z0-9_-]{6,15}$/.test(id));
        } else if (['youtu.be','www.youtu.be'].includes(host)) valid = paths.length === 1 && /^[A-Za-z0-9_-]{6,15}$/.test(paths[0]);
        else if (['vimeo.com','www.vimeo.com'].includes(host)) valid = paths.length === 1 && /^\d{5,12}$/.test(paths[0]);
        else if (host === 'player.vimeo.com') valid = paths[0] === 'video' && /^\d{5,12}$/.test(paths[1] || '');
        if (!valid) return null;
        u.hash = ''; return u.href;
    } catch { return null; }
}
export function validateCmsMedia(media, stepIds = [], visibility = 'public') {
    if (!Array.isArray(media) || media.length > CMS_LIMITS.media) fail('Too many attachments in this section.');
    const ids = new Set();
    for (const m of media) {
        if (!m || !slug.test(m.id) || ids.has(m.id) || !['image', 'video'].includes(m.type)) fail('An attachment has an invalid identity.');
        ids.add(m.id);
        if (m.afterStepId !== null && !stepIds.includes(m.afterStepId)) fail('An attachment must belong to an existing step or introduction.');
        if (!text(m.caption, 1000)) fail('Every attachment needs a caption.');
        if (visibility !== 'public') fail('Attachments to restricted articles are not supported yet.');
        if (m.type === 'image' && (!assetId.test(m.assetId) || !text(m.alt, 1000))) fail('Images need an uploaded file and an accessible description.');
        if (m.type === 'video' && (!safeCmsVideoUrl(m.url) || !text(m.transcript) || m.transcriptReviewed !== true)) fail('Video links need a safe YouTube or Vimeo URL and a checked transcript.');
    }
    return media;
}
export function validateCmsWorkspace(workspace, seed) {
    if (!workspace || workspace.schemaVersion !== 1 || !text(workspace.baseContentVersion, 160)) fail('This draft format is unavailable.');
    if (JSON.stringify(workspace).length > CMS_LIMITS.workspaceBytes) fail('This draft is too large.');
    const m = workspace.manifest;
    if (!m || !Array.isArray(m.categories) || m.categories.length > CMS_LIMITS.categories || !Array.isArray(m.topics) || !Array.isArray(m.guideFactOrder)) fail('The topic catalogue is invalid.');
    const cats = new Map();
    for (const c of m.categories) {
        if (!c || !slug.test(c.id) || !text(c.title, 160) || cats.has(c.id) || c.archived !== undefined && typeof c.archived !== 'boolean') fail('Topic titles and identities must be valid and unique.');
        cats.set(c.id, c);
    }
    if (!Array.isArray(workspace.articles) || workspace.articles.length > CMS_LIMITS.articles) fail('The article catalogue is invalid.');
    const baseline = new Map((seed?.articles || []).map(a => [a.id, a]));
    const ids = new Set(), slugs = new Set();
    for (const a of workspace.articles) {
        if (!a || !articleId.test(a.id) || ids.has(a.id) || !slug.test(a.slug) || slugs.has(a.slug)) fail('Article identities and addresses must be unique.');
        ids.add(a.id); slugs.add(a.slug);
        const original = baseline.get(a.id);
        if (original && (original.slug !== a.slug || original.visibility !== a.visibility)) fail('Published addresses and access rules cannot be changed in the editor.');
        if (seed && !original && a.visibility !== 'public') fail('New articles must use public access in this release.');
        if (!policies.has(a.visibility) || !['draft', 'approved', 'retired'].includes(a.status)) fail('Article access or status is invalid.');
        if (!text(a.title, 240) || !text(a.summary, 1000) || !cats.has(a.category)) fail('Every article needs a title, summary and topic.');
        if (a.status !== 'retired' && cats.get(a.category).archived) fail('Move or archive a topic’s articles before archiving the topic.');
        texts(a.audiences, 'Audience labels', 12);
        if (!a.audiences.length || !Array.isArray(a.sections) || !a.sections.length || a.sections.length > CMS_LIMITS.sections) fail('Every article needs an audience and a section.');
        const sections = new Set(); let attachments = 0;
        for (const s of a.sections) {
            if (!s || !slug.test(s.id) || sections.has(s.id) || !text(s.title, 240)) fail('Section titles and identities must be valid and unique.');
            sections.add(s.id);
            texts(s.paragraphs || [], 'Paragraphs'); texts(s.steps || [], 'Steps', CMS_LIMITS.steps); texts(s.notes || [], 'Notes');
            if (!(s.paragraphs?.length || s.steps?.length || s.facts?.length)) fail('A section needs written instructions.');
            if (!Array.isArray(s.stepIds) || s.stepIds.length !== (s.steps || []).length || new Set(s.stepIds).size !== s.stepIds.length || s.stepIds.some(id => !slug.test(id))) fail('Steps need stable, unique identities.');
            if (!Array.isArray(s.facts)) fail('Guide evidence is invalid.');
            if (s.facts.some(f => f.answerKind === 'procedure') && !s.steps?.length) fail('An existing procedure must retain numbered instructions.');
            const originalSection = original?.sections.find(item => item.id === s.id);
            if (originalSection && !same(s.facts, originalSection.facts)) fail('Internal Guide evidence cannot be edited directly.');
            if (seed && !originalSection && s.facts.length) fail('New sections derive Guide evidence from their written instructions.');
            validateCmsMedia(s.media || [], s.stepIds, a.visibility); attachments += (s.media || []).length;
        }
        if (attachments > CMS_LIMITS.media) fail('An article can have at most 24 attachments.');
        if (original && original.sections.some(s => !sections.has(s.id) && s.facts.length)) fail('Sections with existing Guide evidence must be retained; archive the article instead.');
        texts(a.relatedArticleIds || [], 'Related articles', 30);
    }
    if ([...baseline.keys()].some(id => !ids.has(id))) fail('Published articles must be archived, not permanently removed.');
    if (!Array.isArray(m.articleOrder) || m.articleOrder.length !== ids.size || new Set(m.articleOrder).size !== ids.size || m.articleOrder.some(id => !ids.has(id))) fail('Article order must include every article exactly once.');
    if (seed?.manifest && (!same(m.guideFactOrder, seed.manifest.guideFactOrder) || !same(m.topics, seed.manifest.topics))) fail('Guide routing identities cannot be edited directly.');
    for (const a of workspace.articles) for (const id of a.relatedArticleIds || []) {
        const target = workspace.articles.find(x => x.id === id);
        if (!target || target.id === a.id || a.visibility === 'public' && target.visibility !== 'public') fail('A related article link is unavailable.');
    }
    return workspace;
}
export function prepareCmsPublication(workspace, { reviewNote, owner, date, version, sourceRevision, seed } = {}) {
    if (!text(reviewNote, 2000) || !text(owner, 160) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !text(version, 160) || !/^[a-f0-9]{40}$/.test(sourceRevision || '')) fail('Publication needs an owner review and verified application revision.');
    const result = copy(workspace);
    // Never copy unpublished text into a build or a release seed. Existing
    // articles with an in-progress draft retain their last published source.
    if (seed) result.articles = result.articles.flatMap(article => {
        const previous = seed.articles.find(item => item.id === article.id);
        if (article.status === 'draft') return previous ? [copy(previous)] : [];
        // Archiving approves withdrawal, not unfinished prose. Keep only the
        // previously published source; never release a never-published archive.
        if (article.status === 'retired') return previous ? [{...copy(previous),status:'retired',category:article.category}] : [];
        return [article];
    });
    else result.articles = result.articles.filter(article => article.status !== 'draft');
    const releaseIds = new Set(result.articles.map(article => article.id));
    result.manifest.articleOrder = result.manifest.articleOrder.filter(id => releaseIds.has(id));
    const activeIds = new Set(result.articles.filter(a => a.status === 'approved').map(a => a.id));
    const retiredFacts = result.articles.filter(a => a.status === 'retired').flatMap(a => a.sections.flatMap(s => s.facts.map(f => f.id)));
    result.manifest.version = version;
    result.manifest.retiredFactIds = retiredFacts;
    const review = { date, owner, sourceRevision, method: 'owner-cms-review', evidence: [`Owner review: ${reviewNote}`] };
    for (const a of result.articles) {
        if (a.status !== 'approved') continue;
        const previous = seed ? cmsSeedWorkspace(seed).articles.find(item => item.id === a.id) : null;
        const authored = workspace.articles.find(item => item.id === a.id);
        const changed = authored?.status !== 'draft' && (!previous || JSON.stringify(previous) !== JSON.stringify(authored));
        if (changed) a.review = review;
        a.relatedArticleIds = (a.relatedArticleIds || []).filter(id => activeIds.has(id));
        for (const s of a.sections) {
            if (!changed) continue;
            // Keep each legacy answer's own paragraph when common numbered
            // instructions are added to its section.
            const separateAnswers = cmsHasSeparateAnswers(s);
            if (separateAnswers && s.paragraphs.length !== s.facts.length) fail('Keep one paragraph per existing Guide answer in this section. Add a separate section for extra paragraphs.');
            s.facts = s.facts.map((f, index) => ({ ...f, ...(f.answerKind === 'procedure' ? {} : { message: separateAnswers ? cmsSeparateAnswerMessage(s, index) : cmsSectionMessage(s) }), reviewed: date, evidence: review.evidence[0] }));
        }
    }
    return { schemaVersion: 1, baseContentVersion: workspace.baseContentVersion, version, manifest: result.manifest, articles: result.articles, review };
}
export function changeCmsArticleStatus(workspace, id, status) {
    const result = copy(workspace), a = result.articles.find(item => item.id === id);
    if (!a || !['draft', 'approved', 'retired'].includes(status)) fail('This article is unavailable.');
    a.status = status;
    return result;
}
export function reorderCmsItems(list, id, direction) {
    const result = [...list]; const index = result.findIndex(item => (typeof item === 'string' ? item : item.id) === id);
    const target = index + (direction === 'up' || direction === -1 ? -1 : 1);
    if (index >= 0 && target >= 0 && target < result.length) [result[index], result[target]] = [result[target], result[index]];
    return result;
}
const uniqueSlug = (title, existing) => {
    const base = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'new-topic';
    let candidate = base, i = 2; while (existing.includes(candidate)) candidate = `${base}-${i++}`; return candidate;
};
export function createCmsCategory(workspace, title) {
    const result = copy(workspace);
    result.manifest.categories.push({ id: uniqueSlug(title, result.manifest.categories.map(c => c.id)), title: title.trim() || 'New topic' });
    return result;
}
export function createCmsArticle(workspace, category, title = 'New article') {
    const result = copy(workspace);
    const number = Math.max(0, ...result.articles.map(a => Number(a.id.slice(3)))) + 1;
    if (number > 999) fail('Article identity limit reached.');
    const id = `HC-${String(number).padStart(2, '0')}`;
    result.articles.push({ id, slug: uniqueSlug(title, result.articles.map(a => a.slug)), title, summary: 'Explain what this article helps someone do.', category, audiences: ['everyone'], visibility: 'public', status: 'draft', relatedArticleIds: [], sections: [{ id: 'instructions', title: 'Instructions', paragraphs: ['Describe when to use these instructions.'], steps: ['Describe the first step.'], stepIds: ['instructions-step-1'], notes: [], facts: [], media: [] }] });
    result.manifest.articleOrder.push(id);
    return result;
}
export function validateCmsImage(bytes, mime) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!b.length || b.length > CMS_LIMITS.imageBytes) fail('Images must be no larger than 2 MB.');
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const word = (offset, length) => String.fromCharCode(...b.slice(offset, offset + length));
    let width = 0, height = 0;
    if (mime === 'image/png' && b.length >= 33 && [137,80,78,71,13,10,26,10].every((v,i) => b[i] === v)
        && view.getUint32(8) === 13 && word(12, 4) === 'IHDR') {
        width = view.getUint32(16); height = view.getUint32(20);
    } else if (mime === 'image/jpeg' && b.length >= 4 && b[0] === 255 && b[1] === 216 && b.at(-2) === 255 && b.at(-1) === 217) {
        const frames = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
        let cursor = 2;
        while (cursor + 4 <= b.length && b[cursor] === 255) {
            while (cursor < b.length && b[cursor] === 255) cursor++;
            const marker = b[cursor++];
            if (marker === 0xda || marker === 0xd9) break;
            if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
            if (cursor + 2 > b.length) break;
            const length = view.getUint16(cursor);
            if (length < 2 || cursor + length > b.length) break;
            if (frames.has(marker) && length >= 8) { height = view.getUint16(cursor + 3); width = view.getUint16(cursor + 5); break; }
            cursor += length;
        }
    } else if (mime === 'image/webp' && b.length >= 30 && word(0, 4) === 'RIFF' && word(8, 4) === 'WEBP'
        && view.getUint32(4, true) + 8 === b.length) {
        const kind = word(12, 4);
        if (kind === 'VP8X' && view.getUint32(16, true) >= 10) {
            width = 1 + b[24] + (b[25] << 8) + (b[26] << 16);
            height = 1 + b[27] + (b[28] << 8) + (b[29] << 16);
        } else if (kind === 'VP8L' && b[20] === 0x2f) {
            const bits = view.getUint32(21, true); width = (bits & 0x3fff) + 1; height = (bits >>> 14 & 0x3fff) + 1;
        } else if (kind === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
            width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff;
        }
    }
    if (!width || !height) fail('Choose a PNG, JPEG or WebP image with a matching file type and valid dimensions.');
    if (width > 8192 || height > 8192 || width * height > 20000000) fail('Images must be at most 8192 pixels per side and 20 million pixels in total.');
    return { mime, size: b.length, width, height };
}
