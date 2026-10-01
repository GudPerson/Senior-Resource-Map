import { useEffect, useRef, useState } from 'react';
import { programmeDraftFromApi, programmeDraftToApi, isUncertainProgrammeCreate } from './guideProgrammeState.js';

export function useGuideProgramme({ api, onMessage, onStateChange }) {
    const [draft, setDraft] = useState(null);
    const [review, setReview] = useState(null);
    const [attempt, setAttempt] = useState(null);
    const [pending, setPending] = useState('');
    const [error, setError] = useState('');
    const [aiAvailable, setAiAvailable] = useState(null);
    const [conflict, setConflict] = useState(false);
    const live = useRef(true);
    const inFlight = useRef(false);
    const origin = useRef(null);
    useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
    useEffect(() => {
        onStateChange?.({ hasDraft: Boolean(draft), creating: pending === 'create', uncertain: Boolean(attempt) && pending !== 'create' });
    }, [draft, pending, attempt, onStateChange]);

    async function run(kind, work, success, failure) {
        if (inFlight.current) return false;
        inFlight.current = true; origin.current = document.activeElement;
        setPending(kind); setError('');
        try {
            const result = await work();
            if (live.current) success(result);
            return true;
        } catch (err) {
            if (live.current && err.name !== 'AbortError') {
                setError(err.message || 'The request could not be completed. Please try again.');
                failure?.(err);
            }
            return false;
        } finally {
            inFlight.current = false;
            if (live.current) setPending('');
        }
    }
    function prepare(message, useAi = false) {
        if (attempt || conflict) return Promise.resolve(false);
        return run('draft', () => api.guideProgrammeDraft({ message, useAi, ...(draft ? { draft: programmeDraftToApi(draft) } : {}) }), (result) => {
            setDraft(programmeDraftFromApi(result.draft)); setReview(null); setAiAvailable(result.aiAvailable);
            onMessage({ question: message, message: result.message, input: null, actionKind: 'programme' });
        });
    }
    function edit(patch) {
        if (inFlight.current || attempt || conflict) return;
        setDraft((value) => ({ ...value, ...patch })); setReview(null); setError('');
    }
    function cancel() {
        if (inFlight.current || attempt) return;
        setDraft(null); setReview(null); setError(''); setConflict(false);
    }
    function prepareReview() {
        if (!draft || attempt || conflict) return;
        const requestId = crypto.randomUUID();
        run('review', () => api.guideProgrammeReview({ draft: programmeDraftToApi(draft), requestId }), (result) => {
            setReview(result); setDraft(programmeDraftFromApi(result.draft));
        });
    }
    function create() {
        if ((!review && !attempt) || inFlight.current) return;
        // A retry always sends the exact reviewed request, including after an
        // uncertain response. Edits/new conversations stay blocked meanwhile.
        const request = attempt || { draft: review.draft, requestId: review.requestId, reviewToken: review.reviewToken };
        setAttempt(request);
        run('create', () => api.guideProgrammeCreate(request), (result) => {
            setDraft(null); setReview(null); setAttempt(null);
            onMessage({ question: 'Create this programme/service', input: null, actionKind: 'programme',
                message: `${result.resource.name} has been created.${result.replayed ? ' This is the saved result of your earlier request.' : ''}`,
                resources: [result.resource] });
        }, (err) => {
            if (!isUncertainProgrammeCreate(err)) { setAttempt(null); setReview(null); }
            if (err.code === 'GUIDE_ACTION_CONFLICT') setConflict(true);
        });
    }
    return { draft, review, pending, error, aiAvailable, conflict, uncertain: Boolean(attempt), origin, prepare, edit, cancel, prepareReview, create };
}
