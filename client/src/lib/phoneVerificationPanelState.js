const REVIEW_STATUSES = new Set(['manual_review', 'conflict']);

export function getPhoneVerificationActions({
    loading = false,
    status = '',
    hasSavedPhone = false,
    hasUnsavedPhone = false,
    actionBusy = false,
    hasLinkedIdentity = false,
    currentVerifiedPhone = '',
    attemptId = null,
} = {}) {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const reviewStatus = REVIEW_STATUSES.has(normalizedStatus);

    const canStart = hasSavedPhone && !hasUnsavedPhone && !actionBusy && !loading && normalizedStatus !== 'pending';
    const canManualPoll = Boolean(attemptId) && normalizedStatus === 'pending' && !actionBusy;
    const canRefreshStatus = !loading && !actionBusy && reviewStatus;
    const showStartButton = !loading && !['verified', 'pending', 'manual_review', 'conflict', 'linked_without_profile_phone'].includes(normalizedStatus);
    const showRefreshButton = !loading && reviewStatus;
    const showRemoveButton = !loading
        && hasLinkedIdentity
        && Boolean(currentVerifiedPhone)
        && !actionBusy
        && ['verified', 'phone_changed', 'linked_without_profile_phone'].includes(normalizedStatus);

    return {
        canManualPoll,
        canRefreshStatus,
        canStart,
        showRefreshButton,
        showRemoveButton,
        showStartButton,
    };
}
