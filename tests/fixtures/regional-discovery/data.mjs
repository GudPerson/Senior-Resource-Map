// Local synthetic examples only. These are not approved routing data or controller DTOs.
export const fixtureSchemaVersion = 1;
export const fixtureProvenance = {
    kind: 'synthetic-manual',
    controllerSerialization: 'pending-task-6',
    coverageIsAuthoritative: false,
};

// S1/S2 model ordinary non-national SR records; SIN models the excluded fallback kind.
export const subregions = [
    { id: 91001, subregionCode: 'S1', name: 'Sample North', postalCodes: ['910101', '910102'] },
    { id: 91002, subregionCode: 'S2', name: 'Sample South', postalCodes: ['920101', '920102'] },
    { id: 91999, subregionCode: 'SIN', name: 'Sample national fallback', postalCodes: [] },
];

export const regionExtent = [103.6, 1.2, 104.0, 1.5];
export const categories = [
    { key: 'active-ageing', label: 'Active ageing' },
    { key: 'home-support', label: 'Home support' },
];

// Independent internal scenario inputs for later evaluator/controller tests.
// A configured invalid or nonmatching zone must not use the assigned-SR fallback.
export const services = [
    {
        resourceType: 'hard', resourceId: 101, name: 'Sample Neighbourhood Activities',
        assignedSubregionIds: [91002], audienceZone: { status: 'valid', postalCodes: ['910101'] },
        selectedPlaceIds: [81001], mapPlacement: 'published-locations', distanceSource: 'published-locations',
        emailMode: 'home-sr', phoneMode: 'original',
    },
    {
        resourceType: 'hard', resourceId: 102, name: 'Sample Shared Venue Support',
        assignedSubregionIds: [91001], audienceZone: { status: 'valid', postalCodes: ['920101'] },
        selectedPlaceIds: [81001], mapPlacement: 'published-locations', distanceSource: 'published-locations',
        emailMode: 'hidden', phoneMode: 'home-sr',
    },
    {
        resourceType: 'soft', resourceId: 201, name: 'Sample Home Visits',
        assignedSubregionIds: [91001, 91002], audienceZone: null,
        selectedPlaceIds: null, mapPlacement: 'unplotted', distanceSource: 'none',
        emailMode: 'original', phoneMode: 'hidden',
    },
    {
        resourceType: 'hard', resourceId: 103, name: 'Sample Invalid Coverage',
        assignedSubregionIds: [91001], audienceZone: { status: 'invalid', postalCodes: null },
        selectedPlaceIds: [81002], mapPlacement: 'published-locations', distanceSource: 'published-locations',
        emailMode: 'original', phoneMode: 'hidden',
    },
    {
        resourceType: 'hard', resourceId: 104, name: 'Sample Withdrawn Venue Service',
        assignedSubregionIds: [91001], audienceZone: null,
        selectedPlaceIds: [81003], mapPlacement: 'published-locations', distanceSource: 'published-locations',
        emailMode: 'hidden', phoneMode: 'original',
    },
];

export const venues = [
    { id: 81001, status: 'public', latitude: 1.32, longitude: 103.82 },
    { id: 81002, status: 'public', latitude: 1.33, longitude: 103.83 },
    { id: 81003, status: 'withdrawn', latitude: 1.34, longitude: 103.84 },
    { id: 81004, status: 'public', latitude: 1.35, longitude: 103.85, resourceId: 104 },
];

export const postalCases = [
    { postalCode: '910101', status: 'inside-region', subregionId: 91001 },
    { postalCode: '920101', status: 'inside-region', subregionId: 91002 },
    { postalCode: '930101', status: 'outside-region', subregionId: null },
    { postalCode: '940101', status: 'coverage-unconfirmed', subregionId: null },
    { postalCode: '950101', status: 'postal-unresolved', subregionId: null },
];

// Reserved .invalid destinations cannot accidentally represent a network recipient.
export const homeSrContacts = [
    { subregionId: 91001, email: 'north-iccp@example.invalid', phone: '+65 6000 0101' },
    { subregionId: 91002, email: 'south-iccp@example.invalid', phone: '+65 6000 0202' },
];

const hidden = { status: 'hidden', appliesTo: 'service' };
export const directory = {
    schemaVersion: 1,
    view: 'regional-discovery',
    snapshotRevision: 'synthetic-publication-1',
    regionExtent,
    categories,
    entries: [
        {
            entryKey: 'hard:101', publishedOrder: 0, name: 'Sample Neighbourhood Activities',
            categoryKey: 'active-ageing', categoryLabel: 'Active ageing',
            shortDescription: 'Fictional activities for contract testing.', description: null,
            addressText: 'Sample shared venue', websiteUrl: 'https://example.invalid/activities', logoUrl: null,
            pinPlaceKeys: ['place:81001'], placement: 'plotted', recommended: false, distanceMeters: null,
            contacts: {
                email: { status: 'needs-postal', appliesTo: 'entered-location' },
                phone: { status: 'available', appliesTo: 'service', label: 'Service enquiries', value: '+65 6000 0100', href: 'tel:+6560000100' },
            },
        },
        {
            entryKey: 'hard:102', publishedOrder: 1, name: 'Sample Shared Venue Support',
            categoryKey: 'active-ageing', categoryLabel: 'Active ageing',
            shortDescription: null, description: 'A separate fictional service sharing the same public pin.',
            addressText: 'Sample shared venue', websiteUrl: null, logoUrl: null,
            pinPlaceKeys: ['place:81001'], placement: 'plotted', recommended: false, distanceMeters: null,
            contacts: { email: hidden, phone: { status: 'needs-postal', appliesTo: 'entered-location' } },
        },
        {
            entryKey: 'soft:201', publishedOrder: 2, name: 'Sample Home Visits',
            categoryKey: 'home-support', categoryLabel: 'Home support',
            shortDescription: 'Fictional home support without a published pin.', description: null,
            addressText: null, websiteUrl: null, logoUrl: null,
            pinPlaceKeys: [], placement: 'intentionally-unplotted', recommended: false, distanceMeters: null,
            contacts: {
                email: { status: 'available', appliesTo: 'service', label: 'Service enquiries', value: 'home-visits@example.invalid', href: 'mailto:home-visits@example.invalid' },
                phone: hidden,
            },
        },
        {
            entryKey: 'hard:104', publishedOrder: 3, name: 'Sample Withdrawn Venue Service',
            categoryKey: 'home-support', categoryLabel: 'Home support',
            shortDescription: null, description: null, addressText: null, websiteUrl: null, logoUrl: null,
            pinPlaceKeys: [], placement: 'coordinates-unavailable', recommended: false, distanceMeters: null,
            contacts: { email: hidden, phone: { status: 'temporarily-unavailable', appliesTo: 'service' } },
        },
    ],
    pins: [{ placeKey: 'place:81001', latitude: 1.32, longitude: 103.82, entryKeys: ['hard:101', 'hard:102'] }],
    evaluation: { status: 'none' },
};

export function createRegionalDiscoveryPayload() {
    return structuredClone(directory);
}
