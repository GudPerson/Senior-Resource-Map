import { useState } from 'react';
import { CmsButton, CmsField } from './CmsControls.jsx';
import CmsSortableList from './CmsSortableList.jsx';
import CmsRowMenu from './CmsRowMenu.jsx';

export default function HelpCatalogue({ workspace, selectedId, onSelect, query, onQuery, showArchived, onShowArchived, onAddTopic, onTopicAction, onAddArticle, onTopicPlace, onArticlePlace, baseDisabled = false, sortingScope, onSortingScope }) {
    const [localScope, setLocalScope] = useState('');
    const scope = sortingScope ?? localScope, setScope = onSortingScope || setLocalScope;
    const locked = baseDisabled || Boolean(scope);
    const categories = workspace.manifest.categories.filter((value) => showArchived || !value.archived);
    const order = new Map(workspace.manifest.articleOrder.map((id, index) => [id, index]));
    const articles = [...workspace.articles].sort((a, b) => order.get(a.id) - order.get(b.id));
    const matches = (article) => `${article.title} ${article.summary}`.toLowerCase().includes(query.trim().toLowerCase()) && (showArchived || article.status !== 'retired');
    const sorting = (id) => ({ disabled: baseDisabled || Boolean(scope && scope !== id), onActiveChange: (active) => setScope(active ? id : '') });
    return <nav className="cms-catalogue" aria-label="Help content catalogue">
        <div className="cms-topic-head"><h2>Topics</h2><CmsButton disabled={locked} onClick={onAddTopic}>Add topic</CmsButton></div>
        <CmsField label="Find an article" type="search" value={query} onChange={onQuery} maxLength={120} disabled={locked} />
        <label className="cms-muted" style={{ display: 'flex', gap: 7, alignItems: 'center' }}><input type="checkbox" disabled={locked} checked={showArchived} onChange={(event) => onShowArchived(event.target.checked)} />Show archived</label>
        <p className="cms-sort-hint">Hold a handle to move, or select it for order options. Only items in this view move.</p>
        <CmsSortableList items={categories} label="Catalogue topics" getLabel={(value) => `topic ${value.title}`} onPlace={onTopicPlace} {...sorting('catalogue-topics')} itemAs="section" itemClassName="cms-topic" itemProps={(value) => ({ 'aria-label': value.title })}>
            {(category, index, topicHandle) => {
                const topicArticles = articles.filter((article) => article.category === category.id && matches(article));
                return <>
                    <div className="cms-topic-head">{topicHandle}<strong>{category.title}{category.archived && <span className="cms-status">Archived topic</span>}</strong><CmsRowMenu label={`Topic ${category.title} options`} disabled={locked}><CmsButton onClick={() => onTopicAction(category.id, 'rename')}>Rename</CmsButton><CmsButton onClick={() => onTopicAction(category.id, category.archived ? 'restore' : 'archive')}>{category.archived ? 'Restore' : 'Archive'}</CmsButton><CmsButton danger onClick={() => onTopicAction(category.id, 'remove')}>Remove</CmsButton></CmsRowMenu></div>
                    <CmsSortableList items={topicArticles} label={`Articles in ${category.title}`} getLabel={(value) => `article ${value.title}`} as="ul" itemAs="li" className="cms-catalogue-articles" {...sorting(`catalogue-articles:${category.id}`)} onPlace={onArticlePlace}>
                        {(article, position, articleHandle) => <>{articleHandle}<button type="button" disabled={locked} className="cms-article-choice" aria-current={selectedId === article.id} onClick={() => onSelect(article.id)}>{article.title}<span className="cms-status">{article.status === 'approved' ? 'Included in next publication' : article.status === 'retired' ? 'Archived' : article.review?.date ? 'Private draft edits' : 'Draft'}</span></button></>}
                    </CmsSortableList>
                    {!topicArticles.length && <p className="cms-muted" style={{ marginTop: 8 }}>{query ? 'No matching articles in this topic.' : 'No articles in this view.'}</p>}
                    {!category.archived && <CmsButton disabled={locked} style={{ marginTop: 10 }} onClick={() => onAddArticle(category.id)}>Add article</CmsButton>}
                </>;
            }}
        </CmsSortableList>
    </nav>;
}
