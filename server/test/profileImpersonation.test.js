import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldRefreshProfileSessionCookie } from '../src/controllers/userController.js';

test('profile updates do not refresh the normal session cookie during user view', () => {
    assert.equal(shouldRefreshProfileSessionCookie({ id: 45, isImpersonating: true }), false);
    assert.equal(shouldRefreshProfileSessionCookie({ id: 45, isImpersonating: false }), true);
    assert.equal(shouldRefreshProfileSessionCookie({ id: 45 }), true);
});
