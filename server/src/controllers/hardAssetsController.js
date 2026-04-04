import { desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { hardAssets, users } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { getAssetAudienceZones, resolveStandardAudienceZoneIds } from '../utils/audienceZones.js';
import { actorCanManageAsset, canAssignPartnerOwner } from '../utils/ownership.js';
import { resolveStandardAudiencePartnerIds } from '../utils/partnerBoundaries.js';
import { normalizeRole } from '../utils/roles.js';
import { resolveSingleSubregionByPostal } from '../utils/subregionRouting.js';
import { isAssetVisible } from '../utils/visibility.js';
import { syncAssetTags } from '../utils/tags.js';
import { rebuildMapCache } from '../utils/cacheBuilder.js';
import { loadScopedBoundaryContext, resolvePostalBoundaryStatus } from '../utils/subregionBoundaryStatus.js';
import { resolveOrCreateExternalKey } from '../utils/externalKeys.js';
import { buildEligibilityContext, buildMembershipHostIdMap, getOfferingAccessMetadata } from '../utils/eligibility.js';
import { createMembershipLinkToken } from '../utils/membershipTokens.js';
import { loadMembershipSummariesForAssets } from '../utils/memberships.js';

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

        const options = {
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
            orderBy: [desc(hardAssets.updatedAt)],
        };

        if (user?.role === 'regional_admin' || user?.role === 'partner') {
            if (user.subregionIds && user.subregionIds.length > 0) {
                options.where = inArray(hardAssets.subregionId, user.subregionIds);
            }
        }

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

        return c.json(formatted);
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
        const { name, country, postalCode, address, phone, hours, description, logoUrl, bannerUrl, galleryUrls, newTags = [], subCategory, isHidden, hideFrom, hideUntil } = body;

        if (!name || !country || !postalCode || !address) {
            return c.json({ error: 'name, country, postalCode, address are required' }, 400);
        }

        const derivedSubregion = await resolveSingleSubregionByPostal(db, postalCode, 'Postal code');
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
            description: description || null,
            logoUrl: logoUrl || null,
            bannerUrl: bannerUrl || null,
            galleryUrls: galleryUrls || [],
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
        const derivedSubregion = await resolveSingleSubregionByPostal(db, nextPostalCode, 'Postal code');
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
            phone: body.phone ?? null,
            hours: body.hours ?? null,
            description: body.description ?? null,
            logoUrl: body.logoUrl !== undefined ? body.logoUrl : existing.logoUrl,
            bannerUrl: body.bannerUrl !== undefined ? body.bannerUrl : existing.bannerUrl,
            galleryUrls: body.galleryUrls !== undefined ? body.galleryUrls : existing.galleryUrls,
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
