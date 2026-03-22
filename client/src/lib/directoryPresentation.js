import { getDistance } from './geo.js';

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function parseCoordinate(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function stripSingaporeSuffix(address) {
    return String(address || '')
        .replace(/\s+/g, ' ')
        .replace(/\bSingapore\b\s*\d{5,6}$/i, '')
        .replace(/\bS(?:ingapore)?\s*\d{5,6}$/i, '')
        .replace(/\s*,\s*$/g, '')
        .trim();
}

function formatStreetLabel(address) {
    const compact = stripSingaporeSuffix(address);
    if (!compact) return '';

    const firstSegment = compact.split(',')[0]?.trim() || compact;
    if (firstSegment.length <= 52) {
        return firstSegment;
    }

    return `${firstSegment.slice(0, 49).trimEnd()}...`;
}

function buildPlaceQueryText(place, row) {
    return [
        place.name,
        place.address,
        row.name,
        row.subCategory,
        row.bucket,
        row.descriptor,
        row.status === 'list_only' ? 'list only not shown on map' : '',
        row.resourceType === 'hard' ? 'place' : 'offering',
    ]
        .map(normalizeText)
        .join(' ');
}

function buildUnmappedRowQueryText(row) {
    return [
        row.name,
        row.subCategory,
        row.bucket,
        row.descriptor,
        row.contextLabel,
        row.locationLabel,
        row.status === 'list_only' ? 'list only not shown on map' : '',
        row.resourceType === 'hard' ? 'place' : 'offering',
    ]
        .map(normalizeText)
        .join(' ');
}

function sortPinsForReadingOrder(pins) {
    if (!pins.length) return [];

    const latitudes = pins.map((pin) => pin.lat);
    const latRange = Math.max(...latitudes) - Math.min(...latitudes);
    const rowTolerance = Math.max(latRange * 0.12, 0.0012);

    return [...pins].sort((left, right) => {
        const leftLat = parseCoordinate(left.lat) ?? 0;
        const rightLat = parseCoordinate(right.lat) ?? 0;
        const latDelta = rightLat - leftLat;

        if (Math.abs(latDelta) > rowTolerance) {
            return latDelta;
        }

        const leftLng = parseCoordinate(left.lng) ?? 0;
        const rightLng = parseCoordinate(right.lng) ?? 0;
        if (leftLng !== rightLng) {
            return leftLng - rightLng;
        }

        return String(left.title || left.placeKey || '').localeCompare(String(right.title || right.placeKey || ''));
    });
}

function buildPlaceNumberByKey(pins) {
    return sortPinsForReadingOrder(pins).reduce((accumulator, pin, index) => {
        accumulator[pin.placeKey] = index + 1;
        return accumulator;
    }, {});
}

function buildDistanceLabel(distanceKm) {
    if (!Number.isFinite(distanceKm)) return null;
    return distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`;
}

function buildAnchorNote(anchor) {
    if (!anchor) return '';
    if (anchor.kind === 'home') {
        return anchor.address
            ? `Distances shown from Home (${formatStreetLabel(anchor.address)})`
            : 'Distances shown from Home';
    }

    if (anchor.address) {
        return `Distances shown from ${formatStreetLabel(anchor.address)}`;
    }

    if (anchor.postalCode) {
        return `Distances shown from postal code ${anchor.postalCode}`;
    }

    return 'Distances shown from set location';
}

function splitMappedGroupsIntoColumns(groups) {
    if (!groups.length) {
        return { leftGroups: [], rightGroups: [] };
    }

    const sortedGroups = [...groups].sort((left, right) => left.number - right.number);
    const midpoint = Math.ceil(sortedGroups.length / 2);
    return {
        leftGroups: sortedGroups.slice(0, midpoint),
        rightGroups: sortedGroups.slice(midpoint),
    };
}

export function buildDirectoryPresentation(directory, {
    query = '',
    activeAnchor = null,
} = {}) {
    const placeNumberByKey = buildPlaceNumberByKey(directory?.pins || []);
    const normalizedQuery = normalizeText(query);
    const mappedGroups = [];
    const unmappedRows = [];

    for (const place of directory?.places || []) {
        const number = placeNumberByKey[place.placeKey] || null;
        const lat = parseCoordinate(place.lat);
        const lng = parseCoordinate(place.lng);
        const hasCoordinates = Boolean(place.hasCoordinates && lat !== null && lng !== null && number !== null);
        const distanceKm = activeAnchor && hasCoordinates
            ? getDistance(activeAnchor.lat, activeAnchor.lng, lat, lng)
            : null;

        const preparedRows = (place.rows || []).map((row) => ({
            ...row,
            placeKey: place.placeKey,
            placeName: place.name,
            shortLocationLine: formatStreetLabel(place.address),
            locationLabel: formatStreetLabel(place.address) || place.name,
        }));

        if (hasCoordinates) {
            const visibleRows = normalizedQuery
                ? preparedRows.filter((row) => buildPlaceQueryText(place, row).includes(normalizedQuery))
                : preparedRows;

            if (!visibleRows.length) {
                continue;
            }

            mappedGroups.push({
                ...place,
                lat,
                lng,
                number,
                hasCoordinates: true,
                shortLocationLine: formatStreetLabel(place.address),
                distanceKm,
                distanceLabel: buildDistanceLabel(distanceKm),
                rows: visibleRows,
                curatedCount: visibleRows.length,
            });
            continue;
        }

        const preparedUnmappedRows = preparedRows.map((row) => ({
            ...row,
            contextLabel: place.name && normalizeText(place.name) !== normalizeText(row.name) ? place.name : null,
            locationLabel: formatStreetLabel(place.address) || null,
        }));
        const visibleUnmappedRows = normalizedQuery
            ? preparedUnmappedRows.filter((row) => buildUnmappedRowQueryText(row).includes(normalizedQuery))
            : preparedUnmappedRows;

        unmappedRows.push(...visibleUnmappedRows);
    }

    const orderedMappedGroups = [...mappedGroups].sort((left, right) => left.number - right.number);
    const { leftGroups, rightGroups } = splitMappedGroupsIntoColumns(orderedMappedGroups);
    const visiblePlaceKeys = new Set(orderedMappedGroups.map((group) => group.placeKey));
    const pins = (directory?.pins || [])
        .filter((pin) => visiblePlaceKeys.has(pin.placeKey))
        .map((pin) => ({
            ...pin,
            number: placeNumberByKey[pin.placeKey] || null,
        }));

    return {
        pins,
        mappedGroups: orderedMappedGroups,
        leftGroups,
        rightGroups,
        unmappedRows: unmappedRows.sort((left, right) => left.name.localeCompare(right.name)),
        placeNumberByKey,
        activeAnchor,
        activeAnchorNote: buildAnchorNote(activeAnchor),
        hasActiveAnchor: Boolean(activeAnchor),
    };
}

export function buildDirectoryShareUrl(sharePath) {
    if (!sharePath) return '';
    if (typeof window === 'undefined') return sharePath;
    return new URL(sharePath, window.location.origin).toString();
}
