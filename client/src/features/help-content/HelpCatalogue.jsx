import { CmsButton, CmsField, CmsOrderButtons } from './CmsControls.jsx';

export default function HelpCatalogue({ workspace, selectedId, onSelect, query, onQuery, showArchived, onShowArchived, onAddTopic, onTopicAction, onAddArticle, onArticleMove }) {
    const categories = workspace.manifest.categories;
    const order = new Map(workspace.manifest.articleOrder.map((id, index) => [id, index]));
    const articles = [...workspace.articles].sort((a, b) => order.get(a.id) - order.get(b.id));
    const matches = (article) => `${article.title} ${article.summary}`.toLowerCase().includes(query.trim().toLowerCase()) && (showArchived || article.status !== 'retired');
    return <nav className="cms-catalogue" aria-label="Help content catalogue">
        <div className="cms-topic-head"><h2>Topics</h2><CmsButton onClick={onAddTopic}>Add topic</CmsButton></div>
        <CmsField label="Find an article" type="search" value={query} onChange={onQuery} maxLength={120} />
        <label className="cms-muted" style={{ display: 'flex', gap: 7, alignItems: 'center' }}><input type="checkbox" checked={showArchived} onChange={(event) => onShowArchived(event.target.checked)} />Show archived</label>
        {categories.filter((category) => showArchived || !category.archived).map((category) => {
            const topicArticles = articles.filter((article) => article.category === category.id && matches(article));
            const index = categories.findIndex((value) => value.id === category.id);
            return <section className="cms-topic" key={category.id} aria-label={category.title}>
                <div className="cms-topic-head"><strong>{category.title}{category.archived && <span className="cms-status">Archived topic</span>}</strong><CmsOrderButtons label={`topic ${category.title}`} first={index === 0} last={index === categories.length - 1} onMove={(direction) => onTopicAction(category.id, 'move', direction)} /></div>
                <div className="cms-media-actions"><CmsButton onClick={() => onTopicAction(category.id, 'rename')}>Rename</CmsButton><CmsButton onClick={() => onTopicAction(category.id, category.archived ? 'restore' : 'archive')}>{category.archived ? 'Restore' : 'Archive'}</CmsButton><CmsButton danger onClick={() => onTopicAction(category.id, 'remove')}>Remove</CmsButton></div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{topicArticles.map((article) => <li key={article.id}>
                    <button type="button" className="cms-article-choice" aria-current={selectedId === article.id} onClick={() => onSelect(article.id)}>{article.title}<span className="cms-status">{article.status === 'approved' ? 'Included in next publication' : article.status === 'retired' ? 'Archived' : article.review?.date ? 'Private draft edits' : 'Draft'}</span></button>
                    {selectedId === article.id && <CmsOrderButtons label={`article ${article.title}`} first={articles.filter((value) => value.category === category.id)[0]?.id === article.id} last={articles.filter((value) => value.category === category.id).at(-1)?.id === article.id} onMove={(direction) => onArticleMove(article.id, direction)} />}
                </li>)}</ul>
                {!topicArticles.length && <p className="cms-muted" style={{ marginTop: 8 }}>{query ? 'No matching articles in this topic.' : 'No articles in this view.'}</p>}
                {!category.archived && <CmsButton style={{ marginTop: 10 }} onClick={() => onAddArticle(category.id)}>Add article</CmsButton>}
            </section>;
        })}
    </nav>;
}
