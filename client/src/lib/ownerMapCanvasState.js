// Derived display state only. The Studio and annotation owners still perform
// their own saves, retries and revision checks.
export function resolveOwnerMapCanvasSaveState(studio, annotationStatus, annotationError) {
    const studioState = studio?.loadError || studio?.conflict || studio?.status === 'error'
        ? 'failed' : !studio || studio.loading ? 'loading' : studio.saving ? 'saving'
            : studio.dirty ? 'pending' : 'saved';
    const annotations = annotationError || ['error', 'conflict'].includes(annotationStatus)
        ? 'failed' : ['idle', 'loading'].includes(annotationStatus) ? 'loading'
            : annotationStatus === 'saving' ? 'saving' : annotationStatus === 'unsaved' ? 'pending' : 'saved';
    const priority = ['failed', 'loading', 'saving', 'pending', 'saved'];
    return { studio: studioState, annotations, combined: priority.find(value => studioState === value || annotations === value) };
}
