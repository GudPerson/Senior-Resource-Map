import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { changeCmsArticleStatus, createCmsArticle, createCmsCategory, reorderCmsItems, validateCmsWorkspace } from '../../../../shared/helpContentCms.js';
import { createHelpContentApi } from './helpContentApi.js';
import { cloneCms, cmsArticleImpact, cmsCanRequest, cmsCanSave, cmsChangeSummary, cmsDirty, cmsLocalId, cmsLoadEnvelope, cmsRemoveStep, cmsSafeVideo, CMS_IMAGE_BYTES, updateCmsArticle, updateCmsSection, cmsMoveArticleWithinTopic } from './helpContentDraftModel.js';
import { CmsButton, CmsDialog } from './CmsControls.jsx';
import HelpCatalogue from './HelpCatalogue.jsx';
import HelpContentPublications from './HelpContentPublications.jsx';
import ArticleEditor from './ArticleEditor.jsx';
import HelpContentPreview, { useCmsMediaUrls } from './HelpContentPreview.jsx';
import './helpContent.css';

function useCmsDialog() {
    const [definition, setDefinition] = useState(null), resolver = useRef(null);
    const ask = (value) => new Promise((resolve) => {
        if (resolver.current) { resolve(null); return; }
        resolver.current = resolve; setDefinition(value);
    });
    function complete(value) { const resolve = resolver.current; resolver.current = null; setDefinition(null); resolve?.(value); }
    useEffect(() => () => { resolver.current?.(null); }, []);
    return { ask, definition, complete };
}
function revisionId(value) { return value.revisionId || value.id || value.key; }
function revisionLabel(value) { return value.savedAt || value.updatedAt || value.createdAt || value.timestamp || value.version || 'Saved revision'; }
function HelpContentSession({ api }) {
    const [workspace, setWorkspace] = useState(null), [saved, setSaved] = useState(null), [etag, setEtag] = useState(null);
    const [configured, setConfigured] = useState(false), [publishingAvailable, setPublishingAvailable] = useState(false), [baseDrift, setBaseDrift] = useState(false), [activeReleaseId, setActiveReleaseId] = useState(null);
    const [selectedId, setSelectedId] = useState(''), [query, setQuery] = useState(''), [showArchived, setShowArchived] = useState(false);
    const [busy, setBusy] = useState('Loading Help Content'), [error, setError] = useState(''), [message, setMessage] = useState('');
    const [denied, setDenied] = useState(false), [conflict, setConflict] = useState(false), [uploadBusy, setUploadBusy] = useState(false);
    const [tab, setTab] = useState('editor'), [revisions, setRevisions] = useState([]), [releases, setReleases] = useState([]);
    const live = useRef(null), generation = useRef(0), session = useRef(null), uploadLock = useRef(false);
    const dialog = useCmsDialog(), navigate = useNavigate();
    const article = workspace?.articles.find((value) => value.id === selectedId);
    const media = useCmsMediaUrls(article, api);
    const dirty = cmsDirty(workspace, saved);
    live.current = workspace;
    function apply(data) {
        cmsLoadEnvelope(data);
        generation.current += 1;
        setWorkspace(data.workspace); live.current = data.workspace; setSaved(cloneCms(data.workspace)); setEtag(data.etag);
        setSelectedId((id) => data.workspace.articles.some((value) => value.id === id) ? id : data.workspace.manifest.articleOrder[0] || '');
        setConflict(false); setError('');
        if (typeof data.configured === 'boolean') setConfigured(data.configured);
        if (typeof data.publishingAvailable === 'boolean') setPublishingAvailable(data.publishingAvailable);
        if (typeof data.baseDrift === 'boolean') setBaseDrift(data.baseDrift);
        if ('activeReleaseId' in data) setActiveReleaseId(data.activeReleaseId || null);
    }
    function fail(cause) {
        if (session.current?.signal.aborted) return;
        if (cause.status === 401 || cause.status === 403) setDenied(true);
        if (Array.isArray(cause.conflicts) && cause.conflicts.length) {
            const titles = [...new Set(cause.conflicts.map((value) => live.current?.articles.find((article) => value.startsWith(`${article.id}.`))?.title || 'Topic or article order'))];
            setError(`The published library and this draft changed the same content: ${titles.join(', ')}. Your draft is kept. Review these changes before updating it to the current publication.`); return;
        }
        if (cause.status === 409 || cause.status === 412) setConflict(true);
        setError(cause.status === 409 || cause.status === 412
            ? 'A newer draft was saved elsewhere. Your edits are still here. Reload the saved draft when you are ready to replace them.'
            : cause.message || 'This request failed. Your draft has been kept.');
    }
    useEffect(() => {
        const controller = new AbortController(); session.current = controller;
        api.load(controller.signal).then((data) => { if (!controller.signal.aborted) apply(data); })
            .catch(fail).finally(() => { if (!controller.signal.aborted) setBusy(''); });
        return () => { generation.current += 1; controller.abort(); };
    }, [api]);
    useEffect(() => {
        if (!dirty) return undefined;
        const protect = (event) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', protect);
        return () => window.removeEventListener('beforeunload', protect);
    }, [dirty]);
    useEffect(() => {
        if (!dirty) return undefined;
        const protectLink = async (event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const link = event.target.closest?.('a[href]');
            if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
            const url = new URL(link.href, window.location.href);
            if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
            event.preventDefault(); event.stopPropagation();
            const answer = await dialog.ask({ title: 'Leave unsaved changes?', description: 'Save this draft before leaving to keep your changes. Leaving now discards your unsaved text, order and attachments.', confirm: 'Leave without saving', danger: true });
            if (answer && !session.current.signal.aborted) navigate(`${url.pathname}${url.search}${url.hash}`);
        };
        document.addEventListener('click', protectLink, true);
        return () => document.removeEventListener('click', protectLink, true);
    }, [dirty, navigate, dialog.ask]);
    async function run(label, operation) {
        if (busy || uploadLock.current) return;
        setBusy(label); setError(''); setMessage('');
        try { await operation(session.current.signal); }
        catch (cause) { fail(cause); }
        finally { if (!session.current.signal.aborted) setBusy(''); }
    }
    function edit(update) {
        setWorkspace((current) => { const next = typeof update === 'function' ? update(current) : update; live.current = next; return next; });
        setMessage('');
    }
    async function save() {
        const submitted = cloneCms(live.current);
        await run('Saving draft', async (signal) => {
            validateCmsWorkspace(submitted);
            for (const value of submitted.articles) for (const section of value.sections) for (const item of section.media || []) if (item.type === 'video') cmsSafeVideo(item.url);
            const data = await api.save(submitted, etag, signal);
            if (signal.aborted) return;
            apply(data); setMessage('Draft saved. Published articles and Guide answers change after publication completes.');
        });
    }
    async function reload() {
        if (dirty && !await dialog.ask({ title: 'Replace your unsaved changes?', description: 'Reloading opens the latest saved draft. Your current unsaved text, order and attachments will be discarded.', confirm: 'Replace with saved draft', danger: true })) return;
        await run('Opening saved draft', async (signal) => { const data = await api.load(signal); if (!signal.aborted) { apply(data); setMessage('Latest saved draft opened.'); } });
    }
    async function addTopic() {
        const value = await dialog.ask({ title: 'Add a topic', description: 'Create a browsing topic for your articles.', fields: [{ name: 'title', label: 'Topic title', required: true, maxLength: 160 }], confirm: 'Add topic' });
        if (value) edit((current) => createCmsCategory(current, value.title));
    }
    async function addArticle(categoryId) {
        const value = await dialog.ask({ title: 'Add an article', description: 'Start a public draft with an introduction and numbered instructions. You can add more sections.', fields: [{ name: 'title', label: 'Article title', required: true }], confirm: 'Create draft' });
        if (!value) return;
        const next = createCmsArticle(live.current, categoryId, value.title.trim());
        edit(next); setSelectedId(next.articles.at(-1).id); setTab('editor');
    }
    async function topicAction(id, action, direction) {
        const current = live.current, category = current.manifest.categories.find((value) => value.id === id);
        if (action === 'move') { edit({ ...current, manifest: { ...current.manifest, categories: reorderCmsItems(current.manifest.categories, id, direction) } }); return; }
        if (action === 'rename') {
            const value = await dialog.ask({ title: 'Rename topic', description: 'Existing article assignments are retained.', fields: [{ name: 'title', label: 'Topic title', value: category.title, required: true, maxLength: 160 }], confirm: 'Rename' });
            if (value) edit((draft) => ({ ...draft, manifest: { ...draft.manifest, categories: draft.manifest.categories.map((item) => item.id === id ? { ...item, title: value.title.trim() } : item) } }));
            return;
        }
        if (action === 'restore') { edit((draft) => ({ ...draft, manifest: { ...draft.manifest, categories: draft.manifest.categories.map((item) => item.id === id ? { ...item, archived: false } : item) } })); return; }
        const assigned = current.articles.filter((value) => value.category === id);
        const active = assigned.filter((value) => value.status !== 'retired');
        const published = assigned.some((value) => value.review?.date);
        const remove = action === 'remove' && !published;
        const destinations = current.manifest.categories.filter((value) => value.id !== id && !value.archived);
        const needDestination = remove ? assigned.length > 0 : active.length > 0;
        const options = destinations.map((value) => ({ value: value.id, label: `Move articles to ${value.title}` }));
        if (!remove) options.push({ value: 'archive-all', label: 'Archive the articles in this topic' });
        if (needDestination && !options.length) { setError('Add another topic before removing this topic and moving its articles.'); return; }
        const response = await dialog.ask({ title: remove ? 'Remove topic?' : 'Archive topic?', description: remove ? 'This topic will be removed from the draft. Choose another topic for its articles.' : 'The topic leaves the live browsing list after publication. Its history remains available. Choose what happens to its articles.', details: assigned.map((value) => value.title),
            fields: needDestination ? [{ name: 'destination', label: 'Articles in this topic', options }] : [], confirm: remove ? 'Remove topic' : 'Archive topic', danger: true });
        if (!response) return;
        edit((draft) => ({ ...draft,
            manifest: { ...draft.manifest, categories: remove ? draft.manifest.categories.filter((value) => value.id !== id) : draft.manifest.categories.map((value) => value.id === id ? { ...value, archived: true } : value) },
            articles: draft.articles.map((value) => value.category !== id ? value : response.destination && response.destination !== 'archive-all' ? { ...value, category: response.destination } : { ...value, status: 'retired' }),
        }));
    }
    async function articleStatus(status) {
        if (!article) return;
        if (status === 'retired') {
            const impact = cmsArticleImpact(live.current, article.id);
            const response = await dialog.ask({ title: 'Archive article?', description: 'After publication, this article leaves browse, search and Guide answers. Saved history remains available. Existing reading links will show that it is unavailable.', details: [`${impact.incoming.length} related articles link here. Their links are removed from the published reading view.`, `${impact.factCount} existing Guide answers are affected.`, ...impact.incoming.map((value) => value.title)], approval: 'I reviewed this article’s removal from the published Help Centre and Guide.', confirm: 'Archive article', danger: true });
            if (!response) return;
        }
        if (status !== 'retired' && live.current.manifest.categories.find((category) => category.id === article.category)?.archived) { setError('Restore this article’s topic or move the article to an active topic first.'); return; }
        edit((current) => changeCmsArticleStatus(current, article.id, status));
    }
    async function removeArticle() {
        if (article.review?.date) { await articleStatus('retired'); return; }
        const response = await dialog.ask({ title: 'Remove this draft article?', description: 'This unpublished article will be removed. Previous saved revisions remain in history.', confirm: 'Remove draft', danger: true });
        if (!response) return;
        const next = { ...live.current, articles: live.current.articles.filter((value) => value.id !== article.id).map((value) => ({ ...value, relatedArticleIds: (value.relatedArticleIds || []).filter((id) => id !== article.id) })), manifest: { ...live.current.manifest, articleOrder: live.current.manifest.articleOrder.filter((id) => id !== article.id) } };
        edit(next); setSelectedId(next.manifest.articleOrder[0] || ''); generation.current += 1;
    }
    async function removeStep(sectionId, stepId) {
        const section = article.sections.find((value) => value.id === sectionId), attached = section.media.filter((value) => value.afterStepId === stepId);
        const value = await dialog.ask({ title: 'Remove instruction?', description: attached.length ? `This instruction has ${attached.length} attachments. Choose what happens to them.` : 'The remaining instructions are renumbered. Their attachments stay with the same instruction.',
            fields: attached.length ? [{ name: 'placement', label: 'Attachments', options: [{ value: 'introduction', label: 'Move to this section’s introduction' }, ...section.stepIds.filter((id) => id !== stepId).map((id) => ({ value: id, label: `Move after instruction ${section.stepIds.indexOf(id) + 1}` })), { value: 'remove', label: 'Remove these attachments' }] }] : [], confirm: 'Remove instruction', danger: true });
        if (!value) return;
        edit((current) => updateCmsSection(current, article.id, sectionId, (s) => cmsRemoveStep(s, stepId, value.placement === 'introduction' ? null : value.placement)));
    }
    async function upload(sectionId, afterStepId, files) {
        if (!files.length || uploadLock.current || busy || !configured) return;
        const startGeneration = generation.current, articleId = article.id;
        if (!saved.articles.some((value) => value.id === articleId)) { setError('Save this new article before uploading images.'); return; }
        uploadLock.current = true; setUploadBusy(true); setError('');
        try {
            for (const file of files) {
                const currentArticle = live.current?.articles.find((value) => value.id === articleId), section = currentArticle?.sections.find((value) => value.id === sectionId);
                if (startGeneration !== generation.current || !section || afterStepId !== null && !section.stepIds.includes(afterStepId)) throw new Error('The draft changed while adding images. Choose the images again in the current instruction.');
                const attachments = currentArticle.sections.flatMap((value) => value.media || []);
                if (currentArticle.visibility !== 'public') throw new Error('Attachments are currently available for public articles.');
                if (attachments.length >= 24 || attachments.filter((value) => value.type === 'image').length >= 12) throw new Error('Keep up to twelve images and twenty-four attachments per article.');
                if (file.size > CMS_IMAGE_BYTES || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose PNG, JPEG or WebP images no larger than 2 MB each.');
                const data = await api.upload(file, articleId, session.current.signal);
                if (session.current.signal.aborted) return;
                if (startGeneration !== generation.current) throw new Error('The draft was replaced while adding an image. Choose the image again.');
                edit((current) => updateCmsSection(current, articleId, sectionId, (s) => {
                    if (afterStepId !== null && !s.stepIds.includes(afterStepId)) throw new Error('The instruction was removed while uploading this image.');
                    return { ...s, media: [...s.media, { id: cmsLocalId('media', s.media.map((value) => value.id)), type: 'image', afterStepId, assetId: data.assetId, caption: '', alt: '' }] };
                }));
            }
            setMessage('Images added. Enter a caption and accessible description for each image, then save the draft.');
        } catch (cause) { fail(cause); }
        finally { uploadLock.current = false; if (!session.current.signal.aborted) setUploadBusy(false); }
    }
    async function openTab(value) {
        setTab(value);
        if (value === 'history') await run('Loading saved history', async (signal) => { const data = await api.history(signal); if (!signal.aborted) setRevisions(data.revisions || data.history || []); });
        if (value === 'publication') await run('Checking publications', async (signal) => { const data = await api.releases(signal); if (!signal.aborted) setReleases(data.releases || []); });
    }
    async function restoreRevision(value) {
        const id = revisionId(value);
        if (!id) return;
        const response = await dialog.ask({ title: 'Restore saved revision?', description: 'This replaces the whole saved catalogue, text and attachments with the selected revision. It does not roll application code back. Unsaved changes will be discarded.', details: [String(revisionLabel(value))], confirm: 'Restore revision', danger: true });
        if (!response) return;
        await run('Restoring revision', async (signal) => { const data = await api.restore(id, etag, signal); if (!signal.aborted) { apply(data); setTab('editor'); setMessage('Revision restored as the saved draft. Review it before publishing.'); } });
    }
    async function rebaseDraft() {
        if (dirty || conflict || etag === null) return;
        const response = await dialog.ask({ title: 'Update draft to the current publication?', description: 'Keep the saved draft’s edits and bring in published changes where they do not conflict. Conflicting changes leave the draft untouched. Review the result before publishing.', approval: 'I approve checking this saved draft against the current published library.', confirm: 'Update saved draft' });
        if (!response) return;
        await run('Updating saved draft', async (signal) => { const data = await api.rebase(etag, signal); if (!signal.aborted) { apply(data); setTab('editor'); setMessage(`Draft updated to the current published library. ${data.rebaseReport?.mergedFields?.length || 0} fields were merged. Review the draft before publishing.`); } });
    }
    async function checkReleaseJob(value) {
        const id = value.releaseId || value.id;
        const response = await dialog.ask({ title: 'Check this release job?', description: 'Check whether the publication job has finished or stopped, and complete recovery for a verified release. A job that is still running keeps its publication lock. Your current draft is retained.', details: [value.version || value.contentVersion || 'Content publication'], approval: 'I approve checking this publication’s job status.', confirm: 'Check release job' });
        if (!response) return;
        await run('Checking release job', async (signal) => {
            try { await api.reconcile(id, signal); } catch (cause) { if (cause.status === 409) { setError(cause.message || 'The release job has not been proved finished. Your draft is retained.'); return; } throw cause; }
            if (signal.aborted) return;
            const results = await Promise.allSettled([api.releases(signal), api.load(signal)]);
            if (signal.aborted) return;
            if (results[0].status === 'fulfilled') setReleases(results[0].value.releases || []);
            if (results[1].status === 'fulfilled') {
                const data = cmsLoadEnvelope(results[1].value);
                if (typeof data.configured === 'boolean') setConfigured(data.configured);
                if (typeof data.publishingAvailable === 'boolean') setPublishingAvailable(data.publishingAvailable);
                if (typeof data.baseDrift === 'boolean') setBaseDrift(data.baseDrift);
                if ('activeReleaseId' in data) setActiveReleaseId(data.activeReleaseId || null);
                if (data.etag !== etag) { setConflict(true); setError('The saved draft changed while checking this job. Your current edits are retained. Reload the saved draft when you are ready.'); }
            }
            const failed = results.find((result) => result.status === 'rejected');
            if (failed) throw failed.reason;
            setMessage('Release job checked. Your editor draft has been retained. Review the publication status below.');
        });
    }
    async function retryRelease(value) {
        const id = value.releaseId || value.id;
        const response = await dialog.ask({ title: 'Retry this publication?', description: 'Retry the exact saved publication. Your current draft is kept.', details: [value.version || value.contentVersion || 'Content publication'], approval: 'I approve retrying this previously reviewed publication.', confirm: 'Retry publication' });
        if (!response) return;
        await run('Retrying publication', async (signal) => { await api.retry(id, signal); if (!signal.aborted) { const data = await api.releases(signal); if (!signal.aborted) { setReleases(data.releases || []); setMessage('Publication retry requested. Check its status below.'); } } });
    }
    async function publish() {
        if (dirty || conflict || baseDrift || etag === null || !publishingAvailable) return;
        const approved = workspace.articles.filter((value) => value.status === 'approved'), archived = workspace.articles.filter((value) => value.status === 'retired');
        const response = await dialog.ask({ title: 'Review publication', description: 'Publish the saved library to both the Help Centre and Guide. Completion is shown only after the matching versions are verified.', details: [`${approved.length} articles included`, `${workspace.articles.filter((value) => value.status === 'draft').length} articles with private draft edits`, `${archived.length} archived articles excluded`, 'Private draft edits stay unpublished; existing published versions are retained.', ...archived.map((value) => `Archived: ${value.title}`)], fields: [{ name: 'reviewNote', label: 'What changed and what did you check?', multiline: true, required: true, maxLength: 2000 }], approval: 'I checked the instructions, access and privacy boundaries, and approve this saved content for publication.', confirm: 'Publish saved content' });
        if (!response) return;
        await run('Preparing publication', async (signal) => { const result = await api.publish(etag, response.reviewNote.trim(), signal); if (signal.aborted) return;
            setMessage(result.message || 'Publication requested. Check its progress below.');
            const data = await api.releases(signal); if (!signal.aborted) setReleases(data.releases || []); setTab('publication');
        });
    }
    if (denied) return <main className="help-cms"><h1>Help Content</h1><p role="alert" className="cms-banner error">{error || 'Help Content is available only in the content owner’s account.'}</p><p className="cms-muted">Sign in with the authorised owner account and reopen Help Content.</p></main>;
    if (!workspace) return <main className="help-cms"><h1>Help Content</h1>{busy ? <p role="status">{busy}…</p> : <><p role="alert" className="cms-banner error">{error}</p><CmsButton onClick={reload}>Try again</CmsButton></>}</main>;
    const disabled = Boolean(busy || uploadBusy);
    return <main className="help-cms">
        <header className="cms-header"><div><h1>Help Content</h1><p className="cms-muted">{workspace.articles.length} articles · {workspace.manifest.categories.length} topics · {dirty ? 'Unsaved changes' : etag === null ? 'No saved draft yet' : 'Draft saved'}{busy ? ` · ${busy}…` : ''}</p></div><div className="cms-actions"><CmsButton disabled={disabled} onClick={reload}>Reload saved draft</CmsButton><CmsButton primary disabled={!cmsCanSave(workspace, saved, etag, { configured, busy: disabled, conflict })} onClick={save}>{busy === 'Saving draft' ? 'Saving…' : 'Save draft'}</CmsButton></div></header>
        {!configured && <p role="status" className="cms-banner">Draft storage is not configured yet. You can explore the editor; saving, uploads and publication are unavailable.</p>}
        {baseDrift && <p role="status" className="cms-banner error">The published library changed after this draft began. Your saved draft is kept. Review and update it before publication. <CmsButton disabled={disabled || dirty || conflict || etag === null} onClick={rebaseDraft}>Update to published library</CmsButton></p>}
        {error && <p role="alert" className="cms-banner error">{error}</p>}{message && <p role="status" className="cms-banner">{message}</p>}
        <div className="cms-tabs" aria-label="Help Content views"><button type="button" aria-pressed={tab === 'editor'} disabled={disabled} onClick={() => openTab('editor')}>Editor</button><button type="button" aria-pressed={tab === 'history'} disabled={disabled} onClick={() => openTab('history')}>Saved history</button><button type="button" aria-pressed={tab === 'publication'} disabled={disabled} onClick={() => openTab('publication')}>Publication</button></div>
        {tab === 'editor' && <fieldset disabled={disabled} style={{ border: 0, minWidth: 0, padding: 0 }}><div className="cms-workspace">
            <HelpCatalogue workspace={workspace} selectedId={selectedId} onSelect={setSelectedId} query={query} onQuery={setQuery} showArchived={showArchived} onShowArchived={setShowArchived} onAddTopic={addTopic} onTopicAction={topicAction} onAddArticle={addArticle} onArticleMove={(id, direction) => edit((current) => cmsMoveArticleWithinTopic(current, id, direction))} />
            {article ? <><section className="cms-editor" aria-label="Article editor"><div className="cms-toolbar"><div><h2>Article editor</h2><p className="cms-muted">{article.status === 'retired' ? 'Archived article' : article.status === 'approved' ? 'Included in next publication' : article.review?.date ? 'Draft edits kept private' : 'Draft article'}</p></div><div className="cms-actions">
                {article.status === 'retired' ? <CmsButton onClick={() => articleStatus('draft')}>Restore to draft</CmsButton> : <><CmsButton aria-pressed={article.status === 'approved'} onClick={() => articleStatus(article.status === 'approved' ? 'draft' : 'approved')}>{article.status === 'approved' ? article.review?.date ? 'Keep edits private' : 'Keep as draft' : article.review?.date ? 'Include edits in publication' : 'Include in publication'}</CmsButton><CmsButton danger onClick={() => articleStatus('retired')}>Archive</CmsButton></>}
                {!article.review?.date && <CmsButton danger onClick={removeArticle}>Remove draft</CmsButton>}
            </div></div><div className="cms-scroll" tabIndex={0} role="region" aria-label="Scrollable article editor"><ArticleEditor article={article} categories={workspace.manifest.categories} onChange={(value) => edit((current) => updateCmsArticle(current, article.id, () => value))} onRemoveStep={removeStep} onUpload={upload} mediaUrls={media.urls} uploadBusy={uploadBusy || !configured} allowImageUpload={saved.articles.some((value) => value.id === article.id)} /></div></section><HelpContentPreview article={article} mediaUrls={media.urls} errors={media.errors} /></> : <p className="cms-muted">Select or create an article to start editing.</p>}
        </div></fieldset>}
        {tab === 'history' && <section aria-label="Saved revisions"><div className="cms-toolbar"><h2>Saved history</h2><div className="cms-actions"><CmsButton disabled={disabled || !configured || conflict} onClick={() => restoreRevision({ revisionId: 'published', updatedAt: 'Current published library' })}>Start from published library</CmsButton><CmsButton disabled={disabled} onClick={() => openTab('history')}>Refresh history</CmsButton></div></div><p className="cms-muted" style={{ marginTop: 12 }}>Restore the entire saved library, including article text, topics, order and attachments.</p><ul className="cms-history-list">{revisions.map((value) => <li key={revisionId(value)}><div className="cms-actions"><div><strong>{String(revisionLabel(value))}</strong><p className="cms-muted">{value.articleCount !== undefined ? `${value.articleCount} articles` : 'Content revision'}</p></div><CmsButton disabled={disabled || !configured || conflict} onClick={() => restoreRevision(value)}>Restore revision</CmsButton></div></li>)}</ul>{!revisions.length && <p className="cms-muted" style={{ marginTop: 24 }}>No saved revisions yet.</p>}</section>}
        {tab === 'publication' && <section aria-label="Publication"><div className="cms-toolbar"><div><h2>Publish saved content</h2><p className="cms-muted">Help Centre and Guide use the same approved library.</p></div><CmsButton primary disabled={disabled || !configured || !publishingAvailable || dirty || conflict || baseDrift || etag === null} onClick={publish}>Review & publish</CmsButton></div>
            {(dirty || etag === null) && <p className="cms-banner">Save your draft before reviewing publication.</p>}{!publishingAvailable && <p className="cms-banner">Publishing is not available yet. Saved drafts remain separate from the live Help Centre.</p>}
            <h3 style={{ marginTop: 24 }}>Publication history</h3><HelpContentPublications releases={releases} publishingAvailable={publishingAvailable} disabled={disabled} activeReleaseId={activeReleaseId} onRetry={retryRelease} onCheck={checkReleaseJob} />{!releases.length && <p className="cms-muted" style={{ marginTop: 12 }}>No CMS publications yet.</p>}<CmsButton style={{ marginTop: 14 }} disabled={disabled} onClick={() => openTab('publication')}>Refresh publication status</CmsButton>
        </section>}
        {dirty && <details style={{ marginTop: 20 }}><summary className="cms-muted">Changes since last save</summary><ul style={{ fontSize: 12, marginTop: 10, paddingLeft: 18 }}>{cmsChangeSummary(workspace, saved).map((value, index) => <li key={index}>{value}</li>)}</ul></details>}
        <CmsDialog definition={dialog.definition} onComplete={dialog.complete} />
    </main>;
}
export default function HelpContentPage({ api: providedApi } = {}) {
    const { user, isLoading, isImpersonating } = useAuth();
    const api = useMemo(() => providedApi || createHelpContentApi(), [providedApi]);
    if (!cmsCanRequest(user, isImpersonating, isLoading)) return <main className="help-cms"><h1>Help Content</h1><p role="status" className="cms-banner">{isLoading ? 'Checking your account…' : isImpersonating || user?.isImpersonating ? 'Exit User View to open Help Content.' : 'Sign in with the content owner account to open Help Content.'}</p></main>;
    return <HelpContentSession key={`${user.id}:${Boolean(isImpersonating || user.isImpersonating)}`} api={api} />;
}
