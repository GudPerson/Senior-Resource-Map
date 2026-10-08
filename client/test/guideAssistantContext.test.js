import test from 'node:test';
import assert from 'node:assert/strict';
import { guidePageCaption, guidePageLabel, guideReportContext, guideRequestPageContext, isGuideSurfaceAllowed } from '../src/features/support/guideAssistantContext.js';

test('Guide page context contains feature labels, never private route identifiers', () => {
    for (const pathname of ['/my-directory/maps/123-private-title', '/my-directory/maps/9001?token=private#private-notes']) {
        assert.equal(guidePageLabel(pathname), 'Care Maps');
    }
    assert.equal(guidePageLabel('/my-directory'), 'My Directory');
    assert.equal(guidePageLabel('/resource/soft/765432'), 'Resource details');
    assert.equal(guidePageLabel('/unrecognised/private-content'), 'CareAround');
});

test('Guide map captions translate the feature name and whole caption without translating server context', () => {
    const pageContext = guidePageLabel('/my-directory/maps/9001-private-map-name');
    const expected = {
        en: 'You’re on Care Maps',
        'zh-CN': '您当前位于关怀地图',
        ms: 'Anda berada di Peta Penjagaan',
        ta: 'நீங்கள் பராமரிப்பு வரைபடங்கள் பகுதியில் உள்ளீர்கள்',
    };
    for (const [locale, caption] of Object.entries(expected)) {
        assert.equal(guidePageCaption(pageContext, locale), caption);
        assert.equal(guidePageCaption('My Maps', locale), caption, 'Legacy display inputs retain the current name.');
        assert.doesNotMatch(caption, /My Maps|9001|private-map-name|\{\{/);
    }
    assert.equal(guideRequestPageContext(pageContext), 'My Maps', 'The server keeps its established family alias in every UI locale.');
    assert.equal(guidePageCaption(pageContext, 'unsupported'), expected.en);
});

test('Guide request context keeps legacy semantic aliases and default without private route data', () => {
    assert.equal(guideRequestPageContext(guidePageLabel('/my-directory/maps/9001-private-map-name?token=secret#notes')), 'My Maps');
    assert.equal(guideRequestPageContext('My Maps'), 'My Maps');
    assert.equal(guideRequestPageContext('My Directory'), 'My Directory');
    assert.equal(guideRequestPageContext('Care Calendar'), 'Care Calendar');
    assert.equal(guideRequestPageContext(), 'CareAround');
});

test('Guide caption fallback is translated for all four locales', () => {
    const expected = {
        en: 'Help with CareAround',
        'zh-CN': 'CareAround 使用帮助',
        ms: 'Bantuan untuk CareAround',
        ta: 'CareAround பயன்படுத்த உதவி',
    };
    for (const [locale, caption] of Object.entries(expected)) {
        assert.equal(guidePageCaption('', locale), caption);
    }
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
