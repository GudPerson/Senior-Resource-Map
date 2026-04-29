import { and, eq } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { softAssets, softAssetLocations, subCategories, tags } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { syncAssetTags } from '../utils/tags.js';
import { rebuildMapCache } from '../utils/cacheBuilder.js';
import { normalizeRole } from '../utils/roles.js';
import { actorCanManageAsset } from '../utils/ownership.js';
import { resolveOrCreateExternalKey } from '../utils/externalKeys.js';
import {
    determineSoftSubregion,
    ensureActorCanManageLinkedHardAssets,
    getCacheRegionId,
    loadHardAssetsByIds,
} from '../utils/softAssetScope.js';
import { inferSoftAssetBucket, normalizeSoftAssetBucket } from '../utils/softAssetBuckets.js';
import { extractCollateralDraftRows } from '../utils/vertexCollateralImport.js';

function clientError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeName(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenizeName(value) {
    return new Set(
        normalizeName(value)
            .split(' ')
            .map((token) => token.trim())
            .filter((token) => token.length > 1),
    );
}

function computeTokenSimilarity(left, right) {
    if (!left.size || !right.size) return 0;
    let overlap = 0;
    left.forEach((token) => {
        if (right.has(token)) overlap += 1;
    });
    return overlap / Math.max(left.size, right.size);
}

function normalizeTags(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : [])
        .map((tag) => normalizeText(tag).toLowerCase())
        .filter((tag) => {
            if (!tag || seen.has(tag)) return false;
            seen.add(tag);
            return true;
        })
        .slice(0, 12);
}

function normalizeOptionalEmail(value) {
    const email = normalizeText(value).toLowerCase();
    if (!email) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizeOptionalUrl(value) {
    const text = normalizeText(value);
    if (!text) return null;
    const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    try {
        return new URL(candidate).toString();
    } catch {
        return null;
    }
}

function normalizeOptionalText(value) {
    const text = normalizeText(value);
    return text || null;
}

function normalizeConfidence(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.5;
    return Math.max(0, Math.min(1, numeric));
}

function normalizeVisibilityAction(value, isHidden = false) {
    const action = normalizeText(value).toLowerCase();
    if (action === 'hide' || isHidden) return 'hide';
    return 'preserve';
}

function normalizeReviewBucket(value, row = {}) {
    try {
        return normalizeSoftAssetBucket(value, null)
            || inferSoftAssetBucket({
                name: row?.name,
                description: row?.description,
                subCategory: row?.subCategory,
                tags: row?.newTags,
            }).bucket;
    } catch {
        return inferSoftAssetBucket({
            name: row?.name,
            description: row?.description,
            subCategory: row?.subCategory,
            tags: row?.newTags,
        }).bucket;
    }
}

function formatMatchReason(reason) {
    if (reason === 'exact_name') return 'Exact name match at this host';
    if (reason === 'fuzzy_name') return 'Likely same-host name match';
    return 'Suggested existing match';
}

function buildMatchCandidatesForDraft(draftRow, existingOfferings) {
    const normalizedDraftName = normalizeName(draftRow?.name);
    const draftTokens = tokenizeName(draftRow?.name);
    const normalizedDraftBucket = normalizeText(draftRow?.bucket);
    const normalizedDraftSubCategory = normalizeText(draftRow?.subCategorySuggestion || draftRow?.subCategory);

    if (!normalizedDraftName) return [];

    return existingOfferings
        .map((asset) => {
            const normalizedAssetName = normalizeName(asset.name);
            const assetTokens = tokenizeName(asset.name);
            const exactName = normalizedAssetName === normalizedDraftName;
            let score = exactName ? 1 : computeTokenSimilarity(draftTokens, assetTokens);

            if (!exactName && score < 0.35) return null;
            if (normalizedDraftBucket && normalizeText(asset.bucket) === normalizedDraftBucket) score += 0.12;
            if (normalizedDraftSubCategory && normalizeText(asset.subCategory) === normalizedDraftSubCategory) score += 0.08;

            return {
                id: asset.id,
                name: asset.name,
                bucket: asset.bucket || 'Programmes',
                subCategory: asset.subCategory || '',
                score: Number(score.toFixed(2)),
                matchReason: exactName ? 'exact_name' : 'fuzzy_name',
                label: formatMatchReason(exactName ? 'exact_name' : 'fuzzy_name'),
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3);
}

function formatExistingSoftAsset(asset) {
    return {
        id: asset.id,
        name: asset.name,
        bucket: asset.bucket || 'Programmes',
        subCategory: asset.subCategory || '',
        description: asset.description || '',
        schedule: asset.schedule || '',
        contactPhone: asset.contactPhone || '',
        contactEmail: asset.contactEmail || '',
        ctaLabel: asset.ctaLabel || '',
        ctaUrl: asset.ctaUrl || '',
        venueNote: asset.venueNote || '',
        isHidden: Boolean(asset.isHidden),
        newTags: (asset.tags || []).map((entry) => entry.tag?.name).filter(Boolean),
        partner: asset.partner || null,
    };
}

async function loadScopedHostHardAsset(db, user, hostHardAssetId) {
    const hostId = Number.parseInt(String(hostHardAssetId), 10);
    if (!Number.isInteger(hostId)) {
        throw clientError('A host place is required for collateral import.');
    }

    const hosts = await loadHardAssetsByIds(db, [hostId]);
    if (hosts.length !== 1) {
        throw clientError('The selected host place could not be found.', 404);
    }

    ensureActorCanManageLinkedHardAssets(user, hosts);
    return hosts[0];
}

async function loadSoftSubCategoryNames(db) {
    const rows = await db.query.subCategories.findMany({
        where: eq(subCategories.type, 'soft'),
    });
    return rows.map((row) => row.name);
}

async function loadKnownTagNames(db) {
    const rows = await db.query.tags.findMany({
        columns: { name: true },
    });
    return rows.map((row) => row.name);
}

async function loadHostScopedStandaloneOfferings(db, hostHardAssetId) {
    const rows = await db.query.softAssets.findMany({
        where: and(
            eq(softAssets.isDeleted, false),
            eq(softAssets.assetMode, 'standalone'),
        ),
        with: {
            partner: {
                columns: { id: true, name: true, role: true, managerUserId: true },
            },
            tags: { with: { tag: true } },
            locations: {
                with: {
                    hardAsset: {
                        columns: { id: true, name: true },
                    },
                },
            },
        },
    });

    return rows.filter((asset) => asset.locations.some((entry) => Number(entry.hardAssetId) === Number(hostHardAssetId)));
}

function buildResolvedHostSummary(hostAsset) {
    return {
        id: hostAsset.id,
        name: hostAsset.name,
        address: hostAsset.address || '',
        postalCode: hostAsset.postalCode || '',
        subregionId: hostAsset.subregionId || null,
    };
}

function buildRowPayload(row) {
    const name = normalizeText(row?.name);
    if (!name) {
        throw clientError('Each reviewed draft needs a name before it can be created or updated.');
    }

    const bucket = normalizeReviewBucket(row?.bucket, row);
    const subCategory = normalizeText(row?.subCategory || row?.subCategorySuggestion || bucket) || bucket;

    return {
        name,
        bucket,
        subCategory,
        description: normalizeOptionalText(row?.description),
        schedule: normalizeOptionalText(row?.schedule),
        contactPhone: normalizeOptionalText(row?.contactPhone),
        contactEmail: normalizeOptionalEmail(row?.contactEmail),
        ctaLabel: normalizeOptionalText(row?.ctaLabel),
        ctaUrl: normalizeOptionalUrl(row?.ctaUrl),
        venueNote: normalizeOptionalText(row?.venueNote),
        newTags: normalizeTags(row?.newTags),
        isHidden: Boolean(row?.isHidden),
        visibilityAction: normalizeVisibilityAction(row?.visibilityAction, row?.isHidden),
    };
}

function getDefaultOwnerForHost(user, hostAsset) {
    if (normalizeRole(user?.role) === 'partner') {
        return user?.id || null;
    }
    return hostAsset?.partnerId || null;
}

async function createStandaloneSoftAssetFromDraft(db, user, hostAsset, draftPayload) {
    const ownerPartnerId = getDefaultOwnerForHost(user, hostAsset);
    const linkedHardAssets = [hostAsset];
    const finalSubregionId = determineSoftSubregion(user, { subregionId: hostAsset.subregionId }, linkedHardAssets);

    const [created] = await db.insert(softAssets).values({
        assetMode: 'standalone',
        externalKey: await resolveOrCreateExternalKey(db, softAssets, softAssets.externalKey, {
            prefix: 'offering',
            name: draftPayload.name,
        }),
        partnerId: ownerPartnerId,
        createdByUserId: user.id,
        subregionId: finalSubregionId,
        name: draftPayload.name,
        bucket: draftPayload.bucket,
        subCategory: draftPayload.subCategory,
        description: draftPayload.description,
        schedule: draftPayload.schedule,
        contactPhone: draftPayload.contactPhone,
        contactEmail: draftPayload.contactEmail,
        ctaLabel: draftPayload.ctaLabel,
        ctaUrl: draftPayload.ctaUrl,
        venueNote: draftPayload.venueNote,
        audienceMode: 'public',
        isMemberOnly: false,
        eligibilityRules: null,
        availabilityEnabled: false,
        availabilityCount: 0,
        availabilityUnit: null,
        isHidden: Boolean(draftPayload.isHidden),
        hideFrom: null,
        hideUntil: null,
    }).returning({ id: softAssets.id, name: softAssets.name });

    await db.insert(softAssetLocations).values({
        softAssetId: created.id,
        hardAssetId: hostAsset.id,
    });
    await syncAssetTags(db, created.id, 'soft', draftPayload.newTags);

    return created;
}

async function updateStandaloneSoftAssetFromDraft(db, assetId, draftPayload) {
    const patch = {
        name: draftPayload.name,
        bucket: draftPayload.bucket,
        subCategory: draftPayload.subCategory,
        description: draftPayload.description,
        schedule: draftPayload.schedule,
        contactPhone: draftPayload.contactPhone,
        contactEmail: draftPayload.contactEmail,
        ctaLabel: draftPayload.ctaLabel,
        ctaUrl: draftPayload.ctaUrl,
        venueNote: draftPayload.venueNote,
        updatedAt: new Date(),
    };

    if (draftPayload.visibilityAction === 'hide') {
        patch.isHidden = true;
    }

    await db.update(softAssets).set(patch).where(eq(softAssets.id, assetId));

    await syncAssetTags(db, assetId, 'soft', draftPayload.newTags);
}

async function rebuildSoftAssetCaches(subregionIds, env, user) {
    const uniqueIds = [...new Set((subregionIds || []).filter((value) => value !== undefined && value !== null))];
    for (const subregionId of uniqueIds) {
        try {
            await rebuildMapCache(getCacheRegionId(subregionId, user?.subregionId, user?.subregionIds?.[0]), env);
        } catch (cacheErr) {
            console.error('Cache err', cacheErr);
        }
    }
}

export const previewSoftAssetCollateralImport = async (c) => {
    try {
        const user = c.get('user');
        const role = normalizeRole(user?.role);
        if (role === 'standard' || role === 'guest') {
            return c.json({ error: 'Only partners and admins can import collateral into offerings.' }, 403);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const formData = await c.req.formData();
        const hostAsset = await loadScopedHostHardAsset(db, user, formData.get('hostHardAssetId'));
        const uploadedFiles = formData
            .getAll('files')
            .filter((file) => file && typeof file.arrayBuffer === 'function');

        const [softSubCategoryNames, knownTagNames, existingOfferings] = await Promise.all([
            loadSoftSubCategoryNames(db),
            loadKnownTagNames(db),
            loadHostScopedStandaloneOfferings(db, hostAsset.id),
        ]);

        const extraction = await extractCollateralDraftRows({
            env: c.env,
            hostAsset,
            files: uploadedFiles,
            softSubCategoryNames,
            knownTagNames,
        });

        const formattedExistingOfferings = existingOfferings
            .filter((asset) => actorCanManageAsset(user, asset, asset.partner))
            .map(formatExistingSoftAsset);
        const draftRows = extraction.draftRows.map((draftRow, index) => ({
            id: `draft-${index + 1}`,
            ...draftRow,
            matchCandidates: buildMatchCandidatesForDraft(draftRow, formattedExistingOfferings),
        }));

        return c.json({
            resolvedHost: buildResolvedHostSummary(hostAsset),
            warnings: extraction.warnings,
            draftRows,
        });
    } catch (err) {
        console.error('previewSoftAssetCollateralImport Error:', err);
        return c.json({ error: err.message || 'Failed to preview collateral import.' }, err.status || 500);
    }
};

export const commitSoftAssetCollateralImport = async (c) => {
    try {
        const user = c.get('user');
        const role = normalizeRole(user?.role);
        if (role === 'standard' || role === 'guest') {
            return c.json({ error: 'Only partners and admins can import collateral into offerings.' }, 403);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const body = await c.req.json();
        const hostAsset = await loadScopedHostHardAsset(db, user, body?.hostHardAssetId);
        const reviewedRows = Array.isArray(body?.draftRows) ? body.draftRows : [];
        if (reviewedRows.length === 0) {
            return c.json({ error: 'No reviewed draft rows were provided.' }, 400);
        }

        const existingOfferings = await loadHostScopedStandaloneOfferings(db, hostAsset.id);
        const manageableExistingOfferings = existingOfferings.filter((asset) => actorCanManageAsset(user, asset, asset.partner));
        const existingOfferingById = new Map(manageableExistingOfferings.map((asset) => [asset.id, formatExistingSoftAsset(asset)]));

        const results = [];
        let changed = false;

        for (const reviewedRow of reviewedRows) {
            const rowKey = reviewedRow?.id || reviewedRow?.name || `row-${results.length + 1}`;
            const action = String(reviewedRow?.action || 'create').trim().toLowerCase();

            if (action === 'skip') {
                results.push({ id: rowKey, status: 'skipped' });
                continue;
            }

            try {
                const payload = buildRowPayload(reviewedRow);

                if (action === 'update') {
                    const targetId = Number.parseInt(String(reviewedRow?.targetSoftAssetId ?? reviewedRow?.existingSoftAssetId ?? ''), 10);
                    const target = existingOfferingById.get(targetId);
                    if (!target) {
                        throw clientError('The selected existing offering could not be found for this host place.', 404);
                    }

                    await updateStandaloneSoftAssetFromDraft(db, target.id, payload);
                    changed = true;
                    results.push({ id: rowKey, status: 'updated', softAssetId: target.id, name: payload.name });
                    continue;
                }

                const created = await createStandaloneSoftAssetFromDraft(db, user, hostAsset, payload);
                changed = true;
                results.push({ id: rowKey, status: 'created', softAssetId: created.id, name: created.name });
            } catch (rowErr) {
                results.push({
                    id: rowKey,
                    status: 'failed',
                    error: rowErr.message || 'Failed to process this draft row.',
                });
            }
        }

        if (changed) {
            await rebuildSoftAssetCaches([hostAsset.subregionId], c.env, user);
        }

        return c.json({
            resolvedHost: buildResolvedHostSummary(hostAsset),
            results,
        });
    } catch (err) {
        console.error('commitSoftAssetCollateralImport Error:', err);
        return c.json({ error: err.message || 'Failed to commit collateral import.' }, err.status || 500);
    }
};
