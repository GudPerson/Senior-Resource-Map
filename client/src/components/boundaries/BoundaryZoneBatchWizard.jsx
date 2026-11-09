import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { fetchAllPaginatedResults } from '../../lib/paginatedResults.js';
import { buildManagedHardResourceListParams } from '../../lib/resourceListLoading.js';
import { buildBoundaryJobRows, mergeBoundaryBatchSelection, canManageBoundaryPlace, boundaryOutcomeSummary, boundaryCancellationMessage, boundaryFrozenReviewForJob, canCommitBoundaryReview, loadBoundaryFrozenReview } from '../../lib/boundaryZoneWorkflow.js';
import { useBoundaryZoneWorkflow } from './BoundaryZoneWorkflowProvider.jsx';
import BoundaryLibraryPicker, { FrozenPreview } from './BoundaryLibraryPicker.jsx';

const button = 'min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40';
export default function BoundaryZoneBatchWizard({ initialRows = [], placeOptions = null, onClose, onComplete }) {
    const { user } = useAuth(), workflow = useBoundaryZoneWorkflow();
    const { session, draft } = workflow;
    const token = session.capture(), mounted = useRef(true), running = useRef(false);
    const [places, setPlaces] = useState(placeOptions || []), [placesError, setPlacesError] = useState(''), [placesLoading, setPlacesLoading] = useState(!placeOptions);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [recent, setRecent] = useState([]), [recentCursor, setRecentCursor] = useState(null);
    const [frozenRecord,setFrozenRecord]=useState(null);
    const [pickerOpen, setPickerOpen] = useState(draft?.phase === 'select');
    const [drawChoice, setDrawChoice] = useState(draft?.phase === 'restart' || draft?.retryingStarter===true);
    const [reviewReload,setReviewReload]=useState(0);
    const stopFlight=useRef(false);
    const current = () => mounted.current && session.isCurrent(token);
    useEffect(() => {
        mounted.current = true;
        if (!draft.rows.length && initialRows.length) session.update({ rows:initialRows });
        return () => { mounted.current = false;session.stop(); };
    }, []);
    useEffect(() => {
        let active = true;
        if (placeOptions) return;
        setPlacesLoading(true);
        const params = buildManagedHardResourceListParams({ canManageResourceTools:true,role:user?.role });
        fetchAllPaginatedResults((params, options) => {
            if (!current()) throw new Error('Account changed.');
            return api.getHardAssets(params, options);
        }, params, { maxAttempts:1 }).then(items => { if (active && current()) setPlaces(items.filter(asset => canManageBoundaryPlace(user, asset))); })
            .catch(failure => { if(active && current()) setPlacesError(failure.message); })
            .finally(() => { if(active && current()) setPlacesLoading(false); });
        return () => {active=false;};
    }, [draft.workflowId]);
    const job = draft.job, rows = draft.rows || [], counts = boundaryOutcomeSummary(job);
    // Identity check happens during render, before an effect can clear the previous job's state.
    const frozenReview=boundaryFrozenReviewForJob(frozenRecord,job),frozen=frozenReview.items;
    const previewLoading=Boolean(job && ['ready','complete','paused','cancelled','failed'].includes(job.state) && frozenReview.status==='loading');
    const previewError=frozenReview.error;
    useEffect(() => {
        const loading=boundaryFrozenReviewForJob(null,job);setFrozenRecord(loading);
        if (!job || !['ready','complete','paused','cancelled','failed'].includes(job.state)) return;
        let active = true;
        loadBoundaryFrozenReview(job,api.getBoundaryZoneJobRowSource,{isCurrent:()=>active && current()})
            .then(record=>{if(active && current())setFrozenRecord(record);})
            .catch(failure=>{if(active && current())setFrozenRecord({...loading,status:'failed',items:{},error:failure.message});});
        return () => {active=false;};
    }, [job?.id, job?.snapshotSha256, job?.manifestSha256,job?.state,job?.revision,reviewReload]);
    async function run(action) {
        if (running.current || !current()) return;
        running.current=true;setBusy(true);setError('');
        try { await action(); }
        catch(failure) { if(current()) setError(failure.message); }
        finally {running.current=false;if(current()) setBusy(false);}
    }
    async function interrupt(action) {
        if(stopFlight.current)return;stopFlight.current=true;session.stop();setError('');
        try { await session.interruptJob(action); }
        catch(failure) {if(current())setError(failure.message);}
        finally {stopFlight.current=false;}
    }
    async function recentJobs(more = false) {
        const response=await session.listRecentJobs({limit:50,...(more && recentCursor ? {cursor:recentCursor} : {})});
        if(current()) {setRecent(old=>more ? [...old,...response.items] : response.items);setRecentCursor(response.nextCursor);}
    }
    function changeRow(key, patch) {session.update({ rows:rows.map(row=>row.rowKey===key ? {...row,...patch} : row) });}
    let validation='';
    try {buildBoundaryJobRows(rows);} catch(failure) {validation=failure.message;}
    const close = () => {session.stop();session.update({wizardOpen:false});onClose?.();};
    const sourceName = row => frozen[row.rowKey]?.label || `Boundary ${row.rowKey}`;
    const placeName = id => places.find(item=>Number(item.id)===Number(id))?.name || `Place ${id}`;
    if (workflow.loggingOut) return null;
    return <>
        {!pickerOpen ? <Dialog.Root open onOpenChange={open => {if(!open) close();}}><Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[2050] bg-slate-900/40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-[2051] flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-white shadow-xl" onPointerDown={event=>event.stopPropagation()} onInteractOutside={event=>event.preventDefault()}>
                <header className="border-b p-4"><Dialog.Title className="text-xl font-bold">{job ? 'Audience zone batch' : 'Create zones from boundaries'}</Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-slate-600">Assign a Place and zone name to every boundary. Review postal counts before creating zones.</Dialog.Description></header>
                <div className="min-h-0 space-y-4 overflow-y-auto p-4">
                    {draft.lostText ? <p role="status" className="text-amber-800">Saved work can be recovered. Unsaved Place and zone text was lost on reload; re-enter it before starting a new preparation.</p> : null}
                    {error || draft.error ? <p role="alert" className="text-sm text-red-700">{error || draft.error}</p> : null}
                    <button type="button" className={button} disabled={busy} onClick={()=>run(()=>recentJobs())}>Find recent jobs</button>
                    {!job ? <>
                        {placesLoading ? <p role="status">Loading manageable Places…</p> : null}
                        {placesError ? <p role="alert">Places could not load: {placesError}. Close and reopen to retry.</p> : null}
                        <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy || Boolean(draft.preparePayload)} onClick={()=>setPickerOpen(true)}>Choose Boundary Library</button>
                        </div>
                        {drawChoice ? <section className="space-y-3 border-y py-3"><h3 className="font-bold">{draft.retryingStarter && draft.phase!=='restart' ? 'Choose a Place for the same draw request' : 'Draw for a Place'}</h3>
                            <label className="block text-sm">Place<select className="input-field block w-full" value={draft.hardAssetId || ''} onChange={event=>session.update({hardAssetId:event.target.value})}><option value="">Choose a Place</option>{places.map(place=><option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
                            <label className="block text-sm">Zone name<input className="input-field block w-full" value={draft.name || ''} onChange={event=>session.update({name:event.target.value})} /></label>
                            <label className="block text-sm">Zone code (optional)<input className="input-field block w-full" value={draft.zoneCode || ''} onChange={event=>session.update({zoneCode:event.target.value})} /></label>
                            {draft.drawBlocked ? <p role="alert">Close this panel, save or discard the open Place edits, then reopen Boundary Library before drawing.</p> : null}
                            <button type="button" className="btn-primary" disabled={busy || !draft.hardAssetId || draft.drawBlocked || placesLoading || ((draft.retryingStarter || draft.phase==='restart') && !places.some(place=>Number(place.id)===Number(draft.hardAssetId)))} onClick={()=>run(async()=>{if(draft.phase==='restart'){await session.restart(places);return;}if(draft.retryingStarter){await session.retryStarterWithPlace(draft.hardAssetId,places);return;}session.update({wizardOpen:false});await session.startDraw();})}>{draft.phase==='restart' ? 'Start a new Care Map' : draft.retryingStarter ? 'Retry same draw request' : 'Draw boundary'}</button>
                        </section> : null}
                        <div className="divide-y">{rows.map((row,index)=><section key={row.rowKey} className="space-y-3 py-4" aria-label={`Boundary row ${index+1}`}>
                            <h3 className="font-bold">{row.boundaryName || `Boundary ${index+1}`}</h3>
                            <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">Place (required)<select className="input-field mt-1 w-full" value={row.hardAssetId || ''} disabled={busy || Boolean(draft.preparePayload)} onChange={event=>changeRow(row.rowKey,{hardAssetId:event.target.value})}><option value="">Choose a Place</option>{places.map(place=><option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
                                <label className="text-sm font-semibold">Zone name (required)<input className="input-field mt-1 w-full" maxLength={160} value={row.name || ''} disabled={busy || Boolean(draft.preparePayload)} onChange={event=>changeRow(row.rowKey,{name:event.target.value})} /></label>
                                <label className="text-sm font-semibold">Zone code (optional)<input className="input-field mt-1 w-full" maxLength={80} value={row.zoneCode || ''} disabled={busy || Boolean(draft.preparePayload)} onChange={event=>changeRow(row.rowKey,{zoneCode:event.target.value})} /></label></div>
                            {!row.source?.libraryId ? <><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={row.saveToLibrary===true} disabled={busy || Boolean(draft.preparePayload)} onChange={event=>changeRow(row.rowKey,{saveToLibrary:event.target.checked})} />Save this boundary to my library when this zone is created</label>
                                {row.saveToLibrary ? <div className="grid gap-3 sm:grid-cols-2"><label>Library name<input className="input-field w-full" value={row.libraryName ?? row.name} disabled={busy || Boolean(draft.preparePayload)} onChange={event=>changeRow(row.rowKey,{libraryName:event.target.value})} /></label><label>Library group (optional)<input className="input-field w-full" value={row.libraryGroupName || ''} disabled={busy || Boolean(draft.preparePayload)} onChange={event=>changeRow(row.rowKey,{libraryGroupName:event.target.value})} /></label></div> : null}</> : null}
                        </section>)}</div>
                        {validation && rows.length ? <p role="alert" className="text-sm text-amber-800">{validation}</p> : null}
                        {draft.prepareRefused ? <button type="button" className={button} disabled={busy} onClick={()=>session.reviewPreparation()}>Review details for a new preparation</button> : null}
                        {rows.length ? <button type="button" className="btn-primary" disabled={busy || Boolean(validation) || placesLoading || Boolean(placesError)} onClick={()=>run(async()=>{await session.prepare(rows);if(current()) await session.continueJob();})}>{draft.preparePayload ? 'Reconcile same preparation' : 'Prepare postal counts'}</button> : null}
                    </> : <>
                        <p role="status" className="font-semibold">Status: {job.state} · {counts.created} created · {counts.empty} empty · {counts.failed} failed</p>
                        {busy ? <p role="status">Processing the next bounded step. Keep this view open to continue; closing stops future steps.</p> : null}
                        {previewLoading ? <p role="status">Loading frozen boundaries for review…</p> : null}
                        {previewError ? <p role="alert">Frozen review unavailable: {previewError}. Read saved status again.</p> : null}
                        <div className="divide-y">{job.rows.map(row=><section key={row.rowKey} className="space-y-2 py-3"><p className="font-semibold">{sourceName(row)} → {placeName(row.hardAssetId)} → {row.name}</p>
                            <p className="text-sm">Code: {row.zoneCode || 'None'} · {row.postalCount} postal codes · {row.status}{row.zoneId ? ` · Zone ${row.zoneId}` : ''}{row.libraryId ? ` · Library ${row.libraryId}` : ''}{row.errorCode ? ` · ${row.errorCode}` : ''}</p>
                            {row.status==='empty' ? <p className="text-sm">No matching postals. No zone or library snapshot is created for this row.</p> : null}
                            {frozen[row.rowKey] ? <details><summary className="cursor-pointer text-sm text-brand-800">Review frozen boundary</summary><div className="max-w-sm"><FrozenPreview item={{...frozen[row.rowKey],name:sourceName(row)}} /></div></details> : null}
                        </section>)}</div>
                        {job.state==='ready' ? <div className="space-y-2"><p className="text-sm">Preparation created no zones or library snapshots. Creating these zones does not select them on an Offering.</p>
                            {draft.needsResume && draft.commitPayload && draft.commitPayload.expectedRevision!==job.revision ? <button type="button" className={button} disabled={busy || previewLoading || Boolean(previewError)} onClick={()=>session.reviewCommit()}>Review changed ready status for a new create action</button> : null}
                            <button type="button" className="btn-primary" disabled={busy || draft.needsResume || previewLoading || Boolean(previewError) || !canCommitBoundaryReview(frozenRecord,job)} onClick={()=>run(async()=>{if(!canCommitBoundaryReview(frozenRecord,session.draft.job))throw new Error('Review this saved batch before creating zones.');await session.jobAction('commit');if(current()) await session.continueJob();if(current()) onComplete?.(session.draft.job);})}>{counts.ready ? `Create ${counts.ready} audience zones` : 'Finish batch without creating zones'}</button></div> : null}
                        <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={()=>run(async()=>{await session.getJob(job.id);if(current())setReviewReload(value=>value+1);})}>Read saved status</button>
                            {(['preparing','ready','committing'].includes(job.state) && draft.needsResume) || job.state==='paused' ? <button type="button" className={button} disabled={busy} onClick={()=>run(async()=>{await session.getJob(job.id);if(!current())return;if(session.draft.job.state==='paused') await session.jobAction('resume');else session.update({needsResume:false});if(current()) await session.continueJob();})}>Resume after status review</button> : null}
                            {['preparing','committing'].includes(job.state) ? <button type="button" className={button} onClick={()=>interrupt('pause')}>Pause</button> : null}
                            {!['complete','cancelled','failed'].includes(job.state) ? <button type="button" className={button} onClick={()=>interrupt('cancel')}>Cancel remaining work</button> : null}
                        </div>
                        {job.state==='cancelled' ? <p role="status">{boundaryCancellationMessage(job)}</p> : null}
                    </>}
                    {recent.length ? <section><h3 className="font-bold">Recent saved jobs</h3><ul className="divide-y">{recent.map(item=><li className="flex items-center justify-between gap-3 py-2 text-sm" key={item.id}><span>Batch {item.id} · {item.state} · {item.rowCount} boundaries · {item.createdCount} created</span><button type="button" className={button} disabled={busy} onClick={()=>run(()=>session.getJob(item.id))}>Read saved job</button></li>)}</ul>{recentCursor ? <button type="button" className={button} disabled={busy} onClick={()=>run(()=>recentJobs(true))}>More recent jobs</button> : null}</section> : null}
                </div>
                <footer className="flex justify-end border-t p-4"><button type="button" className={button} onClick={close}>{busy ? 'Close and stop future steps' : 'Back / close'}</button></footer>
            </Dialog.Content></Dialog.Portal></Dialog.Root> : null}
        {pickerOpen ? <BoundaryLibraryPicker selectedIds={draft.selectedIds || []} onSelectionChange={selectedIds=>session.update({selectedIds})} scopeKey={draft.workflowId} workflowSession={session}
            onCancel={()=>setPickerOpen(false)} onDraw={()=>{setPickerOpen(false);setDrawChoice(true);}}
            onConfirm={snapshots=>{if(!current()) return;session.update({rows:mergeBoundaryBatchSelection(rows,snapshots,draft),phase:'assigning'});setPickerOpen(false);}} /> : null}
    </>;
}
