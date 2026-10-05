import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CMS_LIMITS, cmsHasSeparateAnswers, cmsReadingArticle } from '../../../../shared/helpContentCms.js';
import { cmsAddStep, cmsNewSection } from './helpContentDraftModel.js';
import { CmsButton, CmsField } from './CmsControls.jsx';
import { AttachmentGroup } from './ArticleEditor.jsx';
import HelpCatalogue from './HelpCatalogue.jsx';
import HelpArticle from '../help/HelpArticle.jsx';
import HelpMedia from '../help/HelpMedia.jsx';
import { GuideDraftContent } from './HelpContentPreview.jsx';
import CmsSortableList from './CmsSortableList.jsx';
import CmsRowMenu from './CmsRowMenu.jsx';
import { placeCmsItem, placeCmsStep } from './helpContentSortModel.js';
import './helpContentContext.css';

function InlineForm({ block, onValue, onDone, onCancel, disabled }) {
    const input = useRef(null);
    useEffect(() => { input.current?.focus({ preventScroll: true }); }, [block.key]);
    return <form className="cms-context-inline" onSubmit={(event) => { event.preventDefault(); onDone(); }}>
        <label><span>{block.label}</span>{block.multiline
            ? <textarea ref={input} value={block.value} onChange={(event) => onValue(event.target.value)} maxLength={block.maxLength} required disabled={disabled} />
            : <input ref={input} value={block.value} onChange={(event) => onValue(event.target.value)} maxLength={block.maxLength} required disabled={disabled} />}</label>
        <div className="cms-actions"><CmsButton disabled={disabled} onClick={onCancel}>Cancel</CmsButton><button type="submit" className="cms-button primary" disabled={disabled || !block.value.trim()}>Done</button></div>
        <p className="cms-muted">Done applies this change to your draft. Save draft stores the whole library.</p>
    </form>;
}

function ArticleRow({ article, disabled, onOpen, handle, excluded = false }) {
    return <>{handle}<button type="button" disabled={disabled} onClick={onOpen} className="cms-context-reading-link"><span><strong>{article.title}</strong><span>{article.summary}</span><small>{article.status === 'retired' ? 'Archived' : excluded ? 'Excluded by archived topic' : article.status === 'approved' ? 'Included in next publication' : article.review?.date ? 'Private draft edits' : 'Draft article'}</small></span><span aria-hidden="true">→</span></button></>;
}

// This view contains no persistence or permission decisions. The existing CMS
// session supplies authorisation, saved state, uploads and publication handlers.
export default function HelpContentContext({ workspace, etag, article, selectedId, selectArticle, editArticle, editTopic, tab, openTab, status, dialog, history, publication, disabled, uploadBusy, allowImageUpload, configured, dirty, canSave, save, pendingChanged, addTopic, addArticle, topicAction, topicPlace, articlePlace, articleStatus, removeArticle, removeStep, onUpload, mediaUrls, mediaErrors, query, onQuery, showArchived, onShowArchived, initialEditing = false }) {
    const { slug } = useParams(), location = useLocation(), navigate = useNavigate();
    const [params] = useSearchParams();
    const categoryId = params.get('category') || '';
    const topic = workspace.manifest.categories.find((value) => value.id === (slug ? workspace.articles.find((item) => item.slug === slug)?.category : categoryId));
    const ownerMenu = useRef(null);
    const [editing, setEditing] = useState(initialEditing), [preview, setPreview] = useState(false), [guidePreview, setGuidePreview] = useState(false), [block, setBlock] = useState(null), [organise, setOrganise] = useState(false), [sortingScope, setSortingScope] = useState('');
    const ordered = workspace.manifest.articleOrder.map((id) => workspace.articles.find((value) => value.id === id)).filter(Boolean);
    const current = slug ? workspace.articles.find((value) => value.slug === slug) : article;
    // Pending text remains in this mounted identity even through browser history.
    // It is never silently committed by Save or lost by changing a reading route.
    useEffect(() => { pendingChanged(Boolean(block || sortingScope)); return () => pendingChanged(false); }, [Boolean(block || sortingScope), pendingChanged]);
    useEffect(() => {
        if (slug && current?.id && current.id !== selectedId) selectArticle(current.id);
    }, [slug, current?.id, selectedId, selectArticle]);
    useEffect(() => { setPreview(false); setGuidePreview(false); }, [location.pathname]);
    useEffect(() => {
        const closeOutside = (event) => { if (!ownerMenu.current?.contains(event.target)) ownerMenu.current?.removeAttribute('open'); };
        const closeEscape = (event) => { if (event.key === 'Escape') ownerMenu.current?.removeAttribute('open'); };
        document.addEventListener('pointerdown', closeOutside); document.addEventListener('keydown', closeEscape);
        return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); };
    }, []);
    function ownerAction(value) { ownerMenu.current?.removeAttribute('open'); openTab(value); }
    const baseLocked = disabled || Boolean(block), locked = baseLocked || Boolean(sortingScope);
    function sortProps(scope) { return { disabled: baseLocked || Boolean(sortingScope && sortingScope !== scope), onActiveChange: (active) => setSortingScope(active ? scope : '') }; }
    const reading = slug && current ? cmsReadingArticle(current) : null;
    if (reading) {
        delete reading.reviewedAt;
        for (const section of reading.sections) section.media = (section.media || []).filter((item) => item.type !== 'image' || mediaUrls[item.assetId]);
    }
    function openArticle(value) { if (locked) return; selectArticle(value.id); openTab('editor'); navigate(`/help-centre/${value.slug}`); }
    function openTopic(id) { if (locked) return; openTab('editor'); navigate(`/help-centre${id ? `?category=${encodeURIComponent(id)}` : ''}`); }
    function begin(key, label, value, apply, multiline = true, maxLength = 16000) { if (locked) return; setBlock({ key, label, value: value || '', apply, multiline, maxLength }); }
    function done() { if (!block?.value.trim() || disabled) return; block.apply(block.value); setBlock(null); }
    function field(key, label, value, content, apply, multiline = true, maxLength = 16000) {
        return <div className={`cms-context-block ${editing && !preview ? 'editable' : ''}`} key={key} data-context-block={key}>
            {block?.key === key ? <InlineForm block={block} onValue={(value) => setBlock((currentBlock) => ({ ...currentBlock, value }))} onDone={done} onCancel={() => setBlock(null)} disabled={disabled} /> : <>{content}{editing && !preview && <CmsButton className="cms-context-edit-button" disabled={locked} aria-label={`Edit ${label.toLowerCase()}`} onClick={() => begin(key, label, value, apply, multiline, maxLength)}>Edit</CmsButton>}</>}
        </div>;
    }
    function sectionChange(sectionId, update) { editArticle(current.id, (value) => ({ ...value, sections: value.sections.map((section) => section.id === sectionId ? typeof update === 'function' ? update(section) : update : section) })); }
    function listField(section, type, index, value) { return field(`${current.id}:${section.id}:${type}:${type === 'steps' ? section.stepIds[index] : index}`, type === 'steps' ? `Instruction ${index + 1} text` : `${type === 'notes' ? 'Note' : 'Introduction paragraph'} ${index + 1}`, value, <p className="cms-context-text">{value || <em>Write this instruction.</em>}</p>, (text) => sectionChange(section.id, (s) => ({ ...s, [type]: s[type].map((item, i) => i === index ? text : item) })) ); }
    function attachments(section, afterStepId) {
        return <div className="cms-context-media" key={`media-${afterStepId}`}>
            <HelpMedia items={(section.media || []).filter((item) => item.afterStepId === afterStepId && (item.type !== 'image' || mediaUrls[item.assetId]))} mediaUrls={mediaUrls} />
            {editing && !preview && <fieldset disabled={locked}><AttachmentGroup compact article={current} section={section} afterStepId={afterStepId} update={(value) => sectionChange(section.id, value)} onUpload={onUpload} mediaUrls={mediaUrls} uploadBusy={uploadBusy || !configured} allowImageUpload={allowImageUpload} /></fieldset>}
        </div>;
    }
    const currentBlockVisible = block && (slug && current && block.key.startsWith(`${current.id}:`) || !slug && topic && block.key === `topic:${topic.id}`);
    const showArticle = Boolean(slug && current);
    return <main className="help-cms cms-context" lang="en">
        <header className="cms-context-top"><Link to="/help-centre" onClick={(event) => { if (locked) event.preventDefault(); }}>CareAround <strong>Help Centre</strong></Link><details ref={ownerMenu}><summary>More owner tools</summary><div className="cms-context-menu"><CmsButton disabled={locked} onClick={() => ownerAction('manage')}>Manage content</CmsButton><CmsButton disabled={locked} onClick={() => ownerAction('history')}>Saved history</CmsButton><CmsButton disabled={locked} onClick={() => ownerAction('publication')}>Review & publish</CmsButton><Link to="/discover">Return to Discover</Link></div></details></header>
        <p className="cms-context-draft-notice">Owner draft · Your edits change the Help Centre and Guide after publication completes.</p>
        {status}
        <nav className="cms-context-breadcrumbs" aria-label="Help content breadcrumbs"><CmsButton disabled={locked} onClick={() => openTopic('')}>Help Centre</CmsButton>{topic && <><span aria-hidden="true">/</span><CmsButton disabled={locked} onClick={() => openTopic(topic.id)}>{topic.title}</CmsButton></>}{showArticle && <><span aria-hidden="true">/</span><span>Article</span></>}</nav>
        {block && !currentBlockVisible && <section className="cms-context-pending" aria-label="Pending text edit"><p>Finish editing {block.label.toLowerCase()} before saving or editing another item.</p><InlineForm block={block} onValue={(value) => setBlock((currentBlock) => ({ ...currentBlock, value }))} onDone={done} onCancel={() => setBlock(null)} disabled={disabled} /></section>}
        {tab === 'history' ? <><CmsButton disabled={locked} onClick={() => openTab('editor')}>Back to Help Centre</CmsButton>{history}</> : tab === 'publication' ? <><CmsButton disabled={locked} onClick={() => openTab('editor')}>Back to Help Centre</CmsButton>{publication}</> : tab === 'manage' ? <section className="cms-context-manage"><header className="cms-context-heading"><h1>Manage content</h1><CmsButton disabled={locked} onClick={() => openTopic('')}>Back to Help Centre</CmsButton></header><fieldset disabled={baseLocked}><HelpCatalogue workspace={workspace} selectedId={selectedId} onSelect={(id) => openArticle(workspace.articles.find((value) => value.id === id))} query={query} onQuery={onQuery} showArchived={showArchived} onShowArchived={onShowArchived} onAddTopic={addTopic} onTopicAction={topicAction} onAddArticle={addArticle} onTopicPlace={topicPlace} onArticlePlace={articlePlace} baseDisabled={baseLocked} sortingScope={sortingScope} onSortingScope={setSortingScope} /></fieldset></section> : showArticle ? <>
            <div className="cms-context-heading"><span className="cms-context-label">{preview ? 'Draft preview' : editing ? 'Editing this article' : 'Article draft'} · {workspace.manifest.categories.find((value) => value.id === current.category)?.archived ? 'Excluded by archived topic' : current.status === 'approved' ? 'Included in next publication' : current.status === 'retired' ? 'Archived article' : current.review?.date ? 'Private draft edits' : 'Draft article'}</span>{!editing && <CmsButton primary disabled={locked} onClick={() => { setEditing(true); setPreview(false); }}>Edit this article</CmsButton>}</div>
            {mediaErrors.map((error, index) => <p key={index} role="status" className="cms-banner error">{error}</p>)}
            {preview ? <><div className="cms-media-actions"><CmsButton aria-pressed={!guidePreview} onClick={() => setGuidePreview(false)}>Help article</CmsButton><CmsButton aria-pressed={guidePreview} onClick={() => setGuidePreview(true)}>Guide text</CmsButton></div>{guidePreview ? <GuideDraftContent article={current} /> : <HelpArticle article={reading} mediaUrls={mediaUrls} backRoute={`/help-centre?category=${encodeURIComponent(current.category)}`} />}</> : <article className="cms-context-article">
                <header className="cms-context-article-head">
                    {field(`${current.id}:title`, 'Article title', current.title, <h1 id="help-article-title">{current.title}</h1>, (title) => editArticle(current.id, (value) => ({ ...value, title })), false, 240)}
                    {field(`${current.id}:summary`, 'Article summary', current.summary, <p className="cms-context-summary">{current.summary}</p>, (summary) => editArticle(current.id, (value) => ({ ...value, summary })), true, 1000)}
                    {editing && <details className="cms-context-article-options"><summary>Article settings</summary><fieldset disabled={locked}><CmsField label="Topic"><select value={current.category} onChange={(event) => editArticle(current.id, (value) => ({ ...value, category: event.target.value }))}>{workspace.manifest.categories.filter((value) => !value.archived || value.id === current.category).map((value) => <option key={value.id} value={value.id}>{value.title}{value.archived ? ' (archived)' : ''}</option>)}</select></CmsField><p className="cms-muted">{current.visibility === 'public' ? 'Public article' : 'Account access required'} · /help-centre/{current.slug}</p><div className="cms-media-actions">{current.status === 'retired' ? <CmsButton onClick={() => articleStatus('draft')}>Restore to draft</CmsButton> : <><CmsButton onClick={() => articleStatus(current.status === 'approved' ? 'draft' : 'approved')}>{current.status === 'approved' ? 'Keep edits private' : 'Include edits in publication'}</CmsButton><CmsButton danger onClick={() => articleStatus('retired')}>Archive article</CmsButton></>}{!current.review?.date && <CmsButton danger onClick={removeArticle}>Remove draft</CmsButton>}</div></fieldset></details>}
                </header>
                <CmsSortableList items={current.sections} label="Article sections" getLabel={(_, index) => `section ${index + 1}`} enabled={editing} {...sortProps('sections')} itemAs="section" itemClassName="cms-context-section" itemProps={(section) => ({ id: section.id, 'aria-label': section.title })} onPlace={(active, target) => editArticle(current.id, (value) => ({ ...value, sections: placeCmsItem(value.sections, active, target) }))}>
                    {(section, sectionIndex, sectionHandle) => {
                        const separateAnswers = cmsHasSeparateAnswers(section);
                        return <>
                            {editing && <div className="cms-context-row-toolbar">{sectionHandle}<span className="cms-context-row-label">Section {sectionIndex + 1}</span><CmsRowMenu label={`Section ${sectionIndex + 1} options`} disabled={locked}><CmsButton danger disabled={current.sections.length === 1 || section.facts.length > 0} onClick={() => editArticle(current.id, (value) => ({ ...value, sections: value.sections.filter((s) => s.id !== section.id) }))}>Remove section</CmsButton></CmsRowMenu></div>}
                            {field(`${current.id}:${section.id}:title`, `Section ${sectionIndex + 1} title`, section.title, <h2>{section.title}</h2>, (title) => sectionChange(section.id, (s) => ({ ...s, title })), false, 240)}
                            {section.paragraphs.map((value, index) => <div key={`paragraph-${index}`}>{editing && !separateAnswers && <div className="cms-context-row-toolbar"><span className="cms-context-row-label">Paragraph {index + 1}</span><CmsRowMenu label={`Paragraph ${index + 1} options`} disabled={locked}><CmsButton danger onClick={() => sectionChange(section.id, (s) => ({ ...s, paragraphs: s.paragraphs.filter((_, i) => i !== index) }))}>Remove paragraph {index + 1}</CmsButton></CmsRowMenu></div>}{listField(section, 'paragraphs', index, value)}</div>)}
                            {editing && !separateAnswers && <CmsButton className="cms-context-small" disabled={locked || section.paragraphs.length >= 60} onClick={() => sectionChange(section.id, (s) => ({ ...s, paragraphs: [...s.paragraphs, ''] }))}>Add paragraph</CmsButton>}
                            {attachments(section, null)}
                            {section.steps.length > 0 && <CmsSortableList as="ol" itemAs="li" className={`cms-context-steps ${editing ? 'is-editing' : ''}`} itemClassName="cms-context-step" items={section.stepIds.map((id, index) => ({ id, text: section.steps[index] }))} label={`Instructions in section ${sectionIndex + 1}`} getLabel={(_, index) => `instruction ${index + 1} in section ${sectionIndex + 1}`} enabled={editing} {...sortProps(`steps:${section.id}`)} itemProps={(item) => ({ 'data-step-id': item.id })} onPlace={(active, target) => sectionChange(section.id, (s) => placeCmsStep(s, active, target))}>
                                {(item, index, handle) => <>
                                    {editing && <div className="cms-context-row-toolbar">{handle}<span className="cms-context-row-label">Instruction {index + 1}</span><CmsRowMenu label={`Instruction ${index + 1} options`} disabled={locked}><CmsButton danger onClick={() => removeStep(section.id, item.id)}>Remove instruction {index + 1}</CmsButton></CmsRowMenu></div>}
                                    {listField(section, 'steps', index, item.text)}{attachments(section, item.id)}
                                </>}
                            </CmsSortableList>}
                            {editing && <CmsButton className="cms-context-small" disabled={locked || section.steps.length >= CMS_LIMITS.steps} onClick={() => sectionChange(section.id, cmsAddStep)}>Add instruction</CmsButton>}
                            {section.notes.length > 0 && <div className="cms-context-notes">{section.notes.map((value, index) => <div key={`note-${index}`}>{editing && <div className="cms-context-row-toolbar"><span className="cms-context-row-label">Note {index + 1}</span><CmsRowMenu label={`Note ${index + 1} options`} disabled={locked}><CmsButton danger onClick={() => sectionChange(section.id, (s) => ({ ...s, notes: s.notes.filter((_, i) => i !== index) }))}>Remove note {index + 1}</CmsButton></CmsRowMenu></div>}{listField(section, 'notes', index, value)}</div>)}</div>}
                            {editing && <div className="cms-context-section-tools"><CmsButton className="cms-context-small" disabled={locked || section.notes.length >= 60} onClick={() => sectionChange(section.id, (s) => ({ ...s, notes: [...s.notes, ''] }))}>Add note</CmsButton></div>}
                        </>;
                    }}
                </CmsSortableList>
                {editing && <CmsButton disabled={locked || current.sections.length >= CMS_LIMITS.sections} onClick={() => editArticle(current.id, (value) => ({ ...value, sections: [...value.sections, cmsNewSection(value)] }))}>Add section</CmsButton>}
            </article>}
        </> : slug ? <section className="cms-context-empty"><h1>This article is unavailable in your draft</h1><p>It may have been removed or belong to a previous saved version.</p><CmsButton onClick={() => openTopic('')}>Browse Help Centre</CmsButton></section> : topic ? <section>
            <header className="cms-context-heading"><div>{field(`topic:${topic.id}`, 'Topic title', topic.title, <h1>{topic.title}</h1>, (title) => editTopic(topic.id, title), false, 160)}<p className="cms-muted">{topic.archived ? 'Archived topic' : 'Choose an article for clear instructions.'}</p></div><CmsButton disabled={locked} onClick={() => setEditing((value) => !value)}>{editing ? 'Done editing topic' : 'Edit topic'}</CmsButton></header>
            {editing && <div className="cms-media-actions"><CmsButton disabled={locked || topic.archived} onClick={() => addArticle(topic.id)}>Add article</CmsButton><CmsButton disabled={locked} onClick={() => topicAction(topic.id, topic.archived ? 'restore' : 'archive')}>{topic.archived ? 'Restore topic' : 'Archive topic'}</CmsButton><CmsButton danger disabled={locked} onClick={() => topicAction(topic.id, 'remove')}>Remove topic</CmsButton></div>}
            <CmsSortableList as="ul" itemAs="li" className="cms-context-article-list" itemClassName="cms-context-article-row" items={ordered.filter((value) => value.category === topic.id && (editing || showArchived || value.status !== 'retired'))} label="Topic articles" getLabel={(value) => `article ${value.title}`} enabled={editing} {...sortProps('articles')} onPlace={articlePlace}>{(value, index, handle) => <ArticleRow article={value} excluded={topic.archived} handle={handle} disabled={locked} onOpen={() => openArticle(value)} />}</CmsSortableList>
        </section> : <section>
            <div className="cms-context-home-intro"><p className="cms-context-label">Help with CareAround</p><h1>How can we help?</h1><p>Find clear instructions for the things you want to do.</p><CmsField label="Search your Help draft" type="search" value={query} maxLength={120} disabled={locked} onChange={onQuery} placeholder="Search topics and articles…" /></div>
            {query.trim() ? <ul className="cms-context-article-list">{ordered.filter((value) => value.status !== 'retired' && `${value.title} ${value.summary}`.toLowerCase().includes(query.trim().toLowerCase())).map((value) => <li key={value.id} className="cms-context-article-row"><ArticleRow article={value} disabled={locked} onOpen={() => openArticle(value)} /></li>)}</ul> : <><header className="cms-context-heading"><h2>Browse by topic</h2><CmsButton disabled={locked} onClick={() => setOrganise((value) => !value)}>{organise ? 'Done organising' : 'Manage topics'}</CmsButton></header>{organise && <CmsButton disabled={locked} onClick={addTopic}>Add topic</CmsButton>}{organise && <p className="cms-sort-hint">Hold a handle to move a topic, or select it for order options. Changes stay in your draft.</p>}<CmsSortableList as="ol" itemAs="li" className="cms-context-topic-list" itemClassName="cms-context-topic-card" items={workspace.manifest.categories.filter((value) => organise || !value.archived)} label="Help topics" getLabel={(value) => `topic ${value.title}`} enabled={organise} {...sortProps('topics')} onPlace={topicPlace}>{(value, index, handle) => <>{handle}<button className="cms-context-topic-open" disabled={locked} onClick={() => openTopic(value.id)}><span className="cms-context-position" aria-hidden="true">{index + 1}</span><span><strong>{value.title}{value.archived && <span className="cms-status">Archived topic</span>}</strong><small>{ordered.filter((a) => a.category === value.id && a.status !== 'retired').length} articles</small></span><span aria-hidden="true">→</span></button></>}</CmsSortableList></>}
        </section>}
        <footer className="cms-context-ownerbar"><div><strong>{editing ? preview ? 'Previewing your draft' : 'Editing in place' : 'Owner draft'}</strong><span>{dirty ? 'Unsaved changes' : etag === null ? 'No saved draft yet' : 'Draft saved'} · Saves the whole library</span>{block && <span>Finish or cancel your text edit before saving.</span>}{sortingScope && <span>Drop the item or cancel before saving.</span>}</div><div className="cms-actions">{editing && showArticle && <CmsButton disabled={locked} onClick={() => { openTab('editor'); setPreview((value) => !value); }}>{preview ? 'Continue editing' : 'Preview draft'}</CmsButton>}{editing && <CmsButton disabled={locked} onClick={() => { openTab('editor'); setEditing(false); setPreview(false); }}>Exit editing</CmsButton>}<CmsButton primary disabled={!canSave || Boolean(block || sortingScope)} onClick={save}>Save draft</CmsButton></div></footer>
        {dialog}
    </main>;
}
