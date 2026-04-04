export const SOFT_ASSET_MODES = Object.freeze({
    STANDALONE: 'standalone',
    CHILD: 'child',
});

export const PARENT_PROPAGATED_FIELDS = Object.freeze([
    'name',
    'bucket',
    'subCategory',
    'description',
    'schedule',
    'logoUrl',
    'bannerUrl',
    'galleryUrls',
    'audienceMode',
    'isMemberOnly',
    'eligibilityRules',
]);

export const CHILD_OVERRIDE_FIELDS = Object.freeze([
    'schedule',
    'contactPhone',
    'contactEmail',
    'ctaLabel',
    'ctaUrl',
    'venueNote',
]);

export const CHILD_RUNTIME_FIELDS = Object.freeze([
    'availabilityEnabled',
    'availabilityCount',
    'availabilityUnit',
]);

export const CHILD_VISIBILITY_FIELDS = Object.freeze([
    'isHidden',
    'hideFrom',
    'hideUntil',
]);

export function normalizeText(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

export function normalizeGalleryUrls(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => normalizeText(item)).filter(Boolean);
}

export function normalizeAvailabilityCount(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

export function normalizeAvailabilityUnit(value) {
    const text = normalizeText(value);
    return text || null;
}

export function normalizeTagList(value) {
    if (!Array.isArray(value)) return [];

    return [...new Set(
        value
            .map((item) => normalizeText(item).toLowerCase())
            .filter(Boolean)
    )];
}

export function normalizeOverrideFields(fields) {
    if (!Array.isArray(fields)) return [];

    return [...new Set(
        fields
            .map((field) => normalizeText(field))
            .filter((field) => CHILD_OVERRIDE_FIELDS.includes(field))
    )];
}

export function isChildSoftAsset(asset) {
    return (asset?.assetMode || SOFT_ASSET_MODES.STANDALONE) === SOFT_ASSET_MODES.CHILD;
}

export function getSoftAssetLocations(asset) {
    if (isChildSoftAsset(asset)) {
        return asset?.hostHardAsset ? [asset.hostHardAsset] : [];
    }

    return (asset?.locations || []).map((entry) => entry.hardAsset).filter(Boolean);
}

export function buildChildValuesFromParent(parent, host, actor, externalKey = null) {
    return {
        assetMode: SOFT_ASSET_MODES.CHILD,
        externalKey,
        partnerId: parent.partnerId || null,
        createdByUserId: actor.id,
        subregionId: host.subregionId,
        parentSoftAssetId: parent.id,
        hostHardAssetId: host.id,
        name: parent.name,
        bucket: parent.bucket || null,
        subCategory: parent.subCategory || 'Programmes',
        description: parent.description || null,
        schedule: parent.schedule || null,
        logoUrl: parent.logoUrl || null,
        bannerUrl: parent.bannerUrl || null,
        galleryUrls: normalizeGalleryUrls(parent.galleryUrls),
        audienceMode: parent.audienceMode || 'public',
        isMemberOnly: Boolean(parent.isMemberOnly),
        eligibilityRules: parent.eligibilityRules || null,
        isHidden: true,
        hideFrom: null,
        hideUntil: null,
        overriddenFields: [],
        contactPhone: host.phone || null,
        contactEmail: null,
        ctaLabel: null,
        ctaUrl: null,
        venueNote: null,
        availabilityEnabled: false,
        availabilityCount: 0,
        availabilityUnit: null,
    };
}

export function buildChildPropagationPatch(parent, child) {
    const overrides = new Set(normalizeOverrideFields(child?.overriddenFields));
    const patch = {
        partnerId: parent.partnerId || null,
        updatedAt: new Date(),
    };

    for (const field of PARENT_PROPAGATED_FIELDS) {
        if (overrides.has(field)) continue;

        if (field === 'galleryUrls') {
            patch.galleryUrls = normalizeGalleryUrls(parent.galleryUrls);
            continue;
        }

        patch[field] = parent[field] ?? null;
    }

    return patch;
}

export function buildChildEditablePatch(body, existingChild) {
    const allowedFields = new Set([...CHILD_OVERRIDE_FIELDS, ...CHILD_VISIBILITY_FIELDS, ...CHILD_RUNTIME_FIELDS]);
    const nextOverrides = new Set(normalizeOverrideFields(existingChild?.overriddenFields));
    const patch = {
        updatedAt: new Date(),
    };

    for (const key of Object.keys(body || {})) {
        if ([
            'id',
            'newTags',
            'locationIds',
            'locationId',
            'hostIds',
            'hostId',
            'partnerId',
            'ownershipMode',
            'subregionId',
            'assetMode',
            'parentSoftAssetId',
            'hostHardAssetId',
        ].includes(key)) {
            continue;
        }

        if (!allowedFields.has(key)) {
            const err = new Error(`Field "${key}" cannot be edited on generated child offerings.`);
            err.status = 400;
            throw err;
        }
    }

    for (const field of CHILD_OVERRIDE_FIELDS) {
        if (body?.[field] === undefined) continue;
        patch[field] = normalizeText(body[field]) || null;
        nextOverrides.add(field);
    }

    if (body?.isHidden !== undefined) {
        patch.isHidden = Boolean(body.isHidden);
    }
    if (body?.hideFrom !== undefined) {
        patch.hideFrom = body.hideFrom ? new Date(body.hideFrom) : null;
    }
    if (body?.hideUntil !== undefined) {
        patch.hideUntil = body.hideUntil ? new Date(body.hideUntil) : null;
    }

    if (body?.availabilityEnabled !== undefined) {
        patch.availabilityEnabled = Boolean(body.availabilityEnabled);
    }
    if (body?.availabilityCount !== undefined) {
        const nextAvailabilityCount = Number.parseInt(body.availabilityCount, 10);
        if (!Number.isInteger(nextAvailabilityCount) || nextAvailabilityCount < 0) {
            const err = new Error('Availability count must be a non-negative whole number.');
            err.status = 400;
            throw err;
        }
        patch.availabilityCount = nextAvailabilityCount;
    }
    if (body?.availabilityUnit !== undefined) {
        patch.availabilityUnit = normalizeAvailabilityUnit(body.availabilityUnit);
    }

    patch.overriddenFields = [...nextOverrides];
    return patch;
}

export function buildChildOverrideResetPatch(parent, child, fields) {
    const resetFields = normalizeOverrideFields(fields);
    const currentOverrides = new Set(normalizeOverrideFields(child?.overriddenFields));
    const patch = {
        updatedAt: new Date(),
    };

    for (const field of resetFields) {
        patch[field] = parent[field] ?? null;
        currentOverrides.delete(field);
    }

    patch.overriddenFields = [...currentOverrides];
    return patch;
}

export function getMissingChildHostIds(existingChildren, requestedHostIds) {
    const existingHostIds = new Set(
        (existingChildren || [])
            .filter((child) => !child.isDeleted)
            .map((child) => child.hostHardAssetId)
            .filter(Number.isInteger)
    );

    return requestedHostIds.filter((hostId) => !existingHostIds.has(hostId));
}
