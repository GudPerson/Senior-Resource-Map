import { getDistance } from './geo.js';
import { buildMyMapCategoryRank, normalizeMyMapCategoryKey } from './myMapCategoryOrder.js';
import {
    computePostalGroupAnchor,
    groupItemsByPostalCode,
    resolvePostalGroupCode,
} from './postalGrouping.js';

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizePlaceKeyList(values = []) {
    const keys = [];
    const seen = new Set();

    (Array.isArray(values) ? values : []).forEach((value) => {
        const key = String(value || '').trim();
        if (!key || seen.has(key)) return;
        keys.push(key);
        seen.add(key);
    });

    return keys;
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

function formatLocationLabel(address) {
    const streetLabel = formatStreetLabel(address);
    if (streetLabel) return streetLabel;

    const postalCode = resolvePostalGroupCode({ address });
    return postalCode ? `Singapore ${postalCode}` : '';
}

function buildPlaceQueryText(place, row) {
    return [
        place.name,
        place.address,
        row.address,
        row.name,
        row.subCategory,
        row.bucket,
        row.descriptor,
        row.mapShortDescriptor,
        row.status === 'list_only' ? 'list only not shown on map' : '',
        row.resourceType === 'personal_place' ? 'personal place' : (row.resourceType === 'hard' ? 'place' : 'offering'),
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
        row.mapShortDescriptor,
        row.contextLabel,
        row.locationLabel,
        row.status === 'list_only' ? 'list only not shown on map' : '',
        row.resourceType === 'personal_place' ? 'personal place' : (row.resourceType === 'hard' ? 'place' : 'offering'),
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

function hasMapCategory(row = {}) {
    return Boolean(row.mapSubCategory || row.mapCategoryLabel || row.mapIconKey || row.mapCategoryColor || row.mapCategoryIconUrl);
}

function getRowCategoryLabel(row = {}, { preferMapCategory = false } = {}) {
    if (preferMapCategory && hasMapCategory(row)) {
        return row.mapSubCategory || row.mapCategoryLabel || row.subCategory || row.bucket || (row.resourceType === 'personal_place' ? 'Personal place' : (row.resourceType === 'soft' ? 'Programme/service' : 'Place'));
    }

    return row.subCategory || row.bucket || (row.resourceType === 'personal_place' ? 'Personal place' : (row.resourceType === 'soft' ? 'Programme/service' : 'Place'));
}

function getGroupCategoryLabel(group = {}, options = {}) {
    const hardRow = (group.rows || []).find((row) => row.resourceType === 'hard');
    return getRowCategoryLabel(hardRow || (group.rows || [])[0] || {}, options);
}

function normalizeCategoryColor(value) {
    const text = String(value || '').trim();
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) ? text : '';
}

function getRowCategoryKey(row = {}, options = {}) {
    if (options.preferMapCategory && hasMapCategory(row)) {
        return row.mapIconKey || normalizeText(getRowCategoryLabel(row, options));
    }

    return row.iconKey || normalizeText(getRowCategoryLabel(row, options));
}

function getCategoryEntriesForRows(rows = [], options = {}) {
    const entriesByKey = new Map();

    rows.forEach((row) => {
        const useMapCategory = Boolean(options.preferMapCategory && hasMapCategory(row));
        const key = getRowCategoryKey(row, options);
        if (!key || entriesByKey.has(key)) return;

        entriesByKey.set(key, {
            key,
            label: getRowCategoryLabel(row, options),
            color: normalizeCategoryColor(useMapCategory ? (row.mapCategoryColor || row.categoryColor) : row.categoryColor),
            iconUrl: useMapCategory ? (row.mapCategoryIconUrl || row.categoryIconUrl || null) : (row.categoryIconUrl || null),
            iconKey: useMapCategory ? (row.mapCategoryIconKey || row.categoryIconKey || null) : (row.categoryIconKey || null),
        });
    });

    return [...entriesByKey.values()];
}

function getPrimaryCategoryEntry(rows = [], options = {}) {
    const hardRow = rows.find((row) => row.resourceType === 'hard');
    const sourceRow = hardRow || rows[0] || {};
    const [entry] = getCategoryEntriesForRows([sourceRow], options);
    if (entry) return entry;

    return {
        key: '',
        label: getRowCategoryLabel(sourceRow, options),
        color: '',
        iconUrl: null,
        iconKey: null,
    };
}

function isListOnlyGroupRow(row = {}) {
    const assetMode = normalizeText(row.assetMode || row.asset_mode);
    const bucket = normalizeText(row.bucket);
    const subCategory = normalizeText(row.subCategory || row.sub_category);

    return assetMode === 'group'
        || bucket === 'group'
        || bucket === 'groups'
        || subCategory === 'group'
        || Boolean(row.mapFocusPlaceKeys?.length);
}

function getGroupCategoryEntries(group = {}, options = {}) {
    if (group.isPostalGroup && Array.isArray(group.nestedPlaces)) {
        return getCategoryEntriesForRows(group.nestedPlaces.flatMap((place) => place.rows || []), options);
    }

    return getCategoryEntriesForRows(group.rows || [], options);
}

function getCategoryBubbleItemsForGroup(group = {}, options = {}) {
    const groups = group.isPostalGroup && Array.isArray(group.nestedPlaces)
        ? group.nestedPlaces
        : [group];

    return groups
        .map((member) => {
            const rows = member.rows || [];
            const entry = getPrimaryCategoryEntry(rows, options);
            return {
                placeKey: member.placeKey,
                color: entry.color || null,
                iconUrl: entry.iconUrl || null,
                iconKey: entry.iconKey || null,
                label: member.name || '',
                isPersonalPlace: rows.some((row) => row?.resourceType === 'personal_place'),
            };
        })
        .filter((item) => item.placeKey);
}

function getGroupHardRows(group = {}) {
    const rows = group.isPostalGroup && Array.isArray(group.nestedPlaces)
        ? group.nestedPlaces.flatMap((place) => place.rows || [])
        : (group.rows || []);

    return rows.filter((row) => row.resourceType === 'hard');
}

function buildHardCategoryEntriesByPostal(groups = []) {
    const rowsByPostal = new Map();

    groups.forEach((group) => {
        const postalCode = resolvePostalGroupCode({
            postalCode: group.postalCode,
            address: group.address,
        });
        if (!postalCode || !group.hasCoordinates) return;

        const hardRows = getGroupHardRows(group);
        if (!hardRows.length) return;

        rowsByPostal.set(postalCode, [
            ...(rowsByPostal.get(postalCode) || []),
            ...hardRows,
        ]);
    });

    const entriesByPostal = new Map();
    rowsByPostal.forEach((rows, postalCode) => {
        entriesByPostal.set(postalCode, getCategoryEntriesForRows(rows));
    });

    return entriesByPostal;
}

function getPinCategoryEntries(group = {}, { hardCategoryEntriesByPostal = null, hardRowsOnly = false, preferMapCategory = false } = {}) {
    const postalCode = resolvePostalGroupCode({
        postalCode: group.postalCode,
        address: group.address,
    });
    const postalHardEntries = postalCode ? hardCategoryEntriesByPostal?.get(postalCode) : null;
    if (postalHardEntries?.length) return postalHardEntries;

    if (hardRowsOnly) {
        const hardEntries = getCategoryEntriesForRows(getGroupHardRows(group));
        if (hardEntries.length) return hardEntries;
    }

    return getGroupCategoryEntries(group, { preferMapCategory });
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
    if (anchor.kind === 'current') {
        return 'Distances shown from your current location';
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
        return { leftGroups: [], rightGroups: [], mapColumnGroups: [] };
    }

    const mapColumnGroups = groups.filter((group) => (
        group.isUnmappedGroup && group.mapFocusPlaceKeys?.length
    ));
    const sideGroups = groups.filter((group) => !mapColumnGroups.includes(group));
    const midpoint = Math.ceil(sideGroups.length / 2);
    return {
        leftGroups: sideGroups.slice(0, midpoint),
        rightGroups: sideGroups.slice(midpoint),
        mapColumnGroups,
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

function buildGroupedPins(groups = [], options = {}) {
    return groups
        .filter((group) => group.hasCoordinates && group.lat !== null && group.lng !== null)
        .map((group) => {
            const categoryEntries = getPinCategoryEntries(group, options);
            const primaryCategoryEntry = getPrimaryCategoryEntry(group.rows || [], options);
            const categoryColorSegments = categoryEntries
                .map((entry) => entry.color)
                .filter(Boolean);

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
                    categoryKey: normalizeMyMapCategoryKey(primaryCategoryEntry.label),
                    categoryIconUrl: primaryCategoryEntry.iconUrl
                        || group.rows.find((row) => row.categoryIconUrl)?.categoryIconUrl
                        || null,
                    categoryIconKey: primaryCategoryEntry.iconKey
                        || group.rows.find((row) => row.categoryIconKey)?.categoryIconKey
                        || null,
                    categoryColor: primaryCategoryEntry.color || categoryColorSegments[0] || null,
                    categoryColorSegments,
                    categoryBubbleItems: getCategoryBubbleItemsForGroup(group, options),
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
                categoryKey: normalizeMyMapCategoryKey(
                    primaryCategoryEntry.label || categoryEntries[0]?.label,
                ),
                categoryIconUrl: null,
                categoryIconKey: null,
                categoryColor: categoryColorSegments[0] || null,
                categoryColorSegments,
                categoryBubbleItems: getCategoryBubbleItemsForGroup(group, options),
                previewResourceNames: group.nestedPlaces.map((place) => place.name).slice(0, 3),
                hiddenPreviewCount: Math.max(0, group.nestedPlaces.length - 3),
                isPostalGroup: true,
                postalGroupCount: group.memberPlaceKeys.length,
                memberPlaceKeys: [...group.memberPlaceKeys],
            };
        });
}

const NUMBERED_PIN_COORDINATE_GROUPING_TOLERANCE = 0.0003;

function normalizeNumberedPinNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
}

function getNumberedPinNumber(group = {}, placeNumberByKey = {}) {
    return normalizeNumberedPinNumber(group.number || placeNumberByKey?.[group.placeKey]);
}

function getNumberedPinColor(group = {}) {
    const rowColor = (group.rows || []).find((row) => row?.categoryColor)?.categoryColor;
    return group.categoryColor || rowColor || null;
}

function getNumberedPinCoordinateKey(group = {}) {
    const lat = Number.parseFloat(group.lat);
    const lng = Number.parseFloat(group.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
    return `${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

function shouldShareNumberedPinCoordinate(left = {}, right = {}) {
    const leftPostal = String(left.postalCode || '').trim();
    const rightPostal = String(right.postalCode || '').trim();
    if (leftPostal && rightPostal && leftPostal === rightPostal) return true;

    const leftLat = Number.parseFloat(left.lat);
    const leftLng = Number.parseFloat(left.lng);
    const rightLat = Number.parseFloat(right.lat);
    const rightLng = Number.parseFloat(right.lng);
    if (![leftLat, leftLng, rightLat, rightLng].every(Number.isFinite)) return false;

    return Math.abs(leftLat - rightLat) <= NUMBERED_PIN_COORDINATE_GROUPING_TOLERANCE
        && Math.abs(leftLng - rightLng) <= NUMBERED_PIN_COORDINATE_GROUPING_TOLERANCE;
}

/**
 * Build the owner-only numbered-pin presentation used by interactive Map Studio
 * and Export View. Resources that resolve to one postal/coordinate location stay
 * grouped at one map anchor while retaining one visible, addressable number lobe
 * per resource card.
 */
export function buildOwnerNumberedPinPresentation(presentation) {
    const displayGroups = presentation?.displayGroups?.length
        ? presentation.displayGroups
        : (presentation?.mappedGroups || []);
    const mappedBadgeGroups = displayGroups.filter((group) => (
        group?.hasCoordinates
        && group.lat !== null
        && group.lng !== null
        && getNumberedPinNumber(group, presentation.placeNumberByKey)
    ));

    const groupsByCoordinate = new Map();
    mappedBadgeGroups.forEach((group) => {
        const coordinateKey = getNumberedPinCoordinateKey(group);
        if (!coordinateKey) return;
        const existingCoordinateEntry = [...groupsByCoordinate.entries()].find(([, groups]) => (
            groups.some((candidate) => shouldShareNumberedPinCoordinate(candidate, group))
        ));
        const resolvedCoordinateKey = existingCoordinateEntry?.[0] || coordinateKey;
        groupsByCoordinate.set(resolvedCoordinateKey, [
            ...(groupsByCoordinate.get(resolvedCoordinateKey) || []),
            group,
        ]);
    });

    const groupKeyByPlaceKey = {};
    const hoverPlaceKeysByKey = {};
    const pins = [...groupsByCoordinate.entries()].map(([coordinateKey, groups]) => {
        const firstGroup = groups[0];
        const firstNumber = getNumberedPinNumber(firstGroup, presentation.placeNumberByKey);
        const memberPlaceKeys = groups.map((group) => group.placeKey).filter(Boolean);
        const compositePlaceKey = groups.length > 1
            ? `print-group:${coordinateKey}`
            : firstGroup.placeKey;

        memberPlaceKeys.forEach((memberPlaceKey) => {
            groupKeyByPlaceKey[memberPlaceKey] = compositePlaceKey;
        });
        if (compositePlaceKey) {
            groupKeyByPlaceKey[compositePlaceKey] = compositePlaceKey;
            hoverPlaceKeysByKey[compositePlaceKey] = memberPlaceKeys;
        }

        return {
            pinKey: groups.length > 1 ? `print:${coordinateKey}` : `print:${firstGroup.placeKey}`,
            placeKey: compositePlaceKey,
            placeId: firstGroup.placeId,
            title: firstGroup.name,
            address: firstGroup.address,
            postalCode: firstGroup.postalCode || '',
            lat: firstGroup.lat,
            lng: firstGroup.lng,
            curatedCount: groups.reduce((total, group) => (
                total + (group.curatedCount || Math.max(1, (group.rows || []).length))
            ), 0),
            categoryKey: normalizeMyMapCategoryKey(
                firstGroup.categorySortKey || firstGroup.categoryLabel,
            ),
            number: firstNumber,
            printNumberLabel: String(firstNumber),
            printBadgeItems: groups.map((group) => {
                const number = getNumberedPinNumber(group, presentation.placeNumberByKey);
                return {
                    number,
                    label: String(number),
                    color: getNumberedPinColor(group),
                    placeKey: group.placeKey,
                    isPersonalPlace: (group.rows || []).some((row) => row?.resourceType === 'personal_place'),
                    categoryKey: normalizeMyMapCategoryKey(
                        group.categorySortKey || group.categoryLabel,
                    ),
                };
            }),
            categoryColor: getNumberedPinColor(firstGroup),
            categoryColorSegments: [],
            previewResourceNames: groups.flatMap((group) => (
                (group.rows || []).slice(0, 1).map((row) => row.name)
            )).slice(0, 3),
            hiddenPreviewCount: Math.max(0, groups.length - 3),
            isPostalGroup: false,
            memberPlaceKeys,
            printOffsetX: 0,
            printOffsetY: 0,
        };
    });

    displayGroups.forEach((group) => {
        if (group?.placeKey && !groupKeyByPlaceKey[group.placeKey]) {
            groupKeyByPlaceKey[group.placeKey] = group.placeKey;
        }
    });

    return {
        ...presentation,
        pins,
        groupKeyByPlaceKey,
        hoverPlaceKeysByKey,
    };
}

function buildUnmappedDisplayGroup(row, index, mappedPlaceKeys = new Set()) {
    const placeKey = `unmapped:${row.rowKey || row.assetKey || index}`;
    const categoryLabel = getRowCategoryLabel(row);
    const categoryEntry = getPrimaryCategoryEntry([row]);
    const mapFocusPlaceKeys = normalizePlaceKeyList(row.mapFocusPlaceKeys)
        .filter((key) => mappedPlaceKeys.has(key));
    const isMapFocusableListGroup = mapFocusPlaceKeys.length > 0;
    const locationLine = isMapFocusableListGroup ? '' : (row.locationLabel || row.contextLabel || '');

    return {
        placeKey,
        placeId: null,
        name: row.name || row.placeName || 'Resource not shown on map',
        address: locationLine || null,
        postalCode: '',
        lat: null,
        lng: null,
        hasCoordinates: false,
        shortLocationLine: locationLine,
        distanceKm: null,
        distanceLabel: null,
        curatedCount: 1,
        rows: [{ ...row, placeKey }],
        nestedPlaces: [],
        memberPlaceKeys: [placeKey, ...mapFocusPlaceKeys],
        mapFocusPlaceKeys,
        isListOnlyGroup: isListOnlyGroupRow(row),
        isPostalGroup: false,
        isUnmappedGroup: true,
        categoryLabel,
        categorySortKey: normalizeText(categoryLabel),
        categoryColor: categoryEntry.color || null,
        categoryIconUrl: categoryEntry.iconUrl || null,
        categoryIconKey: categoryEntry.iconKey || null,
        resourceSortKey: normalizeText(row.name || row.placeName || ''),
    };
}

function decorateV2MappedGroup(group) {
    const categoryLabel = getGroupCategoryLabel(group, { preferMapCategory: true });
    const categoryEntry = getPrimaryCategoryEntry(group.rows || [], { preferMapCategory: true });
    return {
        ...group,
        memberPlaceKeys: [group.placeKey].filter(Boolean),
        isPostalGroup: false,
        isUnmappedGroup: false,
        categoryLabel,
        categorySortKey: normalizeText(categoryLabel),
        categoryColor: categoryEntry.color || null,
        categoryIconUrl: categoryEntry.iconUrl || null,
        categoryIconKey: categoryEntry.iconKey || null,
        resourceSortKey: normalizeText(group.name),
    };
}

function compareV2DisplayGroups(left, right, categoryRank = new Map()) {
    const leftCategoryKey = normalizeMyMapCategoryKey(left.categorySortKey || left.categoryLabel);
    const rightCategoryKey = normalizeMyMapCategoryKey(right.categorySortKey || right.categoryLabel);
    const leftCategoryRank = categoryRank.get(leftCategoryKey);
    const rightCategoryRank = categoryRank.get(rightCategoryKey);
    const leftHasCategoryRank = Number.isInteger(leftCategoryRank);
    const rightHasCategoryRank = Number.isInteger(rightCategoryRank);
    const hasCustomCategoryOrder = categoryRank.size > 0;

    if (hasCustomCategoryOrder) {
        if (leftHasCategoryRank !== rightHasCategoryRank) {
            return leftHasCategoryRank ? -1 : 1;
        }
        if (leftHasCategoryRank && leftCategoryRank !== rightCategoryRank) {
            return leftCategoryRank - rightCategoryRank;
        }

        const categoryCompare = compareText(leftCategoryKey, rightCategoryKey);
        if (categoryCompare !== 0) return categoryCompare;
    } else {
        const leftMapRank = left.hasCoordinates ? 0 : 1;
        const rightMapRank = right.hasCoordinates ? 0 : 1;
        if (leftMapRank !== rightMapRank) {
            return leftMapRank - rightMapRank;
        }

        const categoryCompare = compareText(leftCategoryKey, rightCategoryKey);
        if (categoryCompare !== 0) return categoryCompare;
    }

    const resourceCompare = compareText(left.resourceSortKey || left.name, right.resourceSortKey || right.name);
    if (resourceCompare !== 0) return resourceCompare;

    return compareText(left.placeKey, right.placeKey);
}

function buildMobileDisplayGroups(groups = [], preserveCategoryOrder = false) {
    if (preserveCategoryOrder) return [...groups];

    const listOnlyGroups = [];
    const otherGroups = [];

    groups.forEach((group) => {
        if (group?.isListOnlyGroup) {
            listOnlyGroups.push(group);
            return;
        }
        otherGroups.push(group);
    });

    return [...listOnlyGroups, ...otherGroups];
}

function buildHoverPlaceKeysByKey(groups = [], pinGroups = []) {
    const groupsByPostal = new Map();
    const pinGroupKeyByPostal = new Map();

    pinGroups.forEach((group) => {
        if (!group?.isPostalGroup || !group?.placeKey) return;
        const postalCode = resolvePostalGroupCode({
            postalCode: group.postalCode,
            address: group.address,
        });
        if (postalCode) {
            pinGroupKeyByPostal.set(postalCode, String(group.placeKey));
        }
    });

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
    groupsByPostal.forEach((placeKeys, postalCode) => {
        if (placeKeys.length <= 1) return;
        const postalGroupKey = pinGroupKeyByPostal.get(postalCode);
        if (postalGroupKey) {
            hoverPlaceKeysByKey[postalGroupKey] = [...placeKeys];
        }
        placeKeys.forEach((placeKey) => {
            hoverPlaceKeysByKey[placeKey] = [...placeKeys];
        });
    });

    return hoverPlaceKeysByKey;
}

function buildV2DirectoryPresentation({
    mappedGroups = [],
    unmappedRows = [],
    activeAnchor = null,
    categoryOrder = [],
}) {
    const categoryRank = buildMyMapCategoryRank(categoryOrder);
    const compareDisplayGroups = (left, right) => compareV2DisplayGroups(left, right, categoryRank);
    const orderedMappedGroups = mappedGroups
        .map(decorateV2MappedGroup)
        .sort(compareDisplayGroups);
    const mappedPlaceKeys = new Set(orderedMappedGroups.map((group) => group.placeKey).filter(Boolean));
    const hardCategoryEntriesByPostal = buildHardCategoryEntriesByPostal(orderedMappedGroups);
    const orderedUnmappedRows = [...unmappedRows].sort((left, right) => {
        const categoryCompare = compareText(getRowCategoryLabel(left), getRowCategoryLabel(right));
        if (categoryCompare !== 0) return categoryCompare;
        return compareText(left.name, right.name);
    });
    const unmappedDisplayGroups = orderedUnmappedRows.map((row, index) => (
        buildUnmappedDisplayGroup(row, index, mappedPlaceKeys)
    ));
    const displayGroups = [...orderedMappedGroups, ...unmappedDisplayGroups]
        .sort(compareDisplayGroups)
        .map((group, index) => ({
            ...group,
            number: index + 1,
        }));
    const mobileDisplayGroups = buildMobileDisplayGroups(displayGroups, categoryRank.size > 0);
    const displayGroupByKey = displayGroups.reduce((accumulator, group) => {
        accumulator[group.placeKey] = group;
        return accumulator;
    }, {});
    const pinGroups = buildGroupedMappedGroups(orderedMappedGroups);
    const pins = buildGroupedPins(pinGroups, {
        hardRowsOnly: true,
        hardCategoryEntriesByPostal,
        preferMapCategory: true,
    }).map((pin) => ({
        ...pin,
        number: displayGroupByKey[pin.placeKey]?.number
            || displayGroupByKey[pin.memberPlaceKeys?.[0]]?.number
            || null,
    }));
    const placeNumberByKey = displayGroups.reduce((accumulator, group) => {
        accumulator[group.placeKey] = group.number;
        return accumulator;
    }, {});
    const groupKeyByPlaceKey = displayGroups.reduce((accumulator, group) => {
        accumulator[group.placeKey] = group.placeKey;
        return accumulator;
    }, {});
    const mapFocusPlaceKeysByKey = displayGroups.reduce((accumulator, group) => {
        if (group.mapFocusPlaceKeys?.length) {
            accumulator[group.placeKey] = [...group.mapFocusPlaceKeys];
        }
        return accumulator;
    }, {});
    pinGroups.forEach((group) => {
        if (!group?.placeKey) return;
        groupKeyByPlaceKey[group.placeKey] = group.placeKey;
        if (group.isPostalGroup) {
            (group.memberPlaceKeys || []).forEach((memberPlaceKey) => {
                groupKeyByPlaceKey[memberPlaceKey] = group.placeKey;
            });
        }
    });
    const { leftGroups, rightGroups, mapColumnGroups } = splitDisplayGroupsIntoColumns(displayGroups);

    return {
        pins,
        mappedGroups: orderedMappedGroups.map((group) => ({
            ...group,
            number: displayGroupByKey[group.placeKey]?.number || null,
        })),
        displayGroups,
        mobileDisplayGroups,
        leftGroups,
        rightGroups,
        mapColumnGroups,
        unmappedRows: orderedUnmappedRows,
        desktopUnmappedPlacement: 'none',
        leftUnmappedRows: [],
        rightUnmappedRows: [],
        dockedUnmappedRows: [],
        placeNumberByKey,
        groupKeyByPlaceKey,
        mapFocusPlaceKeysByKey,
        hoverPlaceKeysByKey: buildHoverPlaceKeysByKey(orderedMappedGroups, pinGroups),
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

        const preparedRows = (place.rows || []).map((row) => {
            const rowLocationLine = formatLocationLabel(row.address || place.address);
            return {
                ...row,
                placeKey: place.placeKey,
                placeName: place.name,
                postalCode: resolvePostalGroupCode({
                    postalCode: row.postalCode || place.postalCode,
                    address: row.address || place.address,
                }),
                shortLocationLine: rowLocationLine,
                locationLabel: rowLocationLine || place.name,
            };
        });
        const placeLocationLine = formatLocationLabel(place.address)
            || preparedRows.find((row) => row.shortLocationLine)?.shortLocationLine
            || '';

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
                shortLocationLine: placeLocationLine,
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
            locationLabel: formatLocationLabel(row.address || place.address) || null,
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
            categoryOrder: directory?.categoryOrder,
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
