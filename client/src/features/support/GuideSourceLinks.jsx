import { Link } from 'react-router-dom';
import { safeHelpArticleRoute } from '../help/helpLibrary.js';

export default function GuideSourceLinks({ sources = [] }) {
    if (!Array.isArray(sources) || !sources.length) return null;
    return <div className="mt-2 text-xs leading-relaxed text-slate-600"><span className="font-semibold">Related reviewed guidance:</span>{' '}
        {sources.map((source, index) => {
            const articleRoute = safeHelpArticleRoute(source.articleRoute);
            return <span key={`${source.id || source.articleId || 'source'}:${index}`}>{index ? ', ' : ''}{articleRoute ? <Link className="underline underline-offset-2" to={articleRoute}>{source.title}</Link> : source.title}</span>;
        })}
    </div>;
}
