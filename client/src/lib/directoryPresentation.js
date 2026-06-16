import { getDistance } from './geo.js';
import {
    computePostalGroupAnchor,
    groupItemsByPostalCode,
    resolvePostalGroupCode,
} from './postalGrouping.js';

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
    const jalanMatch = firstSegment.match(/^(\d+[A-Z]?\s+(?:jalan|lorong)\s+[a-z0-9'()./-]+(?:\s+[a-z0-9'()./-]+){0,3})/i);
    if (jalanMatch?.[1]) {
        return jalanMatch[1];
    }

    const roadTypeMatch = firstSegment.match(
        /^(.+?\b(?:avenue|ave|street|st|road|rd|drive|dr|lane|ln|way|walk|close|crescent|cres|boulevard|blvd|place|court|terrace|view|central|heights|rise|link|track|loop|grove|gardens|park)\b(?:\s+\d+[A-Z]?)?)/i
    );
    if (roadTypeMatch?.[1]) {
        return roadTypeMatch[1];
    }

    const trimmed = firstSegment.split(/\s+/).slice(0, 5).join(' ');
    if (trimmed.length <= 42) {
        return trimmed;
    }

    return `${trimmed.slice(0, 39).trimEnd()}...`;
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

function compareText(left, right) {
    return String(left || '').localeCompare(String(right || ''), undefined, {
        sensitivity: 'base',
        numeric: true,
    });
}

function getRowCategoryLabel(row = {}) {
    return row.subCategory || row.bucket || (row.resourceType === 'soft' ? 'Programme/service' : 'Place');
}

function getGroupCategoryLabel(group = {}) {
    const hardRow = (group.rows || []).find((row) => row.resourceType === 'hard');
    return getRowCategoryLabel(hardRow || (group.rows || [])[0] || {});
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

const DESKTOP_UNMAPPED_DOCK_GROUP_THRESHOLD = 7;
const DESKTOP_UNMAPPED_DOCK_ROW_THRESHOLD = 9;

function getGroupCardWeight(groups = []) {
    return groups.reduce(
        (total, group) => total + 1 + Math.max((group.rows || []).length - 1, 0) * 0.35,
        0,
    );
}

export function shouldDockDesktopUnmappedRows(mappedGroups = []) {
    const visibleRowCount = mappedGroups.reduce(
        (count, group) => count + (group.rows || []).length,
        0,
    );

    return mappedGroups.length >= DESKTOP_UNMAPPED_DOCK_GROUP_THRESHOLD
        || visibleRowCount >= DESKTOP_UNMAPPED_DOCK_ROW_THRESHOLD;
}

export function buildDesktopUnmappedLayout({
    mappedGroups = [],
    leftGroups = [],
    rightGroups = [],
    unmappedRows = [],
} = {}) {
    if (!unmappedRows.length) {
        return {
            placement: 'none',
            leftUnmappedRows: [],
            rightUnmappedRows: [],
            dockedUnmappedRows: [],
        };
    }

    if (shouldDockDesktopUnmappedRows(mappedGroups)) {
        return {
            placement: 'map-column',
            leftUnmappedRows: [],
            rightUnmappedRows: [],
            dockedUnmappedRows: unmappedRows,
        };
    }

    const leftUnmappedRows = [];
    const rightUnmappedRows = [];
    let leftWeight = getGroupCardWeight(leftGroups);
    let rightWeight = getGroupCardWeight(rightGroups);

    unmappedRows.forEach((row) => {
        if (leftWeight <= rightWeight) {
            leftUnmappedRows.push(row);
            leftWeight += 1;
            return;
        }

        rightUnmappedRows.push(row);
        rightWeight += 1;
    });

    return {
        placement: 'side-lanes',
        leftUnmappedRows,
        rightUnmappedRows,
        dockedUnmappedRows: [],
    };
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

function splitDisplayGroupsIntoColumns(groups) {
    if (!groups.length) {
        return { leftGroups: [], rightGroups: [] };
    }

    const midpoint = Math.ceil(groups.length / 2);
    return {
        leftGroups: groups.slice(0, midpoint),
        rightGroups: groups.slice(midpoint),
    };
}

function sortNestedPlaces(places = []) {
    return [...places]
        .map((place) => ({
            ...place,
            rows: [...(place.rows || [])].sort((left, right) => left.name.localeCompare(right.name)),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
}

function buildGroupedMappedGroups(mappedGroups = []) {
    const { groups } = groupItemsByPostalCode(mappedGroups, {
        getItemKey: (group) => group.placeKey,
        resolvePostalCode: (group) => resolvePostalGroupCode({
            postalCode: group.postalCode,
            address: group.address,
        }),
    });

    return groups.map((postalGroup) => {
        if (!postalGroup.isPostalGroup) {
            return {
                ...postalGroup.members[0],
                postalCode: postalGroup.postalCode || resolvePostalGroupCode({
                    postalCode: postalGroup.members[0]?.postalCode,
                    address: postalGroup.members[0]?.address,
                }),
                memberPlaceKeys: [postalGroup.members[0]?.placeKey].filter(Boolean),
                isPostalGroup: false,
            };
        }

        const members = sortNestedPlaces(postalGroup.members);
        const anchor = computePostalGroupAnchor(members);
        const firstMember = members[0] || null;
        const combinedCuratedCount = members.reduce((total, member) => total + (member.curatedCount || 0), 0);

        return {
            placeKey: postalGroup.postalGroupKey,
            placeId: null,
            name: firstMember?.name || 'Grouped location',
            address: firstMember?.address || null,
            postalCode: postalGroup.postalCode,
            lat: anchor.lat,
            lng: anchor.lng,
            hasCoordinates: anchor.lat !== null && anchor.lng !== null,
            shortLocationLine: firstMember?.shortLocationLine || '',
            distanceKm: firstMember?.distanceKm ?? null,
            distanceLabel: firstMember?.distanceLabel ?? null,
            curatedCount: combinedCuratedCount,
            rows: [],
            nestedPlaces: members,
            memberPlaceKeys: members.map((member) => member.placeKey).filter(Boolean),
            isPostalGroup: true,
        };
    });
}

function buildGroupedPins(groups = []) {
    return groups
        .filter((group) => group.hasCoordinates && group.lat !== null && group.lng !== null)
        .map((group) => {
            if (!group.isPostalGroup) {
                return {
                    pinKey: group.placeKey,
                    placeKey: group.placeKey,
                    placeId: group.placeId,
                    title: group.name,
                    address: group.address,
                    postalCode: group.postalCode || '',
                    lat: group.lat,
                    lng: group.lng,
                    curatedCount: group.curatedCount,
                    categoryIconUrl: group.rows.find((row) => row.resourceType === 'hard' && row.categoryIconUrl)?.categoryIconUrl
                        || group.rows.find((row) => row.categoryIconUrl)?.categoryIconUrl
                        || null,
                    previewResourceNames: (group.rows || []).slice(0, 3).map((row) => row.name),
                    hiddenPreviewCount: Math.max(0, (group.rows || []).length - 3),
                    isPostalGroup: false,
                    memberPlaceKeys: [group.placeKey],
                };
            }

            return {
                pinKey: group.placeKey,
                placeKey: group.placeKey,
                placeId: null,
                title: `${group.memberPlaceKeys.length} assets`,
                address: group.address,
                postalCode: group.postalCode,
                lat: group.lat,
                lng: group.lng,
                curatedCount: group.curatedCount,
                categoryIconUrl: null,
                previewResourceNames: group.nestedPlaces.map((place) => place.name).slice(0, 3),
                hiddenPreviewCount: Math.max(0, group.nestedPlaces.length - 3),
                isPostalGroup: true,
                postalGroupCount: group.memberPlaceKeys.length,
                memberPlaceKeys: [...group.memberPlaceKeys],
            };
        });
}

function buildUnmappedDisplayGroup(row, index) {
    const placeKey = `unmapped:${row.rowKey || row.assetKey || index}`;
    const categoryLabel = getRowCategoryLabel(row);

    return {
        placeKey,
        placeId: null,
        name: row.name || row.placeName || 'Resource not shown on map',
        address: row.locationLabel || row.contextLabel || null,
        postalCode: '',
        lat: null,
        lng: null,
        hasCoordinates: false,
        shortLocationLine: row.locationLabel || row.contextLabel || '',
        distanceKm: null,
        distanceLabel: null,
        curatedCount: 1,
        rows: [{ ...row, placeKey }],
        nestedPlaces: [],
        memberPlaceKeys: [placeKey],
        isPostalGroup: false,
        isUnmappedGroup: true,
        categoryLabel,
        categorySortKey: normalizeText(categoryLabel),
        resourceSortKey: normalizeText(row.name || row.placeName || ''),
    };
}

function decorateV2MappedGroup(group) {
    const categoryLabel = getGroupCategoryLabel(group);
    return {
        ...group,
        memberPlaceKeys: [group.placeKey].filter(Boolean),
        isPostalGroup: false,
        isUnmappedGroup: false,
        categoryLabel,
        categorySortKey: normalizeText(categoryLabel),
        resourceSortKey: normalizeText(group.name),
    };
}

function compareV2DisplayGroups(left, right) {
    const leftMapRank = left.hasCoordinates ? 0 : 1;
    const rightMapRank = right.hasCoordinates ? 0 : 1;
    if (leftMapRank !== rightMapRank) {
        return leftMapRank - rightMapRank;
    }

    const categoryCompare = compareText(left.categorySortKey || left.categoryLabel, right.categorySortKey || right.categoryLabel);
    if (categoryCompare !== 0) return categoryCompare;

    const resourceCompare = compareText(left.resourceSortKey || left.name, right.resourceSortKey || right.name);
    if (resourceCompare !== 0) return resourceCompare;

    return compareText(left.placeKey, right.placeKey);
}

function buildHoverPlaceKeysByKey(groups = []) {
    const groupsByPostal = new Map();

    groups.forEach((group) => {
        const postalCode = resolvePostalGroupCode({
            postalCode: group.postalCode,
            address: group.address,
        });
        if (!postalCode || !group.hasCoordinates || !group.placeKey) return;
        const members = groupsByPostal.get(postalCode) || [];
        members.push(String(group.placeKey));
        groupsByPostal.set(postalCode, members);
    });

    const hoverPlaceKeysByKey = {};
    groupsByPostal.forEach((placeKeys) => {
        if (placeKeys.length <= 1) return;
        placeKeys.forEach((placeKey) => {
            hoverPlaceKeysByKey[placeKey] = [...placeKeys];
        });
    });

    return hoverPlaceKeysByKey;
}

function buildV2DirectoryPresentation({ mappedGroups = [], unmappedRows = [], activeAnchor = null }) {
    const orderedMappedGroups = mappedGroups
        .map(decorateV2MappedGroup)
        .sort(compareV2DisplayGroups);
    const orderedUnmappedRows = [...unmappedRows].sort((left, right) => {
        const categoryCompare = compareText(getRowCategoryLabel(left), getRowCategoryLabel(right));
        if (categoryCompare !== 0) return categoryCompare;
        return compareText(left.name, right.name);
    });
    const unmappedDisplayGroups = orderedUnmappedRows.map(buildUnmappedDisplayGroup);
    const displayGroups = [...orderedMappedGroups, ...unmappedDisplayGroups]
        .sort(compareV2DisplayGroups)
        .map((group, index) => ({
            ...group,
            number: index + 1,
        }));
    const displayGroupByKey = displayGroups.reduce((accumulator, group) => {
        accumulator[group.placeKey] = group;
        return accumulator;
    }, {});
    const pins = buildGroupedPins(orderedMappedGroups).map((pin) => ({
        ...pin,
        number: displayGroupByKey[pin.placeKey]?.number || null,
    }));
    const placeNumberByKey = displayGroups.reduce((accumulator, group) => {
        accumulator[group.placeKey] = group.number;
        return accumulator;
    }, {});
    const groupKeyByPlaceKey = displayGroups.reduce((accumulator, group) => {
        accumulator[group.placeKey] = group.placeKey;
        return accumulator;
    }, {});
    const { leftGroups, rightGroups } = splitDisplayGroupsIntoColumns(displayGroups);

    return {
        pins,
        mappedGroups: orderedMappedGroups.map((group) => ({
            ...group,
            number: displayGroupByKey[group.placeKey]?.number || null,
        })),
        displayGroups,
        leftGroups,
        rightGroups,
        unmappedRows: orderedUnmappedRows,
        desktopUnmappedPlacement: 'none',
        leftUnmappedRows: [],
        rightUnmappedRows: [],
        dockedUnmappedRows: [],
        placeNumberByKey,
        groupKeyByPlaceKey,
        hoverPlaceKeysByKey: buildHoverPlaceKeysByKey(orderedMappedGroups),
        activeAnchor,
        activeAnchorNote: buildAnchorNote(activeAnchor),
        hasActiveAnchor: Boolean(activeAnchor),
        noteMappedGroups: orderedMappedGroups,
        noteUnmappedRows: orderedUnmappedRows,
        integratesUnmappedRowsAsCards: true,
        showCategoryPills: true,
    };
}

export function buildDirectoryPresentation(directory, {
    query = '',
    activeAnchor = null,
    presentationMode = 'default',
} = {}) {
    const normalizedQuery = normalizeText(query);
    const mappedGroups = [];
    const unmappedRows = [];

    for (const place of directory?.places || []) {
        const lat = parseCoordinate(place.lat);
        const lng = parseCoordinate(place.lng);
        const hasCoordinates = Boolean(place.hasCoordinates && lat !== null && lng !== null);
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
                hasCoordinates: true,
                shortLocationLine: formatStreetLabel(place.address),
                distanceKm,
                distanceLabel: buildDistanceLabel(distanceKm),
                rows: visibleRows,
                curatedCount: visibleRows.length,
                postalCode: resolvePostalGroupCode({
                    postalCode: place.postalCode,
                    address: place.address,
                }),
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

    if (presentationMode === 'v2-cards') {
        return buildV2DirectoryPresentation({
            mappedGroups,
            unmappedRows,
            activeAnchor,
        });
    }

    const groupedMappedGroups = buildGroupedMappedGroups(mappedGroups);
    const groupedPins = buildGroupedPins(groupedMappedGroups);
    const placeNumberByGroupKey = buildPlaceNumberByKey(groupedPins);
    const groupKeyByPlaceKey = {};

    groupedMappedGroups.forEach((group) => {
        groupKeyByPlaceKey[group.placeKey] = group.placeKey;
        if (group.isPostalGroup) {
            group.memberPlaceKeys.forEach((memberPlaceKey) => {
                groupKeyByPlaceKey[memberPlaceKey] = group.placeKey;
            });
        }
    });

    const placeNumberByKey = groupedMappedGroups.reduce((accumulator, group) => {
        const number = placeNumberByGroupKey[group.placeKey] || null;
        accumulator[group.placeKey] = number;
        if (group.isPostalGroup) {
            group.memberPlaceKeys.forEach((memberPlaceKey) => {
                accumulator[memberPlaceKey] = number;
            });
        }
        return accumulator;
    }, {});

    const orderedMappedGroups = [...groupedMappedGroups]
        .map((group) => ({
            ...group,
            number: placeNumberByKey[group.placeKey] || null,
        }))
        .sort((left, right) => left.number - right.number);
    const orderedUnmappedRows = unmappedRows.sort((left, right) => (left.name || '').localeCompare(right.name || ''));
    const { leftGroups, rightGroups } = splitMappedGroupsIntoColumns(orderedMappedGroups);
    const desktopUnmappedLayout = buildDesktopUnmappedLayout({
        mappedGroups: orderedMappedGroups,
        leftGroups,
        rightGroups,
        unmappedRows: orderedUnmappedRows,
    });
    const visiblePlaceKeys = new Set(orderedMappedGroups.map((group) => group.placeKey));
    const pins = groupedPins
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
        unmappedRows: orderedUnmappedRows,
        desktopUnmappedPlacement: desktopUnmappedLayout.placement,
        leftUnmappedRows: desktopUnmappedLayout.leftUnmappedRows,
        rightUnmappedRows: desktopUnmappedLayout.rightUnmappedRows,
        dockedUnmappedRows: desktopUnmappedLayout.dockedUnmappedRows,
        placeNumberByKey,
        groupKeyByPlaceKey,
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
