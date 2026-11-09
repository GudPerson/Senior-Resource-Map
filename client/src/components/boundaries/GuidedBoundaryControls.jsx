import { useState } from 'react';
import { useBoundaryZoneWorkflow } from './BoundaryZoneWorkflowProvider.jsx';
import { boundaryCancellationMessage } from '../../lib/boundaryZoneWorkflow.js';
import './GuidedBoundaryControls.css';

/** Controls only: the existing annotation controller is the sole document writer. */
export default function GuidedBoundaryControls({ workflow, onUseBoundary, onCancel, onReviewSaved, hasUnfinishedDraft = false, busy = false, error = '', returnInCanvas = false }) {
    const context = useBoundaryZoneWorkflow();
    const [notice, setNotice] = useState('');
    if (!workflow || context?.loggingOut) return null;
    const cancel = async () => {
        try { await onCancel?.();setNotice(boundaryCancellationMessage(context?.session.draft?.job)); } catch (failure) {setNotice(failure.message);}
    };
    const steps = 'Choose Polygon, Rectangle or Circle in Draw & measure. Click to place points, finish the area, then select it.';
    const mobile = returnInCanvas ? <div className="boundary-guided-mobile space-y-1 rounded-lg border border-brand-200 bg-brand-50 p-2 text-sm">
        <div className="flex items-start gap-2"><details className="min-w-0 flex-1"><summary className="flex min-h-11 cursor-pointer items-center font-bold">Drawing steps</summary><p className="py-2">{steps}</p></details>
            <button type="button" className="btn-ghost shrink-0 px-2" aria-label="Cancel zone operation" disabled={busy || hasUnfinishedDraft} onClick={cancel}>Cancel zone</button></div>
        {hasUnfinishedDraft ? <p role="status">Finish or cancel the drawing before returning.</p> : null}
        {error || notice ? <p role="alert">{error || notice}</p> : null}
        {onReviewSaved ? <button type="button" className="btn-ghost" disabled={busy || hasUnfinishedDraft} onClick={onReviewSaved}>Reload saved drawings for review</button> : null}
    </div> : null;
    return <section aria-label="Draw boundary for audience zone" data-care-map-gesture-ui="true">
        {mobile}
        <div className={`${returnInCanvas ? 'boundary-guided-desktop ' : ''}space-y-2 border-b border-brand-200 bg-brand-50 px-4 py-3 text-sm`}>
        <p className="font-bold">Draw a boundary for {workflow.name || 'your audience zone'}</p>
        <p>{steps}</p>
        {hasUnfinishedDraft ? <p role="status">Finish or cancel the unfinished drawing before returning.</p> : null}
        {error || notice ? <p role="alert">{error || notice}</p> : null}
        {onReviewSaved ? <div className="space-y-1"><p>Reloading replaces local drawings with the saved version for review.</p><button type="button" className="btn-ghost" disabled={busy || hasUnfinishedDraft} onClick={onReviewSaved}>Reload saved drawings for review</button></div> : null}
        <div className="flex flex-wrap gap-2">
            {!returnInCanvas ? <button type="button" className="btn-primary" disabled={busy || hasUnfinishedDraft} onClick={onUseBoundary}>Return to Edit zone</button> : <p className="self-center font-semibold">Use Return to Edit zone when the selected area is ready.</p>}
            <button type="button" className="btn-ghost" disabled={busy || hasUnfinishedDraft} onClick={cancel}>Cancel zone operation</button>
        </div>
        </div>
    </section>;
}
