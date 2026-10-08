import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ANNOTATION_RESOURCE_LINK_LIMIT, annotationResourceKey, buildAnnotationResourceCatalog,
    ANNOTATION_RESOURCE_DEFAULT_GLOW_COLOR, getAnnotationResourceGlowColor,
    normalizeAnnotationResourceBehaviour, normalizeAnnotationResourceLinks } from '../lib/annotationResourceLinks.js';
import './AnnotationResourceLinks.css';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getAnnotationMessages } from '../lib/annotationMessages.js';

export default function AnnotationResourcePicker({ directory, annotation, onChange, disabled = false, maxLinks = ANNOTATION_RESOURCE_LINK_LIMIT }) {
    const { locale, t } = useLocale();
    const messages = getAnnotationMessages(locale);
    const id = useId(), button = useRef(null);
    const resetPending = useRef(false);
    const [open, setOpen] = useState(false), [query, setQuery] = useState('');
    const catalog = useMemo(() => buildAnnotationResourceCatalog(directory), [directory]);
    const allowed = new Set(catalog.map((item) => item.key));
    const links = normalizeAnnotationResourceLinks(annotation?.resourceLinks).filter((link) => allowed.has(annotationResourceKey(link)));
    const selected = new Set(links.map(annotationResourceKey));
    const selectionLimit = Number.isSafeInteger(maxLinks) ? Math.max(0, Math.min(ANNOTATION_RESOURCE_LINK_LIMIT, maxLinks)) : ANNOTATION_RESOURCE_LINK_LIMIT;
    const behaviour = normalizeAnnotationResourceBehaviour(annotation?.resourceBehaviour);
    const glowColour = getAnnotationResourceGlowColor(annotation);
    const [glowBuffer, setGlowBuffer] = useState(glowColour);
    useEffect(() => setGlowBuffer(glowColour), [annotation?.id, glowColour]);
    const matching = catalog.filter((item) => `${item.name} ${item.kind}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    function update(nextLinks, nextBehaviour = behaviour) {
        const normalized = normalizeAnnotationResourceLinks(nextLinks);
        onChange?.(normalized.length ? { resourceLinks: normalized, resourceBehaviour: nextBehaviour }
            : { resourceLinks: undefined, resourceBehaviour: undefined, resourceGlowColor: undefined });
    }
    function toggle(item) {
        if (!selected.has(item.key) && selected.size >= selectionLimit) return;
        update(selected.has(item.key) ? links.filter((link) => annotationResourceKey(link) !== item.key) : [...links, item.link]);
    }
    if (!annotation) return null;
    return <div className="annotation-resource-picker" onKeyDown={(event) => {
        if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); button.current?.focus(); }
    }}>
        <button ref={button} type="button" className="btn-ghost text-xs" disabled={disabled} aria-expanded={open}
            aria-controls={`${id}-resources`} onClick={() => setOpen((value) => !value)}>
            {messages.tagResources}{links.length ? ` (${links.length})` : ''}
        </button>
        {open ? <div id={`${id}-resources`} className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-600">{messages.resourceScope}</p>
            {catalog.length > 12 ? <div><label className="text-xs font-semibold" htmlFor={`${id}-search`}>{messages.searchResources}</label>
                <input id={`${id}-search`} className="input-field mt-1 w-full" type="search" value={query} maxLength={80}
                    onChange={(event) => setQuery(event.target.value)} disabled={disabled} /></div> : null}
            <fieldset disabled={disabled} className="max-h-56 space-y-1 overflow-y-auto">
                <legend className="sr-only">{messages.tagResources}</legend>
                {matching.map((item) => <label key={item.key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg p-2 text-xs hover:bg-slate-50">
                    <input type="checkbox" checked={selected.has(item.key)} disabled={!selected.has(item.key) && selected.size >= selectionLimit}
                        onChange={() => toggle(item)} />
                    <span><span className="font-semibold">{item.name}</span><span className="block text-slate-500">{t(item.link.type === 'personal_place' ? 'personalPlace' : item.link.type === 'hard' ? 'placeType' : 'offeringType')}</span></span>
                </label>)}
                {!matching.length ? <p className="text-xs text-slate-500">{catalog.length ? messages.noMatchingResources : messages.noResources}</p> : null}
            </fieldset>
            {selected.size >= selectionLimit ? <p role="status" className="text-xs text-slate-600">{messages.resourceLimitReached}</p> : null}
            {links.length ? <div><label htmlFor={`${id}-behaviour`} className="text-xs font-semibold">{messages.behaviour}</label>
                <select id={`${id}-behaviour`} value={behaviour} className="input-field mt-1 w-full" disabled={disabled}
                    onChange={(event) => update(links, event.target.value)}>
                    <option value="appear">{messages.appear}</option><option value="pulse">{messages.pulse}</option><option value="highlight">{messages.highlight}</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">{messages[`${behaviour}Help`]}</p>
                <p className="mt-1 text-xs text-slate-500">{messages.interactionHelp}</p>
                {behaviour !== 'appear' ? <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="flex min-h-11 items-center gap-2 text-xs font-semibold">
                        {messages.glowColour}
                        <input type="color" value={glowBuffer} aria-label={messages.glowColour}
                            disabled={disabled} className="h-9 w-11 cursor-pointer rounded border border-slate-200 bg-white p-1"
                            onFocus={() => { resetPending.current = false; }}
                            onChange={(event) => setGlowBuffer(event.target.value)}
                            onBlur={(event) => {
                                if (resetPending.current) return;
                                const color = event.currentTarget.value.toLowerCase();
                                if (color !== glowColour) onChange?.({ resourceGlowColor: color });
                            }} />
                    </label>
                    <button type="button" disabled={disabled || (!annotation.resourceGlowColor && glowBuffer === ANNOTATION_RESOURCE_DEFAULT_GLOW_COLOR)}
                        className="btn-ghost min-h-11 text-xs"
                        onPointerDown={() => { resetPending.current = true; }}
                        onPointerCancel={() => { resetPending.current = false; }}
                        onBlur={() => { resetPending.current = false; }}
                        onClick={() => {
                            resetPending.current = false;
                            setGlowBuffer(ANNOTATION_RESOURCE_DEFAULT_GLOW_COLOR);
                            onChange?.({ resourceGlowColor: undefined });
                        }}>{messages.usePinOrange}</button>
                </div> : null}
            </div> : null}
        </div> : null}
    </div>;
}
