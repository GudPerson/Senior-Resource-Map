import { canonicalizeBoundaryDrawing } from '../../../shared/boundaryDrawing.js';
import { getHardAssetStaffRole, normalizeRole } from './roles.js';

const copy = value => structuredClone(value);
const failure = (message, code) => Object.assign(new Error(message), { code });
const oneLine = value => String(value || '').trim().replace(/\s+/g, ' ');
const positive = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
export const newBoundaryOperationId = () => globalThis.crypto.randomUUID();
export function strictBoundarySource(source) {
    if (positive(source?.libraryId) && positive(source.revision)) return { libraryId: Number(source.libraryId), revision: Number(source.revision) };
    if (positive(source?.mapId) && typeof source.annotationId === 'string' && source.annotationId
        && Number.isSafeInteger(source.revision) && source.revision >= 0) {
        return { mapId: Number(source.mapId), annotationId: source.annotationId, revision: source.revision };
    }
    throw failure('Review a saved boundary before continuing.', 'BOUNDARY_SOURCE_REQUIRED');
}
export function buildBoundaryJobRows(rows) {
    if (!rows.length || rows.length > 256) throw new Error('Select 1–256 boundaries.');
    const keys = new Set(), codes = new Set();
    return rows.map((row, index) => {
        const label = row.rowKey || `row ${index + 1}`, name = oneLine(row.name), zoneCode = oneLine(row.zoneCode) || null;
        if (!positive(row.hardAssetId)) throw new Error(`${label}: Choose a Place.`);
        if (!name || name.length > 160) throw new Error(`${label}: Enter a zone name (up to 160 characters).`);
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(label) || keys.has(label)) throw new Error('Boundary row identities must be unique.');
        keys.add(label);
        if (zoneCode && (zoneCode.length > 80 || codes.has(zoneCode))) throw new Error(`${label}: Zone code must be unique in this batch and at most 80 characters.`);
        if (zoneCode) codes.add(zoneCode);
        const source = strictBoundarySource(row.source), saveToLibrary = !source.libraryId && row.saveToLibrary === true;
        const result = { rowKey: label, name, zoneCode, hardAssetId: Number(row.hardAssetId), source, saveToLibrary };
        if (saveToLibrary) {
            result.libraryName = oneLine(row.libraryName || name);
            result.libraryGroupName = oneLine(row.libraryGroupName) || null;
        }
        return result;
    });
}
export function mergeBoundaryBatchSelection(rows, snapshots, { hardAssetId = '', name = '', zoneCode = '' } = {}) {
    return snapshots.map(item => rows.find(row => String(row.source?.libraryId) === String(item.id)) || {
        rowKey: `library-${item.id}`, name: snapshots.length === 1 && name ? name : item.name,
        zoneCode: snapshots.length === 1 ? zoneCode : '', hardAssetId,
        source: { libraryId: item.id, revision: item.revision }, boundaryName: item.name, drawing: item.drawing,
        saveToLibrary: false,
    });
}
export function canManageBoundaryPlace(user, asset) {
    if (!user || !positive(asset?.id)) return false;
    const role = normalizeRole(user.role);
    return role === 'super_admin' || (role === 'regional_admin'
        ? (user.subregionIds || []).some(id => Number(id) === Number(asset.subregionId))
        : normalizeRole(getHardAssetStaffRole(user, Number(asset.id))) === 'owner');
}
function normalizedForm(value) {
    if (Array.isArray(value)) return value.map(normalizedForm);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, normalizedForm(value[key])]));
    return value === undefined ? null : value;
}
export function boundaryPlaceReadiness({ hardAssetId, current, baseline, saving = false, enriching = false }) {
    if (!positive(hardAssetId)) return 'Save this Place before drawing.';
    if (saving || enriching) return 'Wait for the Place save or enrichment to finish.';
    if (JSON.stringify(normalizedForm(current)) !== JSON.stringify(normalizedForm(baseline))) return 'Save or discard your Place edits before leaving to draw. Your zone draft is kept.';
    return '';
}
export async function acknowledgeBoundarySelection({ mapId, selectedAnnotation, hasUnfinishedDraft, flushPendingChanges, readSavedDocument, readCurrentSelection = null, isCurrent = () => true }) {
    if (hasUnfinishedDraft) throw new Error('Finish or cancel the unfinished drawing first.');
    if (!selectedAnnotation?.id) throw new Error('Select a completed area boundary first.');
    const drawing = canonicalizeBoundaryDrawing(selectedAnnotation);
    const check = () => {
        if (!isCurrent()) throw failure('The account or boundary workflow changed.', 'BOUNDARY_SESSION_CHANGED');
        if(readCurrentSelection){
            const current=readCurrentSelection();let matches=false;
            try{matches=!current.hasUnfinishedDraft && current.annotation?.id===selectedAnnotation.id && JSON.stringify(canonicalizeBoundaryDrawing(current.annotation))===JSON.stringify(drawing);}catch{/* Review required. */}
            if(!matches)throw failure('The selected boundary changed while saving. Review and select it again.','BOUNDARY_SOURCE_REVIEW_REQUIRED');
        }
    };
    check();
    if (await flushPendingChanges() !== true) throw new Error('Save the map drawings successfully before returning to Edit zone.');
    check();
    const saved = await readSavedDocument();
    check();
    const acknowledged = saved?.annotations?.find(item => item.id === selectedAnnotation.id);
    let matches = false;
    try { matches = JSON.stringify(canonicalizeBoundaryDrawing(acknowledged)) === JSON.stringify(drawing); } catch { /* Review required. */ }
    if (!matches || !Number.isSafeInteger(saved?.revision) || saved.revision < 0) throw failure('The saved boundary changed. Review and select the current saved drawing before returning.', 'BOUNDARY_SOURCE_REVIEW_REQUIRED');
    return { source: { mapId: Number(mapId), annotationId: selectedAnnotation.id, revision: saved.revision }, drawing };
}
export function boundaryOutcomeSummary(job) {
    const rows = job?.rows || [];
    return { created: rows.filter(row => row.zoneId).length, library: rows.filter(row => row.libraryId).length,
        ready: rows.filter(row => row.status === 'ready' && row.postalCount > 0).length,
        empty: rows.filter(row => row.status === 'empty').length, failed: rows.filter(row => row.status === 'failed').length };
}
export function boundaryCancellationMessage(job) {
    const result = boundaryOutcomeSummary(job);
    return result.created || result.library
        ? `Your Care Map is kept. ${result.created} audience zone(s) and ${result.library} library snapshot(s) already created are kept.`
        : 'Your Care Map is kept. No audience zone or library snapshot was created.';
}

/** Remember only opaque feature pointers without replacing the router's entry key. */
export function rememberBoundaryWorkflowPointers(history, pointers) {
    const state={...(pointers.boundaryWorkflowId ? {boundaryWorkflowId:pointers.boundaryWorkflowId} : {}),
        ...(pointers.boundaryRequestId ? {boundaryRequestId:pointers.boundaryRequestId} : {}),
        ...(pointers.boundaryJobId ? {boundaryJobId:pointers.boundaryJobId} : {})};
    history.replaceState({...history.state,usr:state},'');
}
export function isGuidedBoundaryEntry({draft,state,mapId,ownerId}) {
    return Boolean(draft && String(draft.ownerId)===String(ownerId) && Number(draft.mapId)===Number(mapId)
        && ['drawing','draw-ready','recovered-map'].includes(draft.phase)
        && state?.boundaryWorkflowId===draft.workflowId && state?.boundaryRequestId===draft.requestId);
}
function frozenReviewKey(job) {
    return job ? JSON.stringify([job.id,job.snapshotSha256,job.manifestSha256]) : null;
}
export function boundaryFrozenReviewForJob(record,job) {
    if(record?.key===frozenReviewKey(job) && record?.revision===job?.revision)return record;
    return {key:frozenReviewKey(job),revision:job?.revision,status:'loading',items:{},error:''};
}
export function canCommitBoundaryReview(record,job) {
    const review=boundaryFrozenReviewForJob(record,job);
    return Boolean(job?.state==='ready' && review.status==='ready' && job.rows.every(row=>review.items[row.rowKey]?.rowKey===row.rowKey));
}
export async function loadBoundaryFrozenReview(job,readSource,{isCurrent=()=>true}={}) {
    const check=()=>{if(!isCurrent())throw failure('The active batch changed.','BOUNDARY_SESSION_CHANGED');};
    const items={};
    for(const row of job.rows){
        check();const source=await readSource(job.id,row.rowKey);check();
        if(source?.rowKey!==row.rowKey)throw new Error('The frozen boundary does not match this batch row.');
        items[row.rowKey]={...source,label:source.source?.displayName || source.drawing?.name || source.drawing?.text || source.libraryName || `Boundary ${row.rowKey}`};
    }
    return {key:frozenReviewKey(job),revision:job.revision,status:'ready',items,error:''};
}

/** Memory-only operation owner. Captures fence A→B→A and synchronous logout before React publishes null. */
export function createBoundaryWorkflowSession({ ownerId = null, api, id = newBoundaryOperationId, onSavedAssets = () => {}, onNavigate = () => {}, onPointers = () => {} }) {
    let owner = ownerId ? String(ownerId) : '', generation = 0, blocked = false, draft = null, runGeneration = 0, jobReadSequence = 0, routeEntry = null;
    const listeners = new Set(), flights = new Map(), intents = new Map(), placeGuards = new Set(), commitIntents = new Map();
    const emit = () => listeners.forEach(listener => listener());
    const capture = () => ({ owner, generation, routeEntry, workflowId: draft?.workflowId || null });
    const isCurrent = token => Boolean(owner && !blocked && token.owner === owner && token.generation === generation && token.routeEntry === routeEntry && token.workflowId === (draft?.workflowId || null));
    const check = token => { if (!isCurrent(token)) throw failure('The account or boundary workflow changed. Reopen the workflow.', 'BOUNDARY_SESSION_CHANGED'); };
    const update = patch => { if (!draft || blocked) return; draft = { ...draft, ...copy(patch) };emit(); };
    const pointers = () => ({ boundaryWorkflowId: draft?.workflowId, ...(draft?.requestId ? { boundaryRequestId: draft.requestId } : {}), ...(draft?.jobId ? { boundaryJobId: draft.jobId } : {}) });
    const single = (key, action, intent = '') => {
        if (flights.has(key)) {
            if (intents.get(key) !== intent) throw new Error('Another boundary operation is in flight. Wait for its saved status.');
            return flights.get(key);
        }
        intents.set(key,intent);
        const promise = Promise.resolve().then(action).finally(() => { if (flights.get(key) === promise) flights.delete(key);intents.delete(key); });
        flights.set(key, promise);return promise;
    };
    function begin(values = {}) {
        if (!owner || blocked) throw new Error('Sign in to start a boundary workflow.');
        generation++;runGeneration++;
        draft = { workflowId:id(),requestId:id(),ownerId:owner,name:'',zoneCode:'',sourceChoice:'draw',saveToLibrary:false,
            rows:[],selectedIds:[],phase:'editing', ...copy(values) };
        emit();return draft;
    }
    async function reconcileStarter(token) {
        check(token);
        try {
            const ready = await api.getBoundaryZoneMap(draft.requestId);check(token);
            if (ready.guidanceCancelled) {
                update({phase:'cancelled',cancelPending:false});
                onPointers({});
                throw failure('Guidance for this drawing was cancelled.', 'BOUNDARY_GUIDANCE_CANCELLED');
            }
            update({ mapId: ready.mapId, hardAssetId:ready.hardAssetId, mapName:ready.name, phase:'draw-ready', starterErrorCode:null,error:null });return ready;
        } catch (error) {
            check(token);
            if (error.code === 'BOUNDARY_GUIDANCE_CANCELLED') throw error;
            update({ phase: error.code === 'BOUNDARY_ZONE_MAP_UNAVAILABLE' ? 'map-unavailable' : error.status === 404 ? 'starter-not-found' : 'starter-unknown', starterErrorCode:error.code || null,...(error.code==='BOUNDARY_ZONE_MAP_UNAVAILABLE'?{retryingStarter:false}:{}),error:error.message });
            throw error;
        }
    }
    async function startDraw(values, { savePlace = false, retrySameRequest = false } = {}) {
        if (draft?.cancelPending) throw new Error('Confirm cancellation of the previous drawing first.');
        if (values) {
            if (!draft || draft.phase==='cancelled' || Number(draft.hardAssetId) !== Number(values.hardAssetId)) begin(values);
            else update(values);
        }
        const token = capture();check(token);
        return single(`${owner}:starter:${draft.requestId}`, async () => {
            check(token);
            for (const guard of placeGuards) {
                const reason=guard();
                if(reason){update({phase:'place-edits-required',error:reason});throw new Error(reason);}
            }
            if ((draft.starterAttempted && !savePlace && !retrySameRequest) || (draft.recoveryReadOnly && !retrySameRequest)) {
                const ready = await reconcileStarter(token);check(token);onNavigate(`/my-directory/maps/${ready.mapId}?workspace=current`,pointers());return ready;
            }
            // Persist before either the explicit favorite write or the starter can be accepted.
            onPointers(pointers());check(token);
            if (savePlace) {
                // Saving is explicit. A lost favorite ACK is reconciled before the same map request is retried.
                try { await api.ensureSavedAsset('hard', Number(draft.hardAssetId));check(token); }
                catch (error) { check(token);if (error.status >= 400 && error.status < 500) {update({phase:'save-place-required',error:error.message});throw error;} }
                try {const saved = await api.getSavedAssets();check(token);onSavedAssets(saved, token.owner);}
                catch(error) {check(token);update({phase:'save-place-required',error:`Saved status could not be confirmed: ${error.message}`});throw error;}
            }
            if (retrySameRequest) {
                try { const ready = await reconcileStarter(token);check(token);onNavigate(`/my-directory/maps/${ready.mapId}?workspace=current`,pointers());return ready; }
                catch (error) { check(token);if (error.status !== 404 || error.code === 'BOUNDARY_ZONE_MAP_UNAVAILABLE') throw error; }
            }
            if(!positive(draft.hardAssetId)){const message='Choose a Place before explicitly retrying or restarting this draw request.';update({error:message});throw new Error(message);}
            update({ starterAttempted:true, recoveryReadOnly:false, phase:'starting', error:null });
            try {
                const ready = await api.startBoundaryZoneMap({ requestId:draft.requestId,hardAssetId:Number(draft.hardAssetId) });check(token);
                if (ready.guidanceCancelled) {
                    update({phase:'cancelled'});onPointers({});
                    throw failure('Guidance for this drawing was cancelled.', 'BOUNDARY_GUIDANCE_CANCELLED');
                }
                update({ mapId:ready.mapId,hardAssetId:ready.hardAssetId ?? draft.hardAssetId, mapName:ready.name, phase:'drawing' });onNavigate(`/my-directory/maps/${ready.mapId}?workspace=current`,pointers());return ready;
            } catch (error) {
                check(token);
                if (error.code === 'BOUNDARY_GUIDANCE_CANCELLED') throw error;
                const phase = error.code === 'BOUNDARY_ZONE_PLACE_NOT_SAVED' ? 'save-place-required' : error.code === 'BOUNDARY_ZONE_PLACE_LOCATION_REQUIRED' ? 'location-required' : error.code === 'BOUNDARY_ZONE_MAP_UNAVAILABLE' ? 'map-unavailable' : 'starter-unknown';
                update({ phase,starterErrorCode:error.code || null,...(error.code==='BOUNDARY_ZONE_MAP_UNAVAILABLE'?{retryingStarter:false}:{}),error:error.message });throw error;
            }
        });
    }
    function requestStarterRetry() {
        if(!draft || blocked)return false;
        if(draft.phase==='map-unavailable'){
            update({retryingStarter:false,error:'This Care Map was deleted. Use the explicit new Care Map action to restart.'});return false;
        }
        if(draft.phase!=='starter-not-found' || draft.starterErrorCode!=='BOUNDARY_REQUEST_NOT_FOUND'){
            update({error:'Read the saved draw request before choosing a Place to retry.'});return false;
        }
        update({phase:'retry-place',retryingStarter:true,wizardOpen:true,error:null});return true;
    }
    function requestStarterRestart() {
        if(!draft || blocked)return false;
        if(draft.phase!=='map-unavailable'){
            update({error:'Read the deleted Care Map status before choosing an explicit restart.'});return false;
        }
        update({phase:'restart',retryingStarter:false,wizardOpen:true,error:null});return true;
    }
    async function retryStarterWithPlace(hardAssetId,authorizedPlaces) {
        const token=capture();check(token);
        let message='';
        if(draft.phase==='map-unavailable')message='This Care Map was deleted. Use the explicit new Care Map action to restart.';
        else if(!draft.retryingStarter)message='Open the Place chooser for this saved draw request first.';
        else if(!positive(hardAssetId))message='Choose a Place before retrying this draw request.';
        else if(!authorizedPlaces?.some(place=>Number(place.id)===Number(hardAssetId)))message='Choose an authorized Place from the current list before retrying.';
        if(message){update({error:message});throw new Error(message);}
        // Explicit choice updates only this original request's missing in-memory input.
        update({hardAssetId:Number(hardAssetId),error:null});
        try{return await startDraw(null,{retrySameRequest:true});}
        catch(error){if(isCurrent(token))update({error:error.message});throw error;}
    }
    async function acceptSavedBoundary(options) {
        const token = capture();check(token);
        if (draft.cancelPending) throw new Error('Confirm cancellation of this drawing before continuing.');
        if (Number(options.mapId) !== Number(draft.mapId)) throw new Error('Return to the active workflow Care Map.');
        const accepted = await acknowledgeBoundarySelection({ ...options,isCurrent:()=>isCurrent(token) });check(token);
        update({ ...accepted,phase:'returned',rows:[{ rowKey:'drawn-boundary',name:draft.name,zoneCode:draft.zoneCode,hardAssetId:draft.hardAssetId,
            source:accepted.source,drawing:accepted.drawing,boundaryName:accepted.drawing.name || accepted.drawing.text || 'Drawn boundary',saveToLibrary:draft.saveToLibrary }] });
        onNavigate('/dashboard/resources',pointers());return accepted;
    }
    async function recoverPointers(state) {
        if (!state?.boundaryWorkflowId || draft || blocked || !owner) return;
        begin({ workflowId:state.boundaryWorkflowId,requestId:state.boundaryRequestId || id(),jobId:state.boundaryJobId || null,phase:'recovery',lostText:true,starterAttempted:Boolean(state.boundaryRequestId),recoveryReadOnly:Boolean(state.boundaryRequestId) });
        const token=capture();
        if (draft.jobId) {const job=await getJob(draft.jobId);check(token);update({wizardOpen:true});return job;}
        if (!state.boundaryRequestId) return;
        try { await reconcileStarter(token);check(token);update({phase:'recovered-map'}); } catch { /* explicit recovery UI */ }
    }
    async function prepare(rows) {
        const token=capture();check(token);
        if (!draft.preparePayload) update({ preparePayload: {requestId:id(),rows:buildBoundaryJobRows(rows)} });
        return single(`${owner}:prepare:${draft.preparePayload.requestId}`, async () => {
            check(token);update({phase:'preparing',error:null});
            try {
                const job=await api.createBoundaryZoneJob(copy(draft.preparePayload));check(token);
                update({ job,jobId:job.id,phase:'job',needsResume:false });onPointers(pointers());return job;
            } catch(error) { check(token);update({phase:'prepare-unknown',prepareRefused:error.status>=400 && error.status<500,error:error.message});throw error; }
        });
    }
    function reviewPreparation() {
        if(!draft?.prepareRefused || draft.jobId)throw new Error('This preparation is uncertain. Reconcile the same request first.');
        update({preparePayload:null,prepareRefused:false,error:null,phase:'assigning'});
    }
    function reviewCommit() {
        if(draft?.job?.state!=='ready' || !draft.needsResume)throw new Error('Read and review the saved ready status first.');
        commitIntents.delete(`${owner}:${draft.job.id}`);
        update({commitPayload:null,commitBinding:null,needsResume:false,error:null});
    }
    async function getJob(jobId) {
        const token=capture();check(token);stop();const readSequence=++jobReadSequence;
        const pending=flights.get(`${owner}:job:${draft.job?.id}`);
        if(pending){try{await pending;}catch{/* Reconcile accepted status. */}check(token);}
        const job=await api.getBoundaryZoneJob(jobId);check(token);
        if(readSequence!==jobReadSequence)throw failure('Another saved batch was opened.','BOUNDARY_SESSION_CHANGED');
        if(draft.job?.id===job.id && draft.job.revision>job.revision)return draft.job;
        const intent=commitIntents.get(`${owner}:${job.id}`);
        update({job,jobId:job.id,commitPayload:intent?.payload || null,commitBinding:intent?.binding || null,phase:'job',needsResume:true,error:null});onPointers(pointers());return job;
    }
    async function jobAction(action) {
        const token=capture();check(token);
        if (!draft.job) throw new Error('Read the saved job status first.');
        const targetJobId=draft.job.id;
        const key=`${owner}:job:${targetJobId}`;
        return single(key, async () => {
            check(token);
            const job=draft.job;
            const checkJob=()=>{check(token);if(draft.job?.id!==targetJobId)throw failure('The active batch changed.','BOUNDARY_SESSION_CHANGED');};
            checkJob();
            let payload={expectedRevision:job.revision};
            if (action==='commit') {
                if (job.state !== 'ready') throw new Error('Review the ready job before creating zones.');
                const intentKey=`${owner}:${job.id}`;
                let intent=commitIntents.get(intentKey);
                if(intent && (intent.binding.ownerId!==owner || intent.binding.jobId!==job.id || intent.binding.reviewedRevision!==job.revision))
                    throw failure('The reviewed batch revision changed. Review the saved ready status before a new Create action.','BOUNDARY_COMMIT_REVIEW_REQUIRED');
                if(!intent){
                    intent={binding:{ownerId:owner,jobId:job.id,reviewedRevision:job.revision},payload:{requestId:id(),expectedRevision:job.revision}};
                    commitIntents.set(intentKey,intent);
                }
                update({commitPayload:intent.payload,commitBinding:intent.binding});
                payload=copy(intent.payload);
            }
            const methods={advance:'advanceBoundaryZoneJob',commit:'commitBoundaryZoneJob',pause:'pauseBoundaryZoneJob',resume:'resumeBoundaryZoneJob',cancel:'cancelBoundaryZoneJob'};
            try {
                const accepted=await api[methods[action]](job.id,payload);checkJob();
                update({job:accepted,needsResume:false,error:null});return accepted;
            } catch(error) {
                checkJob();update({needsResume:true,error:`${error.message} Read saved status before resuming.`});
                try { const latest=await api.getBoundaryZoneJob(job.id);checkJob();update({job:latest,needsResume:true}); } catch(reconcileError) {checkJob();update({error:`${error.message} Saved status is unavailable: ${reconcileError.message}`});}
                throw error;
            }
        }, action);
    }
    async function listRecentJobs(params={}) {
        const token=capture();check(token);
        const result=await api.listBoundaryZoneJobs(params);check(token);return result;
    }
    async function continueJob() {
        const token=capture(), run=++runGeneration;check(token);
        // A mounted view explicitly starts this loop. It stops on READY, uncertainty, close, or session change.
        while (isCurrent(token) && run===runGeneration && !draft.needsResume && ['preparing','committing'].includes(draft.job?.state)) {
            await jobAction('advance');check(token);
        }
        return draft?.job;
    }
    function stop() {runGeneration++;}
    async function interruptJob(action) {
        stop();const token=capture();check(token);
        const jobId=draft.job?.id;
        if (!jobId) return;
        const pending=flights.get(`${owner}:job:${jobId}`);
        if (pending) {try {await pending;} catch { /* Always reconcile before a new action. */ } check(token);}
        await getJob(jobId);check(token);
        if (['complete','cancelled','failed'].includes(draft.job.state)) return draft.job;
        const result=await jobAction(action);check(token);
        if (action==='cancel') update({phase:'cancelled'});
        return result;
    }
    async function cancel() {
        stop();
        if (!draft || blocked) throw new Error('No active boundary workflow.');
        if (draft.job) await interruptJob('cancel');
        else {
            // Fence queued starter/return continuations before reconciling any accepted write.
            generation++;
            const token=capture(), requestId=draft.requestId;
            const starter=flights.get(`${owner}:starter:${requestId}`);
            update({cancelPending:true});
            if (starter) { try { await starter; } catch { /* Await its transport settlement. */ } check(token); }
            if (draft.starterAttempted) {
                let outcome;
                try { outcome=await api.cancelBoundaryZoneMap(requestId); }
                catch {
                    check(token);
                    try { outcome=await api.getBoundaryZoneMap(requestId); }
                    catch { check(token);throw new Error('Cancellation is unconfirmed. Retry Cancel to check the same saved drawing.'); }
                }
                check(token);
                if (outcome?.requestId !== requestId || !outcome.guidanceCancelled) {
                    throw new Error('Cancellation is unconfirmed. Retry Cancel to check the same saved drawing.');
                }
            }
        }
        update({phase:'cancelled',cancelPending:false});onPointers({});
        return boundaryCancellationMessage(draft?.job);
    }
    return {get draft(){return blocked ? null : draft;},get ownerId(){return owner;},get generation(){return generation;},get loggingOut(){return blocked;},
        registerPlaceGuard(guard){placeGuards.add(guard);return()=>placeGuards.delete(guard);},
        subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},capture,isCurrent,update,begin,pointers,startDraw,requestStarterRetry,requestStarterRestart,retryStarterWithPlace,acceptSavedBoundary,recoverPointers,prepare,reviewPreparation,reviewCommit,getJob,jobAction,listRecentJobs,continueJob,stop,interruptJob,cancel,
        setRouteEntry(next){if(next!==routeEntry){routeEntry=next;generation++;runGeneration++;if(draft?.wizardOpen)draft={...draft,wizardOpen:false};}},
        setOwner(next){const value=next ? String(next) : '';if(value!==owner){owner=value;generation++;runGeneration++;draft=null;blocked=false;placeGuards.clear();commitIntents.clear();}},
        invalidate(){generation++;runGeneration++;blocked=true;draft=null;emit();},
        clear(){generation++;runGeneration++;draft=null;emit();},
        async restart(authorizedPlaces=null){
            if(authorizedPlaces && !authorizedPlaces.some(place=>positive(draft?.hardAssetId) && Number(place.id)===Number(draft.hardAssetId))){const message='Choose an authorized Place before starting a new Care Map.';update({error:message});throw new Error(message);}
            const values={hardAssetId:draft?.hardAssetId,name:draft?.name || '',zoneCode:draft?.zoneCode || '',saveToLibrary:draft?.saveToLibrary===true};begin(values);return startDraw();},
    };
}
