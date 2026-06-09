import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGrabBookingDeepLink, buildGrabRideDeepLink } from '../src/lib/rideHailingLinks.js';

test('buildGrabRideDeepLink uses coordinates to set destination and address as the display label', () => {
    const href = buildGrabRideDeepLink({
        name: 'THK AAC @ Beo Crescent',
        address: 'Blk 44 Beo Crescent #01-67 Singapore 160044',
        lat: '1.287123',
        lng: '103.827456',
    });

    const url = new URL(href);
    assert.equal(url.origin, 'https://grab.onelink.me');
    assert.equal(url.pathname, '/2695613898');

    const direct = new URL(url.searchParams.get('af_dp'));
    assert.equal(direct.protocol, 'grab:');
    assert.equal(direct.hostname, 'open');
    assert.equal(direct.searchParams.get('screenType'), 'BOOKING');
    assert.equal(direct.searchParams.get('dropOffLatitude'), '1.287123');
    assert.equal(direct.searchParams.get('dropOffLongitude'), '103.827456');
    assert.equal(direct.searchParams.get('dropOffAddress'), 'Blk 44 Beo Crescent #01-67 Singapore 160044');
    assert.equal(direct.searchParams.get('dropOffTitle'), 'Blk 44 Beo Crescent #01-67 Singapore 160044');
});

test('buildGrabRideDeepLink supports address-only destinations', () => {
    const href = buildGrabRideDeepLink({
        name: 'THK AAC @ Beo Crescent',
        address: 'Blk 44 Beo Crescent #01-67 Singapore 160044',
    });

    const direct = new URL(new URL(href).searchParams.get('af_dp'));
    assert.equal(direct.searchParams.has('dropOffLatitude'), false);
    assert.equal(direct.searchParams.has('dropOffLongitude'), false);
    assert.equal(direct.searchParams.get('dropOffAddress'), 'Blk 44 Beo Crescent #01-67 Singapore 160044');
    assert.equal(direct.searchParams.get('dropOffTitle'), 'Blk 44 Beo Crescent #01-67 Singapore 160044');
});

test('buildGrabRideDeepLink falls back to coordinates only when no address is available', () => {
    const href = buildGrabRideDeepLink({
        name: 'THK AAC @ Beo Crescent',
        lat: '1.287123',
        lng: '103.827456',
    });

    const direct = new URL(new URL(href).searchParams.get('af_dp'));
    assert.equal(direct.searchParams.get('dropOffLatitude'), '1.287123');
    assert.equal(direct.searchParams.get('dropOffLongitude'), '103.827456');
    assert.equal(direct.searchParams.has('dropOffAddress'), false);
    assert.equal(direct.searchParams.get('dropOffTitle'), 'THK AAC @ Beo Crescent');
});

test('buildGrabRideDeepLink returns an empty href when no destination is available', () => {
    assert.equal(buildGrabRideDeepLink(null), '');
    assert.equal(buildGrabRideDeepLink({}), '');
});

test('buildGrabBookingDeepLink opens Grab booking without a prefilled destination', () => {
    const href = buildGrabBookingDeepLink();
    const direct = new URL(new URL(href).searchParams.get('af_dp'));

    assert.equal(direct.protocol, 'grab:');
    assert.equal(direct.hostname, 'open');
    assert.equal(direct.searchParams.get('screenType'), 'BOOKING');
    assert.equal(direct.searchParams.has('dropOffTitle'), false);
    assert.equal(direct.searchParams.has('dropOffAddress'), false);
    assert.equal(direct.searchParams.has('dropOffLatitude'), false);
    assert.equal(direct.searchParams.has('dropOffLongitude'), false);
});
