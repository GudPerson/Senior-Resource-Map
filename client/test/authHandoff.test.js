import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldShowPhoneLoginHandoff } from '../src/lib/authHandoff.js';

test('shows auth handoff immediately on GudAuth phone login return URLs', () => {
    assert.equal(shouldShowPhoneLoginHandoff('?gudauth=phone_login', null), true);
    assert.equal(shouldShowPhoneLoginHandoff('gudauth=phone_login&returnTo=%2Fdashboard', null), true);
});

test('shows auth handoff while a stored phone-login attempt is active', () => {
    assert.equal(shouldShowPhoneLoginHandoff('', { attemptId: 123 }), true);
});

test('does not show auth handoff for unrelated auth routes', () => {
    assert.equal(shouldShowPhoneLoginHandoff('', null), false);
    assert.equal(shouldShowPhoneLoginHandoff('?gudauth=phone_link', null), false);
    assert.equal(shouldShowPhoneLoginHandoff('?returnTo=%2Fdashboard', { attemptId: 0 }), false);
});
