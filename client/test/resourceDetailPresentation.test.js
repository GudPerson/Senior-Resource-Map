import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getResourceDetailPhone,
    getResourceHeroPresentation,
    shouldShowMobileGrabAction,
    shouldShowLinkedPlaceDetails,
} from '../src/lib/resourceDetailPresentation.js';

test('soft offering detail phone prefers the public contact phone from the offering', () => {
    assert.equal(getResourceDetailPhone({
        asset: { contactPhone: '6050 2080', phone: '6000 0000' },
        primaryLocation: { phone: '6333 4444' },
        isHard: false,
    }), '6050 2080');
});

test('soft offering detail phone falls back to legacy phone fields safely', () => {
    assert.equal(getResourceDetailPhone({
        asset: { phone: '6000 0000' },
        primaryLocation: { phone: '6333 4444' },
        isHard: false,
    }), '6000 0000');

    assert.equal(getResourceDetailPhone({
        asset: {},
        primaryLocation: { phone: '6333 4444' },
        isHard: false,
    }), '6333 4444');
});

test('standalone offerings hide linked-place copy when no linked places are available', () => {
    assert.equal(shouldShowLinkedPlaceDetails({ isHard: false, softLocations: [] }), false);
    assert.equal(shouldShowLinkedPlaceDetails({ isHard: false, softLocations: [{ id: 1 }] }), true);
    assert.equal(shouldShowLinkedPlaceDetails({ isHard: true, softLocations: [{ id: 1 }] }), false);
});

test('Grab action is limited to phone-sized resource detail views', () => {
    const href = 'https://grab.onelink.me/2695613898?af_dp=grab%3A%2F%2Fopen%3FscreenType%3DBOOKING';

    assert.equal(shouldShowMobileGrabAction({ isPhone: true, grabRideHref: href }), true);
    assert.equal(shouldShowMobileGrabAction({ isPhone: false, grabRideHref: href }), false);
    assert.equal(shouldShowMobileGrabAction({ isPhone: true, grabRideHref: '' }), false);
});

test('banner hero presentation adapts to the image instead of using a cropped fixed-height strip', () => {
    const desktopBanner = getResourceHeroPresentation({ hasBanner: true, isCompact: false });

    assert.match(desktopBanner.frameClass, /p-0/);
    assert.doesNotMatch(desktopBanner.frameClass, /\bh-64\b/);
    assert.match(desktopBanner.imageClass, /h-auto/);
    assert.match(desktopBanner.imageClass, /object-contain/);
    assert.match(desktopBanner.imageClass, /max-h-\[min\(58vh,36rem\)\]/);

    const logoOnly = getResourceHeroPresentation({ hasBanner: false, isCompact: false });
    assert.match(logoOnly.frameClass, /\bh-32\b/);
    assert.match(logoOnly.frameClass, /sm:h-48/);
});
