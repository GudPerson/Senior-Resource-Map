import { normalizeRegionalDiscoveryPayload } from './regionalDiscoveryContract.js';

/** Regional projection deliberately preserves the server's service order and distances. */
export function buildRegionalDiscoveryPresentation(payload, { selectedServiceKey = '' } = {}) {
    const dto = normalizeRegionalDiscoveryPayload(payload);
    const entries = dto.entries.filter(entry => !selectedServiceKey || entry.categoryKey === selectedServiceKey);
    const entriesByKey = Object.fromEntries(entries.map(entry => [entry.entryKey, entry]));
    const entryKeysByPlaceKey = {};
    const grouped = new Map();
    for (const pin of dto.pins) {
        const entryKeys = pin.entryKeys.filter(key => entriesByKey[key]);
        if (!entryKeys.length) continue;
        entryKeysByPlaceKey[pin.placeKey] = entryKeys;
        const coordinateKey = `${pin.latitude},${pin.longitude}`;
        const previous = grouped.get(coordinateKey);
        if (previous) {
            previous.memberPlaceKeys.push(pin.placeKey);
            previous.entryKeys = [...new Set([...previous.entryKeys, ...entryKeys])];
        } else {
            grouped.set(coordinateKey, {
                placeKey: pin.placeKey, pinKey: pin.placeKey,
                lat: pin.latitude, lng: pin.longitude,
                memberPlaceKeys: [pin.placeKey], entryKeys,
                name: entriesByKey[entryKeys[0]].name,
                number: grouped.size + 1,
            });
        }
    }
    const [west, south, east, north] = dto.regionExtent;
    return {
        entries, entriesByKey, pins: [...grouped.values()].map(pin => ({ ...pin, title: pin.entryKeys.map(key => entriesByKey[key].name).join(', ') })), entryKeysByPlaceKey,
        serviceOptions: [{ key: '', label: 'All services' }, ...dto.categories],
        regionBounds: [[south, west], [north, east]],
    };
}

/** DirectoryMap's first argument stays compatible; external metadata includes the whole marker. */
export function regionalDiscoveryMarkerEvent(type, placeKey, detail, entryKeysByPlaceKey) {
    const placeKeys = [...new Set(detail?.placeKeys?.length ? detail.placeKeys : [placeKey].filter(Boolean))];
    const entryKeys = [...new Set(placeKeys.flatMap(key => entryKeysByPlaceKey[key] || []))];
    return { type, placeKeys, entryKeys };
}

// Task-local English defaults; guest/owner hosts can inject their translated copy.
export const REGIONAL_DISCOVERY_COPY = {
    title: 'Local services', allServices: 'All services', service: 'Service', list: 'List', map: 'Map',
    postalLabel: "Senior's six-digit Singapore postal code", postalHint: 'Enter the postal code of the person who needs the service.',
    evaluate: 'Find services for this location', clearPostal: 'Clear postal', invalidPostal: 'Enter a six-digit Singapore postal code.',
    loading: 'Loading services…', evaluating: 'Checking this location…', empty: 'No services to show.',
    recommended: 'Recommended for this location', other: 'Other options', viewService: 'View service',
    back: 'Back', dismiss: 'Close details', chooser: 'Services at this location',
    resetMap: 'Reset map', interact: 'Tap to interact', done: 'Done', mapLabel: 'Service locations',
    unplotted: 'Available in the directory without a map pin', coordinatesUnavailable: 'Map location unavailable',
    website: 'Service website', email: 'Email', phone: 'Phone', hiddenContact: 'Not provided',
    needsPostal: 'Enter a postal code to see the enquiry contact', unavailableContact: 'Temporarily unavailable',
    enquiry: 'ICCP enquiry for this location', disclaimer: 'Recommendations do not confirm eligibility, capacity or admission.',
    evaluationMessages: {
        none: 'Enter a postal code to find recommendations for this location.',
        'inside-region': 'Recommendations are shown for the entered location.',
        'outside-region': 'This location is outside the area covered by this directory. Other options are still shown.',
        'coverage-unconfirmed': 'Coverage for this location is not confirmed. Contact the service to enquire.',
        'postal-unresolved': 'This postal code could not be located. Check it and try again.',
    },
};
export function regionalDiscoveryCopy(copy = {}) {
    return { ...REGIONAL_DISCOVERY_COPY, ...copy,
        evaluationMessages: { ...REGIONAL_DISCOVERY_COPY.evaluationMessages, ...copy.evaluationMessages } };
}
