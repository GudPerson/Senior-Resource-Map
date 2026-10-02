import { ArrowLeft, ArrowUpRight, BookOpen, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatHelpReviewedDate, helpArticleRoute, helpAudienceLabel } from './helpLibrary.js';

export default function HelpArticle({ article, relatedArticles = [], backRoute = '/help-centre', onOpenGuide }) {
    const reviewed = formatHelpReviewedDate(article.reviewedAt);
    const audiences = [...new Set((article.audiences || []).map(helpAudienceLabel))];
    return <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
        <article className="min-w-0">
            <Link to={backRoute} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800"><ArrowLeft size={16} aria-hidden="true" />All help articles</Link>
            <header className="border-b border-slate-200 pb-7 pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">CareAround Help Centre</p>
                <h1 id="help-article-title" className="mt-3 break-words text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl" tabIndex={-1}>{article.title}</h1>
                <p className="mt-4 text-base leading-relaxed text-slate-600">{article.summary}</p>
                {(audiences.length > 0 || reviewed) && <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs leading-relaxed text-slate-500">
                    {audiences.length > 0 && <p>For: {audiences.join(', ')}</p>}
                    {reviewed && <p>Reviewed <time dateTime={article.reviewedAt.slice(0, 10)}>{reviewed}</time></p>}
                </div>}
            </header>
            <nav aria-label="In this article" className="mt-6 rounded-xl bg-slate-50 px-5 py-4 lg:hidden">
                <p className="text-sm font-semibold text-slate-800">In this article</p>
                <ul className="mt-2 space-y-1">{article.sections.map((section) => <li key={section.id}><Link className="inline-flex min-h-[36px] items-center text-sm text-brand-700 underline underline-offset-4" to={helpArticleRoute(article.slug, section.id)}>{section.title}</Link></li>)}</ul>
            </nav>
            <div className="divide-y divide-slate-100">{article.sections.map((section) => <section key={section.id} id={section.id} tabIndex={-1} className="scroll-mt-28 py-7 outline-none" aria-labelledby={`help-section-${section.id}`}>
                <h2 id={`help-section-${section.id}`} className="text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{section.title}</h2>
                <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-700">
                    {section.paragraphs?.map((paragraph, index) => <p className="whitespace-pre-line break-words" key={index}>{paragraph}</p>)}
                    {section.steps?.length > 0 && <ol className="list-decimal space-y-4 pl-6 marker:font-semibold marker:text-brand-700">{section.steps.map((step, index) => <li className="break-words pl-2" key={index}>{step}</li>)}</ol>}
                    {section.notes?.length > 0 && <div className="space-y-3 border-l-2 border-brand-300 bg-brand-50/50 px-4 py-3">{section.notes.map((note, index) => <p className="break-words" key={index}>{note}</p>)}</div>}
                </div>
            </section>)}</div>
            {relatedArticles.length > 0 && <section className="border-t border-slate-200 pt-7" aria-labelledby="related-help-title"><h2 id="related-help-title" className="text-lg font-bold text-slate-900">Related articles</h2>
                <ul className="mt-3 divide-y divide-slate-100">{relatedArticles.map((related) => <li key={related.id}><Link className="group flex min-h-[56px] items-center gap-3 py-3 text-sm font-semibold text-brand-700 hover:text-brand-800" to={helpArticleRoute(related.slug)} state={{ helpBackRoute: backRoute }}><BookOpen className="shrink-0" size={17} aria-hidden="true" /><span className="min-w-0 flex-1 break-words">{related.title}</span><ArrowUpRight className="shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" size={17} aria-hidden="true" /></Link></li>)}</ul>
            </section>}
            <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-6"><p className="text-sm text-slate-600">Need help with your next step?</p>
                {onOpenGuide ? <button type="button" onClick={onOpenGuide} className="btn-ghost inline-flex items-center gap-2 text-sm"><Sparkles size={16} aria-hidden="true" />Ask CareAround Guide</button> : <Link to="/help-centre" className="text-sm font-semibold text-brand-700 underline underline-offset-4">Browse more articles</Link>}
            </footer>
        </article>
        <aside className="hidden lg:block"><nav className="sticky top-28 border-l border-slate-200 pl-5" aria-label="In this article"><p className="text-sm font-bold text-slate-800">In this article</p>
            <ul className="mt-3 space-y-2">{article.sections.map((section) => <li key={section.id}><Link className="inline-flex min-h-[36px] items-center text-sm leading-relaxed text-slate-600 hover:text-brand-700 hover:underline hover:underline-offset-4" to={helpArticleRoute(article.slug, section.id)}>{section.title}</Link></li>)}</ul>
            <Link to={backRoute} className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold text-brand-700"><ArrowLeft size={14} aria-hidden="true" />Browse Help Centre</Link>
        </nav></aside>
    </div>;
}
