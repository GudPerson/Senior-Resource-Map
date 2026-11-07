import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { normalizeRegionalDiscoveryPayload } from './regionalDiscoveryContract.js';
import { getRegionalDiscoveryDirectory, evaluateRegionalDiscovery } from '../../lib/regionalDiscoveryApi.js';

/** Remove evaluated context synchronously; retain only the safe directory and public places. */
function retireEvaluation(payload) {
    if (!payload) return null;
    const retireContact = contact => contact.appliesTo === 'entered-location'
        ? {status:contact.status === 'hidden' ? 'hidden' : 'needs-postal',appliesTo:'entered-location'} : contact;
    return normalizeRegionalDiscoveryPayload({...payload, evaluation:{status:'none'}, entries:payload.entries.map(entry => ({
        ...entry, recommended:false, distanceMeters:null,
        contacts:{email:retireContact(entry.contacts.email),phone:retireContact(entry.contacts.phone)},
    })).sort((left,right)=>left.publishedOrder-right.publishedOrder)});
}

/** In-memory request controller used by the hook; infrastructure is injectable for bounded tests. */
export function createRegionalDiscoveryController({ token, initialPayload, evaluateImpl = evaluateRegionalDiscovery, loadImpl = getRegionalDiscoveryDirectory }) {
    const initial = initialPayload == null ? null : normalizeRegionalDiscoveryPayload(initialPayload);
    const initialSnapshot = () => ({postalInput:initial?.evaluation.postalCode || '', state:{payload:initial,loading:!initial,evaluating:false,error:''}});
    let snapshot = initialSnapshot();
    let epoch = 0, request = null, active = true, started = false;
    const listeners = new Set();
    const update = next => { snapshot = next; listeners.forEach(listener => listener()); };
    function invalidate() { epoch++; request?.abort(); request = null; }
    function retire(error = '') {
        update({...snapshot,state:{payload:retireEvaluation(snapshot.state.payload),loading:false,evaluating:false,error}});
    }
    function setPostalInput(value) {
        invalidate();
        snapshot = {...snapshot,postalInput:typeof value === 'string' ? value : ''};
        retire();
    }
    function clearPostal() { setPostalInput(''); }
    async function run(postalCode) {
        if (!active) return false;
        invalidate();
        const currentEpoch = epoch;
        const entered = snapshot.postalInput;
        const controller = new AbortController(); request = controller;
        update({...snapshot,state:{payload:retireEvaluation(snapshot.state.payload),loading:postalCode === undefined,evaluating:postalCode !== undefined,error:''}});
        const isCurrent = () => active && epoch === currentEpoch && snapshot.postalInput === entered && !controller.signal.aborted;
        try {
            // Owner Preview supplies BOTH an initial DTO and its own evaluator.
            // Its base retry also uses that evaluator, never the public guest URL.
            const implementation = postalCode !== undefined ? evaluateImpl
                : evaluateImpl !== evaluateRegionalDiscovery ? evaluateImpl : loadImpl;
            const raw = await implementation(token,{...(postalCode === undefined ? {} : {postalCode}),signal:controller.signal});
            if (!isCurrent()) return false;
            const payload = normalizeRegionalDiscoveryPayload(raw);
            if (postalCode === undefined
                ? payload.evaluation.status !== 'none' || payload.evaluation.postalCode !== undefined
                : payload.evaluation.postalCode !== postalCode || payload.evaluation.status === 'none') throw new Error('Mismatched evaluation context');
            if (!isCurrent()) return false;
            update({...snapshot,state:{payload,loading:false,evaluating:false,error:''}});
            return true;
        } catch (error) {
            if (!isCurrent()) return false;
            const unavailable = error?.code === 'unavailable' || [403,404,410].includes(error?.status);
            update({...snapshot,state:{payload:unavailable ? null : retireEvaluation(snapshot.state.payload),loading:false,evaluating:false,error:unavailable ? 'unavailable' : 'request-failed'}});
            return false;
        } finally {
            if (epoch === currentEpoch) request = null;
        }
    }
    async function submitPostal(postalCode = snapshot.postalInput) {
        if (!active) return false;
        if (typeof postalCode !== 'string' || !/^\d{6}$/.test(postalCode)) { invalidate(); retire('invalid-postal'); return false; }
        // A callback holding an old draft must not evaluate a different recipient.
        if (postalCode !== snapshot.postalInput) { invalidate(); retire('request-failed'); return false; }
        return run(postalCode);
    }
    function retry() { return snapshot.postalInput ? submitPostal(snapshot.postalInput) : run(undefined); }
    async function start() {
        if (started) return;
        if (!active) { active = true; update(initialSnapshot()); }
        started = true;
        if (!initial) await run(undefined);
    }
    function stop() {
        invalidate(); active = false; started = false;
        update({postalInput:'',state:{payload:null,loading:false,evaluating:false,error:''}});
    }
    return {
        getSnapshot:() => snapshot,
        subscribe:listener => {listeners.add(listener); return () => listeners.delete(listener);},
        setPostalInput,submitPostal,clearPostal,retry,start,stop,
    };
}

/**
 * token is the logical viewer identity (guest token, or owner map + saved revision).
 * initialPayload/evaluateImpl must be stable for that identity. A supplied initial
 * payload skips the mount GET. An injected evaluator has signature
 * (token,{postalCode?:string,signal:AbortSignal}) => Promise<complete DTO>.
 */
export function useRegionalDiscovery({token,initialPayload,evaluateImpl} = {}) {
    const controller = useMemo(() => createRegionalDiscoveryController({token,initialPayload,evaluateImpl}), [token,initialPayload,evaluateImpl]);
    useLayoutEffect(() => {void controller.start(); return () => controller.stop();}, [controller]);
    const snapshot = useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
    return {...snapshot,setPostalInput:controller.setPostalInput,submitPostal:controller.submitPostal,clearPostal:controller.clearPostal,retry:controller.retry};
}
export default useRegionalDiscovery;
