import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { api } from '../../lib/api.js';
import { createBoundaryLibrarySaveOperation, readBoundaryLibrarySource } from '../../lib/boundaryLibraryPickerModel.js';

import { canonicalizeBoundaryDrawing } from '../../../../shared/boundaryDrawing.js';
import { FrozenPreview } from './BoundaryLibraryPicker.jsx';

/** The caller retains session across closes so an unknown ACK keeps its exact request identity. */
export default function BoundaryLibrarySaveDialog({ mapId, annotation, savedRevision, session,
    flushPendingChanges, isCurrent, onCancel, onSaveAsNew }) {
    const [reviewedDrawing] = useState(() => {
        try { return session.reviewedDrawing || canonicalizeBoundaryDrawing(annotation); } catch { return null; }
    });
    const [checked, setChecked] = useState(Boolean(session.operation));
    const [name, setName] = useState(session.metadata?.name ?? reviewedDrawing?.name ?? reviewedDrawing?.text ?? '');
    const [groupName, setGroupName] = useState(session.metadata?.groupName ?? '');
    const [busy, setBusy] = useState(false), [error, setError] = useState(session.operation?.reviewError?.message || (reviewedDrawing ? '' : 'Select a supported, complete area drawing.'));
    const [result, setResult] = useState(session.result || null);
    const submitting = useRef(false);
    async function save() {
        if (!reviewedDrawing || !checked || !name.trim() || submitting.current || !isCurrent()) return;
        submitting.current = true;setBusy(true);setError('');
        try {
            if (!session.operation) {
                session.reviewedDrawing = reviewedDrawing;
                session.metadata = { name, groupName };
                session.operation = createBoundaryLibrarySaveOperation({ requestId: session.requestId, metadata: session.metadata,
                    source: { mapId: Number(mapId), annotationId: annotation.id }, selectedDrawing: reviewedDrawing, flushPendingChanges,
                    readSavedDocument: () => api.getMyMapPrintAnnotations(mapId), create: api.createBoundaryLibrary, isCurrent });
            }
            const accepted = await session.operation.save();
            if (isCurrent()) { session.result = accepted;setResult(accepted); }
        } catch (failure) { if (isCurrent()) setError(failure.message || 'Save could not be confirmed. Retry this save.'); }
        finally { submitting.current = false;if (isCurrent()) setBusy(false); }
    }
    async function reviewCurrentSource() {
        if (submitting.current || !session.operation?.canReviewAgain || !isCurrent()) return;
        submitting.current = true;setBusy(true);setError('');
        let reviewed = null;
        try {
            reviewed = await readBoundaryLibrarySource({ source: { mapId: Number(mapId), annotationId: annotation.id },
                readSavedDocument: () => api.getMyMapPrintAnnotations(mapId), isCurrent });
        } catch (failure) { if (isCurrent()) setError(failure.message || 'The saved boundary could not be reviewed.'); }
        finally { submitting.current = false;if (isCurrent()) setBusy(false); }
        if (reviewed && isCurrent()) onSaveAsNew(reviewed.drawing);
    }
    const locked = busy || Boolean(session.operation);
    const button = 'min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40';
    return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onCancel?.(); }}><Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[1999] bg-slate-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[2101] max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onPointerDown={event => event.stopPropagation()} onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
            <Dialog.Title className="text-lg font-bold">Save a library boundary</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-600">Save a private snapshot for reuse. Each save creates an independent library entry.</Dialog.Description>
            {reviewedDrawing ? <div className="my-4"><FrozenPreview item={{ drawing: reviewedDrawing,
                name: reviewedDrawing.name || reviewedDrawing.text || 'Saved boundary', groupName: null,
                sourceGroupName: reviewedDrawing.groupName || null, pointCount: reviewedDrawing.points.length + (reviewedDrawing.controlPoints?.length || 0) }} /></div> : null}
            {result ? <div className="my-5 space-y-3"><p role="status" className="text-sm font-semibold text-brand-800">Saved to your Boundary Library.</p>
                <button type="button" className={button} onClick={() => onSaveAsNew()}>Save as new library boundary</button></div> : <div className="my-5 space-y-4">
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={checked} disabled={locked} onChange={event => setChecked(event.target.checked)} className="h-5 w-5 accent-brand-700" />Save to Boundary Library</label>
                <label className="block text-sm font-semibold">Library name<input maxLength={240} value={name} disabled={locked} onChange={event => setName(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>
                <label className="block text-sm font-semibold">Library group (optional)<input maxLength={240} value={groupName} disabled={locked} onChange={event => setGroupName(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>
                <p className="text-xs text-slate-500">The map is saved before its boundary snapshot. {savedRevision === 0 ? 'This map has no saved drawing changes yet.' : ''}</p>
            </div>}
            {error ? <p role="alert" className="mb-4 text-sm text-red-700">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={onCancel}>{result ? 'Done' : 'Close'}</button>
                {!result && session.operation?.canReviewAgain ? <button type="button" disabled={busy} className={button} onClick={reviewCurrentSource}>Review current saved boundary</button> : null}
                {!result && !session.operation?.canReviewAgain ? <button type="button" disabled={busy || !reviewedDrawing || !checked || !name.trim()} onClick={save} className={`${button} border-brand-700 bg-brand-700 text-white`}>{busy ? 'Saving…' : session.operation ? 'Retry same save' : 'Save snapshot'}</button> : null}</div>
        </Dialog.Content>
    </Dialog.Portal></Dialog.Root>;
}
