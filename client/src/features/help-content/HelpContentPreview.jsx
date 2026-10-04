import { useEffect, useRef, useState } from 'react';
import HelpArticle from '../help/HelpArticle.jsx';
import { cmsReadingArticle } from '../../../../shared/helpContentCms.js';
import { cmsGuideMessages } from './helpContentDraftModel.js';
import { CmsButton } from './CmsControls.jsx';

export function useCmsMediaUrls(article, api, onDenied) {
    const denied = useRef(onDenied);
    denied.current = onDenied;
    const assetIds = [...new Set((article?.sections || []).flatMap((section) => section.media || []).filter((item) => item.type === 'image').map((item) => item.assetId))].sort();
    const key = assetIds.join('|');
    const [state, setState] = useState({ key, urls: {}, errors: [] });
    useEffect(() => {
        const controller = new AbortController(), urls = {};
        setState({ key, urls: {}, errors: [] });
        Promise.allSettled(assetIds.map(async (id) => {
            let blob;
            try { blob = await api.media(id, controller.signal); }
            catch (cause) { if (!controller.signal.aborted && [401, 403].includes(cause.status)) denied.current?.(cause); throw cause; }
            if (controller.signal.aborted) return;
            urls[id] = URL.createObjectURL(blob);
        })).then((results) => {
            if (!controller.signal.aborted) setState({ key, urls: { ...urls }, errors: results.filter((result) => result.status === 'rejected').map(() => 'An image could not be previewed. Save your draft and try again later.') });
        });
        return () => { controller.abort(); Object.values(urls).forEach((url) => URL.revokeObjectURL(url)); };
    }, [api, key]);
    return state.key === key ? state : { urls: {}, errors: [] };
}
export default function HelpContentPreview({ article, mediaUrls = {}, errors = [] }) {
    const [mode, setMode] = useState('article'), [width, setWidth] = useState('desktop');
    const reading = cmsReadingArticle(article);
    // Draft previews never inherit the published reviewed stamp.
    delete reading.reviewedAt;
    // Unpublished images wait for authorised bytes instead of trying public URLs.
    for (const section of reading.sections) section.media = (section.media || []).filter((item) => item.type !== 'image' || mediaUrls[item.assetId]);
    return <section className="cms-preview" aria-label="Draft preview">
        <div className="cms-toolbar"><div><h2>Preview</h2><p className="cms-muted">Unpublished draft</p></div>
            <div className="cms-order"><CmsButton aria-pressed={mode === 'article'} onClick={() => setMode('article')}>Article</CmsButton><CmsButton aria-pressed={mode === 'guide'} onClick={() => setMode('guide')}>Guide text</CmsButton></div>
            <div className="cms-order"><CmsButton aria-pressed={width === 'desktop'} onClick={() => setWidth('desktop')}>Desktop</CmsButton><CmsButton aria-pressed={width === 'phone'} onClick={() => setWidth('phone')}>Phone</CmsButton></div>
        </div>
        <div className="cms-scroll" tabIndex={0} role="region" aria-label="Scrollable draft preview">
            {errors.map((error, index) => <p role="status" className="cms-banner error" key={index}>{error}</p>)}
            <div className={`cms-preview-surface ${width === 'phone' ? 'phone' : ''}`}>
                {mode === 'article' ? <HelpArticle article={reading} mediaUrls={mediaUrls} /> : <GuideDraftContent article={article} />}
            </div>
        </div>
    </section>;
}

export function GuideDraftContent({ article }) {
    return <><h2>{article.title || 'Untitled article'}</h2><p className="cms-muted" style={{ margin: '12px 0' }}>These are the written answers supplied to Guide after review and publication.</p>
        {article.sections.map((section) => <section key={section.id} style={{ marginTop: 24 }}><h3>{section.title}</h3>
            {cmsGuideMessages(section).map((message, index) => <div key={index} style={{ marginTop: 14 }}>{cmsGuideMessages(section).length > 1 && <h4 style={{ fontWeight: 600, fontSize: 13 }}>{message.title}</h4>}<div className="cms-guide-text" style={{ marginTop: 8 }}>{message.text}</div></div>)}
            {(section.media || []).some((item) => item.type === 'video' && !item.transcriptReviewed) && <p className="cms-muted">An unchecked video transcript is excluded.</p>}
        </section>)}
    </>;
}
