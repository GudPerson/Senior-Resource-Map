import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function MapSpatialDialog({ title, closeLabel = 'Close', onClose, children, wide = false, ...attributes }) {
    const dialog = useRef(null);
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const previous = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.current?.querySelector('button')?.focus();
        const keydown = event => {
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopPropagation(); close.current?.(); return;
            }
            if (event.key !== 'Tab') return;
            const elements = [...(dialog.current?.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]') || [])]
                .filter(element => element.getClientRects().length > 0);
            if (!elements.length) { event.preventDefault(); dialog.current?.focus(); return; }
            const first = elements[0], last = elements[elements.length - 1];
            if (!dialog.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
            else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', keydown, true);
        return () => {
            document.removeEventListener('keydown', keydown, true);
            if (document.body.style.overflow === 'hidden') document.body.style.overflow = previousOverflow;
            if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
        };
    }, []);
    return <div className="fixed inset-0 z-[1450] flex items-end bg-slate-950/45 sm:items-center sm:justify-center sm:p-4"
        onPointerDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
        <section ref={dialog} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} {...attributes}
            className={`flex max-h-[92dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}
            onPointerDown={event => event.stopPropagation()}>
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                <h2 className="text-base font-black text-slate-900">{title}</h2>
                <button type="button" onClick={onClose} aria-label={closeLabel} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"><X size={20} /></button>
            </header>
            {children}
        </section>
    </div>;
}
