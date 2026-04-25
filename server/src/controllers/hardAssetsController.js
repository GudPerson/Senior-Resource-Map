import { and, desc, eq, inArray, sql, or, ilike } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { hardAssets, subCategories, users } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { getAssetAudienceZones, resolveStandardAudienceZoneIds } from '../utils/audienceZones.js';
import { actorCanManageAsset, canAssignPartnerOwner } from '../utils/ownership.js';
import { resolveStandardAudiencePartnerIds } from '../utils/partnerBoundaries.js';
import { normalizeRole } from '../utils/roles.js';
import { resolveWritableSubregionByPostal } from '../utils/subregionRouting.js';
import { isAssetVisible } from '../utils/visibility.js';
import { syncAssetTags } from '../utils/tags.js';
import { rebuildMapCache } from '../utils/cacheBuilder.js';
import { loadScopedBoundaryContext, resolvePostalBoundaryStatus } from '../utils/subregionBoundaryStatus.js';
import { resolveOrCreateExternalKey } from '../utils/externalKeys.js';
import { buildEligibilityContext, buildMembershipHostIdMap, getOfferingAccessMetadata } from '../utils/eligibility.js';
import { createMembershipLinkToken } from '../utils/membershipTokens.js';
import { loadMembershipSummariesForAssets } from '../utils/memberships.js';
import { resolveGooglePlacePreview, searchGooglePlaceCandidatesByPostal } from '../utils/googlePlaceImport.js';
import { enrichPlaceCandidatesWithVertex } from '../utils/vertexGroundedPlaceSearch.js';
import { fetchWebsiteMetadata } from '../utils/websiteMetadata.js';

const getCacheRegionId = (...ids) => ids.find((value) => value !== undefined && value !== null && value !== '') || 'all';

const COUNTRY_NAMES = {
    US: 'United States', CA: 'Canada', GB: 'United Kingdom', AU: 'Australia',
    SG: 'Singapore', MY: 'Malaysia', IN: 'India', PH: 'Philippines',
    JP: 'Japan', DE: 'Germany', FR: 'France',
};

function clientError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

async function geocode(postalCode, country) {
    const headers = { 'User-Agent': 'SeniorCareConnect/1.0' };
    const url1 = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(postalCode)}&country=${encodeURIComponent(country)}&format=json&limit=1`;
    const res1 = await fetch(url1, { headers });
    const data1 = await res1.json();
    if (data1.length) {
        return { lat: parseFloat(data1[0].lat), lng: parseFloat(data1[0].lon) };
    }
    const countryName = COUNTRY_NAMES[country] || country;
    const url2 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postalCode + ' ' + countryName)}&format=json&limit=1`;
    const res2 = await fetch(url2, { headers });
    const data2 = await res2.json();
    if (data2.length) {
        return { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) };
    }
    return null;
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizePhone(value) {
    return String(value || '').replace(/[^\d+]/g, '');
}

function parsePositiveNumber(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined;
}

function parseRadiusFilter(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    if (normalizedValue === 'all' || normalizedValue === 'all-sg' || normalizedValue === 'sg') {
        return 'all';
    }
    return parsePositiveNumber(value);
}

function normalizeName(value) {
    return normalizeText(value).toLowerCase();
}

function buildDuplicateMatch(existingAsset, matchReason) {
    return {
        id: existingAsset.id,
        name: existingAsset.name,
        postalCode: existingAsset.postalCode || '',
        address: existingAsset.address || '',
        matchReason,
    };
}

function collectDuplicateMatches(assets, suggestion, googlePlaceId) {
    const normalizedPostalCode = normalizeText(suggestion?.postalCode);
    const normalizedNameValue = normalizeName(suggestion?.name);
    const normalizedPhoneValue = normalizePhone(suggestion?.phone);
    const matches = [];
    const seenIds = new Set();

    for (const asset of assets) {
        let matchReason = '';

        if (googlePlaceId && normalizeText(asset.sourceGooglePlaceId) === googlePlaceId) {
            matchReason = 'same_place_id';
        } else if (
            normalizedPostalCode &&
            normalizedNameValue &&
            normalizeText(asset.postalCode) === normalizedPostalCode &&
            normalizeName(asset.name) === normalizedNameValue
        ) {
            matchReason = 'same_name_postal';
        } else if (
            normalizedPostalCode &&
            normalizedPhoneValue &&
            normalizeText(asset.postalCode) === normalizedPostalCode &&
            normalizePhone(asset.phone) === normalizedPhoneValue
        ) {
            matchReason = 'same_phone_postal';
        }

        if (matchReason && !seenIds.has(asset.id)) {
            matches.push(buildDuplicateMatch(asset, matchReason));
            seenIds.add(asset.id);
        }
    }

    return matches;
}

async function loadManageableHardAssetsForDuplicateChecks(db, user, role) {
    const duplicateOptions = {
        where: eq(hardAssets.isDeleted, false),
        with: {
            partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
        },
    };

    if ((role === 'regional_admin' || role === 'partner') && Array.isArray(user?.subregionIds) && user.subregionIds.length > 0) {
        duplicateOptions.where = and(
            eq(hardAssets.isDeleted, false),
            inArray(hardAssets.subregionId, user.subregionIds),
        );
    }

    const existingAssets = await db.query.hardAssets.findMany(duplicateOptions);
    return existingAssets.filter((asset) => actorCanManageAsset(user, asset, asset.partner));
}

async function loadAvailableHardSubCategories(db) {
    const hardSubCategoryRows = await db.query.subCategories.findMany({
        where: eq(subCategories.type, 'hard'),
    });
    return hardSubCategoryRows.map((item) => item.name);
}

function annotateCandidateDuplicates(candidates, manageableAssets) {
    return (candidates || []).map((candidate) => {
        const existingMatch = collectDuplicateMatches(
            manageableAssets,
            {
                name: candidate.name,
                postalCode: candidate.postalCode,
                address: candidate.address,
                phone: '',
            },
            candidate.googlePlaceId,
        )[0] || null;

        return {
            ...candidate,
            existingMatch,
        };
    });
}

async function loadPartnerUser(db, partnerId) {
    if (!Number.isInteger(partnerId)) return null;

    const partner = await db.query.users.findFirst({
        where: eq(users.id, partnerId),
        columns: {
            id: true,
            name: true,
            username: true,
            role: true,
            managerUserId: true,
        },
        with: {
            subregions: {
                columns: {
                    subregionId: true,
                },
            },
        },
    });

    if (!partner) return null;
    return {
        ...partner,
        role: normalizeRole(partner.role),
        subregionIds: partner.subregions.map((item) => item.subregionId),
    };
}

function normalizeOwnershipMode(actorRole, body) {
    if (actorRole === 'partner') return 'partner';
    if (body.ownershipMode === 'partner' || body.partnerId) return 'partner';
    return 'system';
}

function ensureActorCanCreateInSubregion(actor, subregionId) {
    const role = normalizeRole(actor.role);
    if (role === 'super_admin') return;
    if (!Array.isArray(actor.subregionIds) || !actor.subregionIds.includes(subregionId)) {
        throw clientError('Derived subregion is outside your allowed scope.', 403);
    }
}

async function resolveAssetOwner(db, actor, body, subregionId) {
    const actorRole = normalizeRole(actor.role);
    const ownershipMode = normalizeOwnershipMode(actorRole, body);

    if (actorRole === 'partner') {
        return { ownershipMode: 'partner', owner: actor };
    }

    if (ownershipMode === 'system') {
        return { ownershipMode: 'system', owner: null };
    }

    const partnerId = Number.parseInt(String(body.partnerId ?? ''), 10);
    if (!Number.isInteger(partnerId)) {
        throw clientError('A partner owner is required for partner-owned assets.', 400);
    }

    const owner = await loadPartnerUser(db, partnerId);
    if (!owner || normalizeRole(owner.role) !== 'partner') {
        throw clientError('Selected partner owner was not found.', 404);
    }

    if (!canAssignPartnerOwner(actor, owner, subregionId)) {
        throw clientError('Selected partner owner is outside your allowed scope.', 403);
    }

    return { ownershipMode: 'partner', owner };
}

function formatNestedSoftAsset(asset, viewer, eligibilityContext, membershipHostIdMap) {
    const { parent, tags, audienceZones, ...assetRest } = asset;
    const resolvedAudienceZones = getAssetAudienceZones(asset);
    return {
        ...assetRest,
        tags: asset.tags.map((t) => t.tag.name),
        parentSummary: asset.parent ? { id: asset.parent.id, name: asset.parent.name } : null,
        audienceZones: resolvedAudienceZones,
        audienceZoneIds: resolvedAudienceZones.map((zone) => zone.id),
        ...getOfferingAccessMetadata(asset, viewer, eligibilityContext, membershipHostIdMap),
    };
}

function collectHostedSoftAssets(asset, viewer, allowedPartnerAudienceIds, allowedAudienceZoneIds, eligibilityContext, membershipHostIdMap) {
    const combined = [
        ...(asset.softAssets || []).map((entry) => entry.softAsset),
        ...(asset.hostedSoftAssets || []),
    ];

    const seen = new Set();
    return combined
        .filter((softAsset) => {
            if (!softAsset || seen.has(softAsset.id)) return false;
            seen.add(softAsset.id);
            return isAssetVisible(softAsset, viewer, {
                ownerPartner: softAsset.partner,
                allowedPartnerAudienceIds,
                allowedAudienceZoneIds,
                treatMemberOnlyAsVisible: true,
            });
        })
        .map((softAsset) => formatNestedSoftAsset(softAsset, viewer, eligibilityContext, membershipHostIdMap));
}

function formatHardAsset(asset, boundaryContext, viewer, allowedPartnerAudienceIds, allowedAudienceZoneIds, eligibilityContext, membershipHostIdMap, membershipSummary = null) {
    return {
        ...asset,
        partnerName: asset.partner?.name || null,
        partnerRole: asset.partner?.role ? normalizeRole(asset.partner.role) : null,
        ownershipMode: asset.partnerId ? 'partner' : 'system',
        creatorName: asset.creator?.name || null,
        tags: asset.tags.map((t) => t.tag.name),
        softAssets: collectHostedSoftAssets(asset, viewer, allowedPartnerAudienceIds, allowedAudienceZoneIds, eligibilityContext, membershipHostIdMap),
        boundaryStatus: resolvePostalBoundaryStatus(asset.postalCode, boundaryContext),
        ...(membershipSummary || {}),
    };
}

export const getHardAssets = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const boundaryContext = await loadScopedBoundaryContext(db, user);
        const allowedPartnerAudienceIds = await resolveStandardAudiencePartnerIds(db, user);
        const allowedAudienceZoneIds = await resolveStandardAudienceZoneIds(db, user);

        const page = Math.max(1, Number.parseInt(c.req.query('page') || '1', 10));
        const pageSize = Math.min(500, Math.max(1, Number.parseInt(c.req.query('pageSize') || '50', 10)));
        const offset = (page - 1) * pageSize;
        const query = c.req.query('q');
        const lat = parseFloat(c.req.query('lat'));
        const lng = parseFloat(c.req.query('lng'));
        const radius = parseFloat(c.req.query('radius')); // in km

        const whereClauses = [eq(hardAssets.isDeleted, false)];

        if (user?.role === 'regional_admin' || user?.role === 'partner') {
            if (user.subregionIds && user.subregionIds.length > 0) {
                whereClauses.push(inArray(hardAssets.subregionId, user.subregionIds));
            }
        }

        if (query) {
            whereClauses.push(or(
                ilike(hardAssets.name, `%${query}%`),
                ilike(hardAssets.address, `%${query}%`),
                ilike(hardAssets.postalCode, `%${query}%`),
                ilike(hardAssets.description, `%${query}%`)
            ));
        }

        // Geographic Radius Filtering (Haversine approximation for D1/SQLite)
        if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius)) {
            const earthRadiusKm = 6371;
            whereClauses.push(sql`
                (${earthRadiusKm} * acos(
                    cos(radians(${lat})) * cos(radians(CAST(${hardAssets.lat} AS DECIMAL))) *
                    cos(radians(CAST(${hardAssets.lng} AS DECIMAL)) - radians(${lng})) +
                    sin(radians(${lat})) * sin(radians(CAST(${hardAssets.lat} AS DECIMAL)))
                )) <= ${radius}
            `);
        }

        const finalWhere = and(...whereClauses);

        // Get total count for pagination
        const countResult = await db.select({ count: sql`count(*)` })
            .from(hardAssets)
            .where(finalWhere);
        const totalCount = Number(countResult[0]?.count || 0);

        const options = {
            where: finalWhere,
            with: {
                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                creator: { columns: { id: true, name: true } },
                tags: { with: { tag: true } },
                softAssets: {
                    with: {
                        softAsset: {
                            with: {
                                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                                tags: { with: { tag: true } },
                                parent: {
                                    columns: { id: true, name: true },
                                    with: {
                                        audienceZones: {
                                            with: {
                                                audienceZone: {
                                                    columns: {
                                                        id: true,
                                                        zoneCode: true,
                                                        name: true,
                                                        partnerUserId: true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                                audienceZones: {
                                    with: {
                                        audienceZone: {
                                            columns: {
                                                id: true,
                                                zoneCode: true,
                                                name: true,
                                                partnerUserId: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                hostedSoftAssets: {
                    with: {
                        partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                        tags: { with: { tag: true } },
                        parent: {
                            columns: { id: true, name: true },
                            with: {
                                audienceZones: {
                                    with: {
                                        audienceZone: {
                                            columns: {
                                                id: true,
                                                zoneCode: true,
                                                name: true,
                                                partnerUserId: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        audienceZones: {
                            with: {
                                audienceZone: {
                                    columns: {
                                        id: true,
                                        zoneCode: true,
                                        name: true,
                                        partnerUserId: true,
                                    },
                                        },
                                    },
                                },
                    },
                },
            },
            orderBy: [desc(hardAssets.updatedAt), desc(hardAssets.id)],
            limit: pageSize,
            offset: offset,
        };

        const assets = await db.query.hardAssets.findMany(options);

        const nestedSoftAssets = assets.flatMap((asset) => [
            ...(asset.softAssets || []).map((entry) => entry.softAsset).filter(Boolean),
            ...(asset.hostedSoftAssets || []).filter(Boolean),
        ]);
        const manageableAssetIds = assets
            .filter((asset) => actorCanManageAsset(user, asset, asset.partner))
            .map((asset) => asset.id);
        const eligibilityContext = await buildEligibilityContext(db, user);
        const membershipHostIdMap = await buildMembershipHostIdMap(db, nestedSoftAssets);
        const membershipSummariesByAssetId = await loadMembershipSummariesForAssets(db, manageableAssetIds);
        const formatted = assets
            .filter((asset) => isAssetVisible(asset, user, { ownerPartner: asset.partner }))
            .map((asset) => formatHardAsset(
                asset,
                boundaryContext,
                user,
                allowedPartnerAudienceIds,
                allowedAudienceZoneIds,
                eligibilityContext,
                membershipHostIdMap,
                membershipSummariesByAssetId.get(asset.id) || null,
            ));

        return c.json({
            data: formatted,
            pagination: {
                totalCount,
                page,
                pageSize,
                totalPages: Math.ceil(totalCount / pageSize),
            }
        });
    } catch (err) {
        console.error(err);
        return c.json({ error: err.message || 'Failed to fetch hard assets' }, err.status || 500);
    }
};

export const getHardAssetById = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const allowedPartnerAudienceIds = await resolveStandardAudiencePartnerIds(db, user);
        const allowedAudienceZoneIds = await resolveStandardAudienceZoneIds(db, user);

        const asset = await db.query.hardAssets.findFirst({
            where: eq(hardAssets.id, id),
            with: {
                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                creator: { columns: { id: true, name: true } },
                tags: { with: { tag: true } },
                softAssets: {
                    with: {
                        softAsset: {
                            with: {
                                tags: { with: { tag: true } },
                                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                                parent: {
                                    columns: { id: true, name: true },
                                    with: {
                                        audienceZones: {
                                            with: {
                                                audienceZone: {
                                                    columns: {
                                                        id: true,
                                                        zoneCode: true,
                                                        name: true,
                                                        partnerUserId: true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                                audienceZones: {
                                    with: {
                                        audienceZone: {
                                            columns: {
                                                id: true,
                                                zoneCode: true,
                                                name: true,
                                                partnerUserId: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                hostedSoftAssets: {
                    with: {
                        tags: { with: { tag: true } },
                        partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
                        parent: {
                            columns: { id: true, name: true },
                            with: {
                                audienceZones: {
                                    with: {
                                        audienceZone: {
                                            columns: {
                                                id: true,
                                                zoneCode: true,
                                                name: true,
                                                partnerUserId: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        audienceZones: {
                            with: {
                                audienceZone: {
                                    columns: {
                                        id: true,
                                        zoneCode: true,
                                        name: true,
                                        partnerUserId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!asset || !isAssetVisible(asset, user, { ownerPartner: asset.partner })) {
            return c.json({ error: 'Not found' }, 404);
        }

        const nestedSoftAssets = [
            ...(asset.softAssets || []).map((entry) => entry.softAsset).filter(Boolean),
            ...(asset.hostedSoftAssets || []).filter(Boolean),
        ];
        const eligibilityContext = await buildEligibilityContext(db, user);
        const membershipHostIdMap = await buildMembershipHostIdMap(db, nestedSoftAssets);
        const membershipSummary = actorCanManageAsset(user, asset, asset.partner)
            ? (await loadMembershipSummariesForAssets(db, [asset.id])).get(asset.id) || null
            : null;
        const formatted = {
            ...formatHardAsset(
                asset,
                await loadScopedBoundaryContext(db, user),
                user,
                allowedPartnerAudienceIds,
                allowedAudienceZoneIds,
                eligibilityContext,
                membershipHostIdMap,
                membershipSummary,
            ),
        };

        return c.json(formatted);
    } catch (err) {
        console.error(err);
        return c.json({ error: err.message || 'Failed to fetch hard asset' }, err.status || 500);
    }
};

export const previewGoogleHardAssetImport = async (c) => {
    try {
        const user = c.get('user');
        const role = normalizeRole(user?.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        if (role === 'standard' || role === 'guest') {
            return c.json({ error: 'Insufficient permissions to import places' }, 403);
        }

        const body = await c.req.json();
        const googlePlaceId = normalizeText(body?.googlePlaceId);
        const googleMapsUri = normalizeText(body?.googleMapsUri);
        if (!googlePlaceId) {
            return c.json({ error: 'Google Maps share-link import has been retired. Search by postal code and select a place instead.' }, 400);
        }

        const availableHardSubCategories = await loadAvailableHardSubCategories(db);
        const preview = await resolveGooglePlacePreview(c.env, {
            googlePlaceId,
            googleMapsUri,
        }, availableHardSubCategories);

        const manageableAssets = await loadManageableHardAssetsForDuplicateChecks(db, user, role);
        const duplicateMatches = collectDuplicateMatches(
            manageableAssets,
            preview.suggestion,
            preview.resolvedSource.googlePlaceId,
        );

        return c.json({
            ...preview,
            duplicateMatches,
        });
    } catch (err) {
        console.error(err);
        return c.json({ error: err.message || 'Failed to preview Google place import' }, err.status || 500);
    }
};

export const searchGoogleHardAssetImportCandidates = async (c) => {
    try {
        const user = c.get('user');
        const role = normalizeRole(user?.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        if (role === 'standard' || role === 'guest') {
            return c.json({ error: 'Insufficient permissions to import places' }, 403);
        }

        const body = await c.req.json();
        const postalCode = normalizeText(body?.postalCode);
        const keywordQuery = normalizeText(body?.keywordQuery);
        const radiusKm = parseRadiusFilter(body?.radiusKm);
        const preferredResultCount = parsePositiveNumber(body?.preferredResultCount);
        const enrich = body?.enrich === true;
        if (!postalCode) {
            return c.json({ error: 'postalCode is required' }, 400);
        }

        const availableHardSubCategories = await loadAvailableHardSubCategories(db);
        const result = await searchGooglePlaceCandidatesByPostal(
            c.env,
            postalCode,
            availableHardSubCategories,
            keywordQuery,
            {
                radiusKm,
                preferredResultCount,
                enrich,
            },
        );
        const manageableAssets = await loadManageableHardAssetsForDuplicateChecks(db, user, role);

        return c.json({
            ...result,
            keywordQuery,
            radiusKm: result.radiusKm,
            preferredResultCount: result.preferredResultCount,
            exactCandidates: annotateCandidateDuplicates(result.exactCandidates, manageableAssets),
            nearbyCandidates: annotateCandidateDuplicates(result.nearbyCandidates, manageableAssets),
        });
    } catch (err) {
        console.error(err);
        return c.json({ error: err.message || 'Failed to search Google place candidates' }, err.status || 500);
    }
};

export const createHardAsset = async (c) => {
    try {
        const user = c.get('user');
        const role = normalizeRole(user.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        if (role === 'standard' || role === 'guest') {
            return c.json({ error: 'Insufficient permissions to create resources' }, 403);
        }

        const body = await c.req.json();
        const {
            name,
            country,
            postalCode,
            address,
            phone,
            hours,
            website,
            description,
            logoUrl,
            bannerUrl,
            galleryUrls,
            newTags = [],
            subCategory,
            sourceGooglePlaceId,
            sourceGoogleMapsUri,
            isHidden,
            hideFrom,
            hideUntil,
        } = body;

        if (!name || !country || !postalCode || !address) {
            return c.json({ error: 'name, country, postalCode, address are required' }, 400);
        }

        const derivedRouting = await resolveWritableSubregionByPostal(db, postalCode, user, 'Postal code');
        const derivedSubregion = derivedRouting.subregion;
        ensureActorCanCreateInSubregion(user, derivedSubregion.id);

        const { owner } = await resolveAssetOwner(db, user, body, derivedSubregion.id);
        const coords = await geocode(postalCode, country);
        if (!coords) {
            return c.json({ error: `Could not find location for postal code "${postalCode}" in "${country}".` }, 400);
        }

        const [asset] = await db.insert(hardAssets).values({
            externalKey: await resolveOrCreateExternalKey(db, hardAssets, hardAssets.externalKey, {
                requestedKey: body.externalKey,
                prefix: 'place',
                name,
            }),
            partnerId: owner?.id || null,
            createdByUserId: user.id,
            subregionId: derivedSubregion.id,
            name,
            country,
            postalCode,
            subCategory: subCategory || 'Places',
            lat: coords.lat.toString(),
            lng: coords.lng.toString(),
            address,
            phone: phone || null,
            hours: hours || null,
            website: website || null,
            description: description || null,
            logoUrl: logoUrl || null,
            bannerUrl: bannerUrl || null,
            galleryUrls: galleryUrls || [],
            sourceGooglePlaceId: sourceGooglePlaceId || null,
            sourceGoogleMapsUri: sourceGoogleMapsUri || null,
            isHidden: isHidden || false,
            hideFrom: hideFrom ? new Date(hideFrom) : null,
            hideUntil: hideUntil ? new Date(hideUntil) : null,
        }).returning();

        try {
            await syncAssetTags(db, asset.id, 'hard', newTags);
        } catch (syncError) {
            await db.delete(hardAssets).where(eq(hardAssets.id, asset.id));
            throw syncError;
        }

        await rebuildMapCache(getCacheRegionId(derivedSubregion.id), c.env);
        return c.json(asset, 201);
    } catch (err) {
        console.error(err);
        return c.json({ error: err.message || 'Failed to create hard asset' }, err.status || 500);
    }
};

export const createHardAssetMembershipQr = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const asset = await db.query.hardAssets.findFirst({
            where: eq(hardAssets.id, id),
            with: {
                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
            },
        });

        if (!asset || asset.isDeleted) {
            return c.json({ error: 'Not found' }, 404);
        }
        if (!actorCanManageAsset(user, asset, asset.partner)) {
            return c.json({ error: 'Insufficient permissions to manage this place.' }, 403);
        }

        const token = await createMembershipLinkToken(asset.id, c);
        const requestOrigin = c.req.header('origin') || new URL(c.req.url).origin;
        const linkPath = `/membership/link?token=${encodeURIComponent(token)}`;
        const linkUrl = `${requestOrigin.replace(/\/$/, '')}${linkPath}`;

        return c.json({
            token,
            linkPath,
            linkUrl,
            place: {
                id: asset.id,
                name: asset.name,
                address: asset.address,
            },
        });
    } catch (err) {
        console.error('createHardAssetMembershipQr Error:', err);
        return c.json({ error: err.message || 'Failed to generate membership QR' }, err.status || 500);
    }
};

export const updateHardAsset = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const role = normalizeRole(user.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const existing = await db.query.hardAssets.findFirst({
            where: eq(hardAssets.id, id),
            with: {
                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
            },
        });

        if (!existing) return c.json({ error: 'Not found' }, 404);

        if (!actorCanManageAsset(user, existing, existing.partner)) {
            return c.json({ error: 'Insufficient permissions to edit this asset' }, 403);
        }

        const body = await c.req.json();
        const nextPostalCode = body.postalCode ?? existing.postalCode;
        const nextCountry = body.country ?? existing.country;
        const derivedRouting = await resolveWritableSubregionByPostal(db, nextPostalCode, user, 'Postal code');
        const derivedSubregion = derivedRouting.subregion;
        ensureActorCanCreateInSubregion(user, derivedSubregion.id);

        let owner = existing.partner || null;
        if (body.partnerId !== undefined || body.ownershipMode !== undefined) {
            if (role === 'partner') {
                return c.json({ error: 'Partners cannot transfer asset ownership.' }, 403);
            }
            const resolved = await resolveAssetOwner(db, user, body, derivedSubregion.id);
            owner = resolved.owner;
        }

        let lat = existing.lat;
        let lng = existing.lng;
        if (nextPostalCode !== existing.postalCode || nextCountry !== existing.country) {
            const coords = await geocode(nextPostalCode, nextCountry);
            if (!coords) {
                return c.json({ error: `Could not find location for postal code "${nextPostalCode}" in "${nextCountry}".` }, 400);
            }
            lat = coords.lat.toString();
            lng = coords.lng.toString();
        }

        await db.update(hardAssets).set({
            partnerId: owner?.id || null,
            subregionId: derivedSubregion.id,
            name: body.name ?? existing.name,
            country: nextCountry,
            postalCode: nextPostalCode,
            lat,
            lng,
            address: body.address ?? existing.address,
            subCategory: body.subCategory ?? existing.subCategory,
            phone: body.phone !== undefined ? (body.phone || null) : existing.phone,
            hours: body.hours !== undefined ? (body.hours || null) : existing.hours,
            website: body.website !== undefined ? (body.website || null) : existing.website,
            description: body.description !== undefined ? (body.description || null) : existing.description,
            logoUrl: body.logoUrl !== undefined ? body.logoUrl : existing.logoUrl,
            bannerUrl: body.bannerUrl !== undefined ? body.bannerUrl : existing.bannerUrl,
            galleryUrls: body.galleryUrls !== undefined ? body.galleryUrls : existing.galleryUrls,
            sourceGooglePlaceId: body.sourceGooglePlaceId !== undefined ? (body.sourceGooglePlaceId || null) : existing.sourceGooglePlaceId,
            sourceGoogleMapsUri: body.sourceGoogleMapsUri !== undefined ? (body.sourceGoogleMapsUri || null) : existing.sourceGoogleMapsUri,
            isHidden: body.isHidden !== undefined ? body.isHidden : existing.isHidden,
            hideFrom: body.hideFrom !== undefined ? (body.hideFrom ? new Date(body.hideFrom) : null) : existing.hideFrom,
            hideUntil: body.hideUntil !== undefined ? (body.hideUntil ? new Date(body.hideUntil) : null) : existing.hideUntil,
            updatedAt: new Date(),
        }).where(eq(hardAssets.id, id));

        if (body.newTags) {
            await syncAssetTags(db, id, 'hard', body.newTags);
        }

        await rebuildMapCache(getCacheRegionId(existing.subregionId, derivedSubregion.id), c.env);
        return c.json({ success: true, id });
    } catch (err) {
        console.error(err);
        return c.json({ error: err.message || 'Failed to update hard asset' }, err.status || 500);
    }
};

export const deleteHardAsset = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const existing = await db.query.hardAssets.findFirst({
            where: eq(hardAssets.id, id),
            with: {
                partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
            },
        });

        if (!existing) return c.json({ error: 'Not found' }, 404);
        if (!actorCanManageAsset(user, existing, existing.partner)) {
            return c.json({ error: 'Insufficient permissions to delete this asset' }, 403);
        }

        await db.update(hardAssets).set({ isDeleted: true }).where(eq(hardAssets.id, id));
        await rebuildMapCache(getCacheRegionId(existing.subregionId), c.env);
        return c.json({ success: true });
    } catch (err) {
        console.error(err);
        return c.json({ error: err.message || 'Failed to delete hard asset' }, err.status || 500);
    }
};

export const enrichHardAssetDraft = async (c) => {
    try {
        const user = c.get('user');
        const role = normalizeRole(user?.role);
        
        if (role === 'standard' || role === 'guest') {
            return c.json({ error: 'Insufficient permissions' }, 403);
        }

        const body = await c.req.json();
        const candidate = {
            googlePlaceId: body.googlePlaceId || '',
            name: body.name || '',
            address: body.address || '',
            postalCode: body.postalCode || ''
        };
        
        const enrichmentMap = await enrichPlaceCandidatesWithVertex({
            env: c.env,
            candidates: [candidate],
            keywordQuery: ''
        });

        const enrichment = enrichmentMap.get(candidate.googlePlaceId) || enrichmentMap.get(`_idx:0`);
        if (enrichment && !enrichment.logoUrl && enrichment.sourceUrl) {
            const metadata = await fetchWebsiteMetadata(enrichment.sourceUrl);
            if (metadata.logoUrl) {
                enrichment.logoUrl = metadata.logoUrl;
            }
        }
        
        return c.json(enrichment || {});
    } catch (err) {
        console.error(err);
        return c.json({ error: err.message || 'Failed to enrich draft' }, err.status || 500);
    }
};
