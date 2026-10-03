import { safeCmsVideoUrl } from '../../../../shared/helpContentCms.js';
import { getSessionApiBaseCandidates } from '../../lib/apiBase.js';

export default function HelpMedia({ items = [], mediaUrls = {} }) {
    const apiBase = getSessionApiBaseCandidates()[0];
    return items.map(item => <figure key={item.id} className="my-5 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
        {item.type === 'image' && /^[a-f0-9]{64}$/.test(item.assetId || '') && <img src={mediaUrls[item.assetId] || `${apiBase}/help/media/${item.assetId}`} alt={item.alt || ''} loading="lazy" decoding="async" className="h-auto max-h-[34rem] w-full object-contain" />}
        {item.type === 'video' && safeCmsVideoUrl(item.url) && <a href={safeCmsVideoUrl(item.url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center font-semibold text-brand-700 underline underline-offset-4">Watch this video on {new URL(item.url).hostname.includes('vimeo') ? 'Vimeo' : 'YouTube'} <span className="sr-only">(opens another website)</span></a>}
        <figcaption className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{item.caption}</figcaption>
        {item.type === 'video' && item.transcriptReviewed && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-brand-700">Read the video instructions</summary><p className="mt-2 whitespace-pre-line break-words text-slate-700">{item.transcript}</p></details>}
    </figure>);
}
