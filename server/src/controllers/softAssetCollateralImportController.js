import { and, eq, inArray } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { softAssets, softAssetLocations, softAssetTags, subCategories, tags } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { rebuildMapCache } from '../utils/cacheBuilder.js';
import { normalizeRole } from '../utils/roles.js';
import { actorCanManageAsset } from '../utils/ownership.js';
import {
    allocateUniqueSoftAssetExternalKeys,
    buildImportRowFailureResult,
} from '../utils/softAssetImportCommit.js';
import {
    determineSoftSubregion,
    ensureActorCanManageLinkedHardAssets,
    getCacheRegionId,
    loadHardAssetsByIds,
} from '../utils/softAssetScope.js';
import { inferSoftAssetBucket, normalizeSoftAssetBucket } from '../utils/softAssetBuckets.js';
import {
    normalizeImportedSoftAssetName,
    normalizeImportedSoftAssetPhone,
    normalizeImportedSoftAssetShortText,
    normalizeImportedSoftAssetSubCategory,
    normalizeImportedSoftAssetTags,
} from '../utils/softAssetImportFields.js';
import { extractCollateralDraftRows } from '../utils/vertexCollateralImport.js';
import {
    buildCollateralReviewRows,
    buildMissingOfferingRows,
    normalizeImportMode,
} from '../utils/collateralImportMatching.js';

function clientError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTags(values) {
    return normalizeImportedSoftAssetTags(values);
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

function parsePositiveId(value) {
    const id = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(id) && id > 0 ? id : null;
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
    const name = normalizeImportedSoftAssetName(row?.name);
    if (!name) {
        throw clientError('Each reviewed draft needs a name before it can be created or updated.');
    }

    const bucket = normalizeReviewBucket(row?.bucket, row);
    const subCategory = normalizeImportedSoftAssetSubCategory(
        row?.subCategory || row?.subCategorySuggestion || bucket,
        bucket,
    );

    return {
        name,
        bucket,
        subCategory,
        description: normalizeOptionalText(row?.description),
        schedule: normalizeOptionalText(row?.schedule),
        contactPhone: normalizeImportedSoftAssetPhone(row?.contactPhone),
        contactEmail: normalizeOptionalEmail(row?.contactEmail),
        ctaLabel: normalizeImportedSoftAssetShortText(row?.ctaLabel),
        ctaUrl: normalizeOptionalUrl(row?.ctaUrl),
        venueNote: normalizeOptionalText(row?.venueNote),
        newTags: normalizeTags(row?.newTags),
        isHidden: Boolean(row?.isHidden),
        visibilityAction: normalizeVisibilityAction(row?.visibilityAction, row?.isHidden),
    };
}

function mergeBlankDraftFieldsWithExisting(payload, existing) {
    const merged = { ...payload };
    [
        'description',
        'schedule',
        'contactPhone',
        'contactEmail',
        'ctaLabel',
        'ctaUrl',
        'venueNote',
    ].forEach((field) => {
        if (!merged[field] && existing?.[field]) {
            merged[field] = existing[field];
        }
    });

    if ((!Array.isArray(merged.newTags) || merged.newTags.length === 0) && Array.isArray(existing?.newTags)) {
        merged.newTags = existing.newTags;
    }

    return merged;
}

function getDefaultOwnerForHost(user, hostAsset) {
    if (normalizeRole(user?.role) === 'partner') {
        return user?.id || null;
    }
    return hostAsset?.partnerId || null;
}

async function loadExistingSoftAssetExternalKeys(db) {
    const rows = await db.select({ externalKey: softAssets.externalKey }).from(softAssets);
    return new Set(rows.map((row) => row.externalKey).filter(Boolean));
}

function buildStandaloneSoftAssetInsertValues(user, hostAsset, draftPayload, externalKey) {
    const ownerPartnerId = getDefaultOwnerForHost(user, hostAsset);
    const linkedHardAssets = [hostAsset];
    const finalSubregionId = determineSoftSubregion(user, { subregionId: hostAsset.subregionId }, linkedHardAssets);

    return {
        assetMode: 'standalone',
        externalKey,
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
    };
}

async function createStandaloneSoftAssetsFromDrafts(db, user, hostAsset, entries) {
    if (!entries.length) return [];

    const existingKeys = await loadExistingSoftAssetExternalKeys(db);
    const externalKeys = allocateUniqueSoftAssetExternalKeys(entries, existingKeys);
    const insertValues = entries.map((entry, index) => (
        buildStandaloneSoftAssetInsertValues(user, hostAsset, entry.payload, externalKeys[index])
    ));

    const createdRows = await db.insert(softAssets)
        .values(insertValues)
        .returning({
            id: softAssets.id,
            name: softAssets.name,
            externalKey: softAssets.externalKey,
        });

    const createdByKey = new Map(createdRows.map((row) => [row.externalKey, row]));
    const linkedRows = externalKeys
        .map((externalKey, index) => {
            const created = createdByKey.get(externalKey);
            if (!created) return null;
            return {
                ...entries[index],
                created,
            };
        })
        .filter(Boolean);

    if (linkedRows.length) {
        await db.insert(softAssetLocations).values(linkedRows.map((entry) => ({
            softAssetId: entry.created.id,
            hardAssetId: hostAsset.id,
        })));
    }

    return linkedRows;
}

async function syncSoftAssetTagsForImport(db, assignments = []) {
    const usableAssignments = assignments
        .map((entry) => ({
            softAssetId: Number.parseInt(String(entry?.softAssetId ?? ''), 10),
            tags: normalizeImportedSoftAssetTags(entry?.tags),
        }))
        .filter((entry) => Number.isInteger(entry.softAssetId) && entry.softAssetId > 0);

    if (!usableAssignments.length) return;

    const softAssetIds = [...new Set(usableAssignments.map((entry) => entry.softAssetId))];
    await db.delete(softAssetTags).where(inArray(softAssetTags.softAssetId, softAssetIds));

    const tagNames = [...new Set(usableAssignments.flatMap((entry) => entry.tags))];
    if (!tagNames.length) return;

    const existingRows = await db.select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(inArray(tags.name, tagNames));
    const existingNames = new Set(existingRows.map((row) => row.name));
    const missingTagNames = tagNames.filter((name) => !existingNames.has(name));

    if (missingTagNames.length) {
        await db.insert(tags)
            .values(missingTagNames.map((name) => ({ name })))
            .onConflictDoNothing();
    }

    const allTagRows = await db.select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(inArray(tags.name, tagNames));
    const tagIdByName = new Map(allTagRows.map((row) => [row.name, row.id]));
    const mappingKeys = new Set();
    const mappingRows = [];

    for (const assignment of usableAssignments) {
        for (const name of assignment.tags) {
            const tagId = tagIdByName.get(name);
            if (!tagId) continue;
            const key = `${assignment.softAssetId}:${tagId}`;
            if (mappingKeys.has(key)) continue;
            mappingKeys.add(key);
            mappingRows.push({
                softAssetId: assignment.softAssetId,
                tagId,
            });
        }
    }

    if (mappingRows.length) {
        await db.insert(softAssetTags).values(mappingRows);
    }
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
}

async function hideStandaloneSoftAssetFromRefresh(db, assetId) {
    await db.update(softAssets).set({
        isHidden: true,
        updatedAt: new Date(),
    }).where(eq(softAssets.id, assetId));
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
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const formData = await c.req.formData();
        const importMode = normalizeImportMode(formData.get('importMode'));
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
        const draftRows = buildCollateralReviewRows({
            draftRows: extraction.draftRows.map((draftRow, index) => ({
                id: `draft-${index + 1}`,
                ...draftRow,
            })),
            existingOfferings: formattedExistingOfferings,
            importMode,
        });
        const missingOfferings = buildMissingOfferingRows({
            existingOfferings: formattedExistingOfferings,
            reviewRows: draftRows,
            importMode,
        });

        return c.json({
            resolvedHost: buildResolvedHostSummary(hostAsset),
            warnings: extraction.warnings,
            importMode,
            draftRows,
            missingOfferings,
        });
    } catch (err) {
        console.error('previewSoftAssetCollateralImport Error:', err);
        return c.json({ error: err.message || 'Failed to preview collateral import.' }, err.status || 500);
    }
};

export const commitSoftAssetCollateralImport = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const body = await c.req.json();
        const importMode = normalizeImportMode(body?.importMode);
        const hostAsset = await loadScopedHostHardAsset(db, user, body?.hostHardAssetId);
        const reviewedRows = Array.isArray(body?.draftRows) ? body.draftRows : [];
        const missingOfferings = Array.isArray(body?.missingOfferings) ? body.missingOfferings : [];
        if (reviewedRows.length === 0 && missingOfferings.length === 0) {
            return c.json({ error: 'No reviewed import rows were provided.' }, 400);
        }

        const existingOfferings = await loadHostScopedStandaloneOfferings(db, hostAsset.id);
        const manageableExistingOfferings = existingOfferings.filter((asset) => actorCanManageAsset(user, asset, asset.partner));
        const existingOfferingById = new Map(manageableExistingOfferings.map((asset) => [asset.id, formatExistingSoftAsset(asset)]));

        const results = [];
        const pendingCreates = [];
        const pendingTagAssignments = [];
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

                    const mergedPayload = mergeBlankDraftFieldsWithExisting(payload, target);
                    await updateStandaloneSoftAssetFromDraft(db, target.id, mergedPayload);
                    pendingTagAssignments.push({
                        softAssetId: target.id,
                        tags: mergedPayload.newTags,
                    });
                    changed = true;
                    results.push({ id: rowKey, status: 'updated', softAssetId: target.id, name: mergedPayload.name });
                    continue;
                }

                pendingCreates.push({ rowKey, reviewedRow, payload });
            } catch (rowErr) {
                results.push(buildImportRowFailureResult(reviewedRow, rowKey, rowErr));
            }
        }

        if (pendingCreates.length) {
            try {
                const createdEntries = await createStandaloneSoftAssetsFromDrafts(db, user, hostAsset, pendingCreates);
                if (createdEntries.length) {
                    changed = true;
                }

                for (const entry of createdEntries) {
                    pendingTagAssignments.push({
                        softAssetId: entry.created.id,
                        tags: entry.payload.newTags,
                    });
                    results.push({
                        id: entry.rowKey,
                        status: 'created',
                        softAssetId: entry.created.id,
                        name: entry.created.name,
                    });
                }
            } catch (createErr) {
                for (const entry of pendingCreates) {
                    results.push(buildImportRowFailureResult(entry.reviewedRow, entry.rowKey, createErr));
                }
            }
        }

        if (pendingTagAssignments.length) {
            try {
                await syncSoftAssetTagsForImport(db, pendingTagAssignments);
            } catch (tagErr) {
                console.error('soft asset import tag sync failed:', tagErr);
                results.push({
                    id: 'tag-sync',
                    status: 'failed',
                    error: 'Offerings were saved, but tags could not be fully updated. Try saving again or edit tags manually.',
                });
            }
        }

        if (importMode === 'refresh') {
            for (const missingRow of missingOfferings) {
                const rowKey = missingRow?.id || `missing-${results.length + 1}`;
                const action = String(missingRow?.action || missingRow?.suggestedAction || 'review_later').trim().toLowerCase();
                const targetId = parsePositiveId(missingRow?.softAssetId ?? missingRow?.targetSoftAssetId);
                const target = existingOfferingById.get(targetId);

                if (!target) {
                    results.push({
                        id: rowKey,
                        status: 'failed',
                        name: normalizeText(missingRow?.name) || undefined,
                        error: 'The selected existing offering could not be found for this host place.',
                    });
                    continue;
                }

                if (action === 'hide' || action === 'mark_ended') {
                    await hideStandaloneSoftAssetFromRefresh(db, target.id);
                    changed = true;
                    results.push({
                        id: rowKey,
                        status: action === 'mark_ended' ? 'ended' : 'hidden',
                        softAssetId: target.id,
                        name: target.name,
                    });
                    continue;
                }

                if (action === 'keep_active') {
                    results.push({
                        id: rowKey,
                        status: 'kept_active',
                        softAssetId: target.id,
                        name: target.name,
                    });
                    continue;
                }

                results.push({
                    id: rowKey,
                    status: 'review_later',
                    softAssetId: target.id,
                    name: target.name,
                });
            }
        }

        if (changed) {
            await rebuildSoftAssetCaches([hostAsset.subregionId], c.env, user);
        }

        return c.json({
            resolvedHost: buildResolvedHostSummary(hostAsset),
            importMode,
            results,
        });
    } catch (err) {
        console.error('commitSoftAssetCollateralImport Error:', err);
        return c.json({ error: err.message || 'Failed to commit collateral import.' }, err.status || 500);
    }
};
