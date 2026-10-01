import test from 'node:test';
import assert from 'node:assert/strict';
import { guidePageLabel, guideReportContext, isGuideSurfaceAllowed } from '../src/features/support/guideAssistantContext.js';

test('Guide page context contains feature labels, never private route identifiers', () => {
    assert.equal(guidePageLabel('/my-directory/maps/123-private-title'), 'My Maps');
    assert.equal(guidePageLabel('/resource/soft/765432'), 'Resource details');
    assert.equal(guidePageLabel('/unrecognised/private-content'), 'CareAround');
});

test('Guide is excluded from shared, governed, auth transition and print surfaces', () => {
    for (const route of ['/shared/maps/secret-token', '/governed/maps/private-token', '/auth/transition']) {
        assert.equal(isGuideSurfaceAllowed(route), false);
    }
    assert.equal(isGuideSurfaceAllowed('/my-directory/maps/1', '?view=print'), false);
    assert.equal(isGuideSurfaceAllowed('/my-directory/maps/1', '?view=print&extra=1'), false);
    assert.equal(isGuideSurfaceAllowed('/discover'), true);
    assert.equal(isGuideSurfaceAllowed('/dashboard/resources'), true);
});

test('optional Guide report context retains the launch page family without private routes', () => {
    assert.deepEqual(guideReportContext('/discover?search=private'), { pathname: '/discover' });
    assert.deepEqual(guideReportContext('/my-directory/maps/123-secret#notes'), { pathname: '/my-directory/maps' });
    assert.deepEqual(guideReportContext('/resource/soft/765432'), { pathname: '/resource' });
    assert.deepEqual(guideReportContext('/dashboard/admin'), { pathname: '/dashboard/admin' });
    assert.deepEqual(guideReportContext('/dashboard/profile'), { pathname: '/dashboard/profile' });
    assert.deepEqual(guideReportContext('/privacy'), { pathname: '/' });
    assert.deepEqual(guideReportContext('/shared/maps/secret'), { pathname: '/' });
    assert.deepEqual(guideReportContext('/unknown/private-data'), { pathname: '/' });
});
