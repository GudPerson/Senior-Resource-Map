import assert from 'node:assert/strict';
import test from 'node:test';

import { getPhoneVerificationActions } from '../src/lib/phoneVerificationPanelState.js';

test('manual-review phone state can refresh after cleanup without restarting verification', () => {
    const actions = getPhoneVerificationActions({
        loading: false,
        status: 'manual_review',
        hasSavedPhone: true,
        hasUnsavedPhone: false,
        actionBusy: false,
        hasLinkedIdentity: false,
        currentVerifiedPhone: '',
        attemptId: null,
    });

    assert.equal(actions.showRefreshButton, true);
    assert.equal(actions.canRefreshStatus, true);
    assert.equal(actions.showStartButton, false);
});
