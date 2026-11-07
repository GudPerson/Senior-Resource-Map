import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRegionalDiscoveryPayload } from '../src/features/regional-discovery/regionalDiscoveryContract.js';
import { normalizeRegionalDiscoveryPayload as normalizeSharedPayload, normalizeRegionalDiscoveryText } from '../../shared/regionalDiscoveryContract.js';
import { createRegionalDiscoveryPayload } from '../../tests/fixtures/regional-discovery/data.mjs';

// These exercise the trust boundary: accepting each mutation could leak data,
// enable unsafe links, corrupt map geometry or lose an independent service.
const fresh = createRegionalDiscoveryPayload;
test('client facade and server share the exact policy-free public validator', () => {
    assert.equal(normalizeRegionalDiscoveryPayload,normalizeSharedPayload);
    assert.deepEqual(normalizeSharedPayload(fresh()),normalizeRegionalDiscoveryPayload(fresh()));
    for (const value of ['', ' \t ', 'unsafe\u0001text', null, 42]) {
        assert.throws(()=>normalizeRegionalDiscoveryText(value,'required'),TypeError);
    }
    for (const value of ['', ' \t\n ', null]) assert.equal(normalizeRegionalDiscoveryText(value,'nullable',true),value);
    assert.throws(()=>normalizeRegionalDiscoveryText('unsafe\u007f','nullable',true),TypeError);
});
function rejectsMutation(mutate) {
    const raw = fresh();
    mutate(raw);
    assert.throws(() => normalizeRegionalDiscoveryPayload(raw), TypeError);
}

test('rejects_unknown_view_or_version', () => {
    assert.throws(() => normalizeRegionalDiscoveryPayload({ schemaVersion: 2, view: 'regional-discovery' }));
    rejectsMutation((raw) => { raw.schemaVersion = '1'; });
    rejectsMutation((raw) => { raw.view = 'compact'; });
});

test('rejects_private_fields', () => {
    for (const mutate of [
        (raw) => { raw.savedHome = { postalCode: '910101' }; },
        (raw) => { raw.entries[0].subregionId = 91001; },
        (raw) => { raw.entries[0].mapLocationScope = { selectedPlaceIds: [81001] }; },
        (raw) => { raw.entries[0].privateNotes = 'private'; },
        (raw) => { raw.entries[0].contacts.email.grantId = 22; },
        (raw) => { raw.pins[0].zoneId = 2; },
        (raw) => { raw.categories[0].internalId = 3; },
        (raw) => { raw.evaluation.latitude = 1.31; },
        (raw) => { raw.evaluation.subregionId = 91001; },
    ]) rejectsMutation(mutate);
});

test('preserves_empty_directory_and_independent_entries', () => {
    const empty = fresh();
    empty.entries = [];
    empty.pins = [];
    empty.categories = [];
    assert.deepEqual(normalizeRegionalDiscoveryPayload(empty).entries, []);

    const shared = fresh();
    shared.entries = shared.entries.slice(0, 2);
    const result = normalizeRegionalDiscoveryPayload(shared);
    assert.equal(result.entries.length, 2);
    assert.deepEqual(result.entries.map((entry) => entry.entryKey), ['hard:101', 'hard:102']);
    assert.deepEqual(result.pins[0].entryKeys, ['hard:101', 'hard:102']);
});

test('returns_detached_public_data_without_fabricating_unplotted_geometry', () => {
    const raw = fresh();
    const result = normalizeRegionalDiscoveryPayload(raw);
    assert.deepEqual(result, raw);
    result.entries[0].contacts.phone.value = 'changed';
    result.entries[0].pinPlaceKeys.push('changed');
    result.regionExtent[0] = 0;
    assert.equal(raw.entries[0].contacts.phone.value, '+65 6000 0100');
    assert.deepEqual(raw.entries[0].pinPlaceKeys, ['place:81001']);
    assert.equal(raw.regionExtent[0], 103.6);
    assert.deepEqual(result.entries[2].pinPlaceKeys, []);
    assert.equal(result.entries[2].distanceMeters, null);
    assert.equal(result.entries[3].placement, 'coordinates-unavailable');
    assert.equal(result.pins.length, 1);
});

test('rejects_missing_fields_and_wrong_types_without_coercion', () => {
    for (const mutate of [
        (raw) => { delete raw.snapshotRevision; },
        (raw) => { raw.entries = {}; },
        (raw) => { delete raw.entries[0].description; },
        (raw) => { raw.entries[0].recommended = 1; },
        (raw) => { raw.entries[0].name = null; },
        (raw) => { raw.entries[0].publishedOrder = -1; },
        (raw) => { raw.entries[0].publishedOrder = 0.5; },
        (raw) => { raw.entries[0].entryKey = 'hard:0'; },
        (raw) => { raw.entries[0].placement = 'home'; },
        (raw) => { raw.entries[0].contacts.phone.appliesTo = 'home-sr'; },
        (raw) => { raw.entries[0].contacts.phone.status = 'original'; },
        (raw) => { raw.evaluation.status = 'outside'; },
        (raw) => { raw.evaluation.postalCode = 910101; },
        (raw) => { raw.evaluation.postalCode = '12345'; },
    ]) rejectsMutation(mutate);
    for (const raw of [null, [], 'payload', 1]) {
        assert.throws(() => normalizeRegionalDiscoveryPayload(raw), TypeError);
    }
});

test('rejects_nonfinite_or_negative_distances_and_invalid_map_geometry', () => {
    for (const distance of [-1, NaN, Infinity, -Infinity, '100']) {
        rejectsMutation((raw) => { raw.entries[0].distanceMeters = distance; });
    }
    for (const mutate of [
        (raw) => { raw.regionExtent = [104, 1.2, 103, 1.5]; },
        (raw) => { raw.regionExtent = [103.6, 1.5, 104, 1.2]; },
        (raw) => { raw.regionExtent = [103.6, 1.2, 104]; },
        (raw) => { raw.regionExtent[0] = NaN; },
        (raw) => { raw.pins[0].latitude = Infinity; },
        (raw) => { raw.pins[0].latitude = 91; },
        (raw) => { raw.pins[0].longitude = 181; },
        (raw) => { raw.pins[0].longitude = '103.82'; },
    ]) rejectsMutation(mutate);
});

test('rejects_destinations_and_labels_on_each_unavailable_contact_status', () => {
    for (const status of ['hidden', 'needs-postal', 'temporarily-unavailable']) {
        for (const field of ['label', 'value', 'href']) {
            rejectsMutation((raw) => {
                raw.entries[0].contacts.email = { status, appliesTo: 'entered-location', [field]: 'must not appear' };
            });
        }
    }
});

test('preserves_independent_contact_modes_and_safe_entered_location_contacts', () => {
    const raw = fresh();
    raw.entries[0].contacts.email = {
        status: 'available', appliesTo: 'entered-location', label: 'ICCP enquiries',
        value: 'north-iccp@example.invalid', href: 'mailto:north-iccp@example.invalid',
    };
    const result = normalizeRegionalDiscoveryPayload(raw);
    assert.equal(result.entries[0].contacts.email.appliesTo, 'entered-location');
    assert.equal(result.entries[0].contacts.phone.appliesTo, 'service');
    assert.deepEqual(result.entries[1].contacts.email, { status: 'hidden', appliesTo: 'service' });
    assert.deepEqual(result.entries[1].contacts.phone, { status: 'needs-postal', appliesTo: 'entered-location' });
});

test('rejects_unsafe_urls_and_contact_links_that_disagree_with_validated_values', () => {
    for (const mutate of [
        (raw) => { raw.entries[0].websiteUrl = 'javascript:alert(1)'; },
        (raw) => { raw.entries[0].logoUrl = 'data:image/svg+xml,test'; },
        (raw) => { raw.entries[0].websiteUrl = 'https://user:pass@example.invalid'; },
        (raw) => { raw.entries[0].websiteUrl = '/private/image'; },
        (raw) => { raw.entries[2].contacts.email.href = 'mailto:other@example.invalid'; },
        (raw) => { raw.entries[2].contacts.email.href += '?body=910101'; },
        (raw) => { raw.entries[2].contacts.email.value = 'bad\r\nvalue@example.invalid'; },
        (raw) => { raw.entries[0].contacts.phone.href = 'tel:+6560009999'; },
        (raw) => { raw.entries[0].contacts.phone.value = 'not a phone'; },
        (raw) => { delete raw.entries[0].contacts.phone.value; },
        (raw) => { delete raw.entries[0].contacts.phone.label; },
        (raw) => { delete raw.entries[0].contacts.phone.href; },
        (raw) => { raw.entries[0].contacts.phone.label = ''; },
    ]) rejectsMutation(mutate);
});

test('rejects_duplicate_or_dangling_directory_and_pin_membership', () => {
    for (const mutate of [
        (raw) => { raw.entries.push(structuredClone(raw.entries[0])); },
        (raw) => { raw.categories.push(structuredClone(raw.categories[0])); },
        (raw) => { raw.pins.push(structuredClone(raw.pins[0])); },
        (raw) => { raw.entries[0].categoryKey = 'missing'; },
        (raw) => { raw.entries[0].categoryLabel = 'Wrong category'; },
        (raw) => { raw.entries[0].pinPlaceKeys = ['missing']; },
        (raw) => { raw.entries[0].pinPlaceKeys.push('place:81001'); },
        (raw) => { raw.pins[0].entryKeys = ['hard:101']; },
        (raw) => { raw.pins[0].entryKeys.push('soft:201'); },
        (raw) => { raw.pins[0].entryKeys.push('hard:101'); },
        (raw) => { raw.pins[0].entryKeys = []; },
        (raw) => { raw.entries[0].placement = 'intentionally-unplotted'; },
        (raw) => { raw.entries[0].pinPlaceKeys = []; },
    ]) rejectsMutation(mutate);
});

test('retains_server_order_and_all_evaluation_states_without_recomputing_recommendations', () => {
    for (const status of ['none', 'inside-region', 'outside-region', 'coverage-unconfirmed', 'postal-unresolved']) {
        const raw = fresh();
        raw.evaluation = { status, postalCode: '910101' };
        if (status === 'inside-region') {
            raw.entries[0].recommended = true;
            raw.entries[0].distanceMeters = 0;
            raw.entries[1].distanceMeters = 200;
        }
        const result = normalizeRegionalDiscoveryPayload(raw);
        assert.equal(result.evaluation.status, status);
        assert.equal(result.evaluation.postalCode, '910101');
        assert.deepEqual(result.entries.map((entry) => entry.entryKey), ['hard:101', 'hard:102', 'soft:201', 'hard:104']);
        assert.equal(result.entries[0].distanceMeters, status === 'inside-region' ? 0 : null);
        assert.equal(result.entries[0].recommended, status === 'inside-region');
        assert.equal(result.entries[1].recommended, false);
    }
});

test('rejects_directories_over_the_published_entry_limit', () => {
    rejectsMutation((raw) => {
        raw.entries = Array.from({ length: 501 }, (_, index) => ({ ...raw.entries[2], entryKey: `soft:${index + 1}`, publishedOrder: index }));
        raw.pins = [];
    });
});


test('rejects_mailto_fragment_or_percent_decoding_that_changes_the_recipient', () => {
    for (const value of ['sample#different@example.invalid', 'sample%23different@example.invalid']) {
        rejectsMutation((raw) => {
            raw.entries[2].contacts.email.value = value;
            raw.entries[2].contacts.email.href = `mailto:${value}`;
        });
    }
    const raw = fresh();
    raw.entries[2].contacts.email.value = 'sample+enquiry@example.invalid';
    raw.entries[2].contacts.email.href = 'mailto:sample%2Benquiry@example.invalid';
    assert.equal(normalizeRegionalDiscoveryPayload(raw).entries[2].contacts.email.value, 'sample+enquiry@example.invalid');
});

test('rejects_malformed_mailbox_local_parts_and_domain_labels', () => {
    for (const value of [
        'sample..test@example.invalid', '.sample@example.invalid', 'sample.@example.invalid',
        'sample@example..invalid', 'sample@-example.invalid', 'sample@example-.invalid',
        'sample@example.-invalid', 'sample@example.invalid-',
    ]) {
        rejectsMutation((raw) => {
            raw.entries[2].contacts.email.value = value;
            raw.entries[2].contacts.email.href = `mailto:${value}`;
        });
    }
    const raw = fresh();
    raw.entries[2].contacts.email.value = 'sample.team@example-support.invalid';
    raw.entries[2].contacts.email.href = 'mailto:sample.team@example-support.invalid';
    assert.equal(normalizeRegionalDiscoveryPayload(raw).entries[2].contacts.email.value, 'sample.team@example-support.invalid');
});

test('preserves_empty_whitespace_and_null_published_copy', () => {
    for (const value of ['', '  \t\n', null]) {
        const raw = fresh();
        raw.entries[0].shortDescription = value;
        raw.entries[0].description = value;
        raw.entries[0].addressText = value;
        const result = normalizeRegionalDiscoveryPayload(raw);
        assert.equal(result.entries[0].shortDescription, value);
        assert.equal(result.entries[0].description, value);
        assert.equal(result.entries[0].addressText, value);
    }
    for (const field of ['shortDescription', 'description', 'addressText']) {
        rejectsMutation((raw) => { raw.entries[0][field] = 1; });
        rejectsMutation((raw) => { raw.entries[0][field] = '\u0000'; });
    }
});
