const DIFF_FIELDS = [
    ['name', 'Name'],
    ['bucket', 'Bucket'],
    ['subCategory', 'Sub-category'],
    ['description', 'Description'],
    ['schedule', 'Schedule'],
    ['contactPhone', 'Contact phone'],
    ['whatsappContact', 'WhatsApp contact'],
    ['contactEmail', 'Contact email'],
    ['ctaLabel', 'Action label'],
    ['ctaUrl', 'Action link'],
    ['venueNote', 'Venue note'],
];
const PRESERVE_WHEN_DRAFT_BLANK_FIELDS = new Set([
    'description',
    'schedule',
    'contactPhone',
    'whatsappContact',
    'contactEmail',
    'ctaLabel',
    'ctaUrl',
    'venueNote',
]);

export function normalizeImportMode(value) {
    return String(value || '').trim().toLowerCase() === 'refresh' ? 'refresh' : 'new';
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeComparable(value) {
    return normalizeText(value).toLowerCase();
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

function tokenSimilarity(left, right) {
    if (!left.size || !right.size) return 0;
    let overlap = 0;
    left.forEach((token) => {
        if (right.has(token)) overlap += 1;
    });
    return overlap / Math.max(left.size, right.size);
}

function normalizeTags(values) {
    return new Set((Array.isArray(values) ? values : [])
        .map((tag) => normalizeText(tag).toLowerCase())
        .filter(Boolean));
}

function tagOverlap(left, right) {
    if (!left.size || !right.size) return 0;
    let overlap = 0;
    left.forEach((tag) => {
        if (right.has(tag)) overlap += 1;
    });
    return overlap / Math.max(left.size, right.size);
}

function comparableDraftValue(row, field) {
    if (field === 'subCategory') return row?.subCategory || row?.subCategorySuggestion || '';
    return row?.[field] || '';
}

function comparableExistingValue(row, field) {
    return row?.[field] || '';
}

function parseId(value) {
    const id = Number.parseInt(String(value || ''), 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export function buildUpdateDiffs({ existing, draft }) {
    const diffs = [];
    DIFF_FIELDS.forEach(([field, label]) => {
        const before = normalizeText(comparableExistingValue(existing, field));
        const after = normalizeText(comparableDraftValue(draft, field));
        if (before && !after && PRESERVE_WHEN_DRAFT_BLANK_FIELDS.has(field)) {
            return;
        }
        if (before !== after) {
            diffs.push({ field, label, before, after });
        }
    });

    const existingTags = [...normalizeTags(existing?.newTags)].sort();
    const draftTags = [...normalizeTags(draft?.newTags)].sort();
    if (existingTags.length && !draftTags.length) {
        return diffs;
    }
    if (existingTags.join('|') !== draftTags.join('|')) {
        diffs.push({
            field: 'newTags',
            label: 'Tags',
            before: existingTags.join(', '),
            after: draftTags.join(', '),
        });
    }

    return diffs;
}

function scoreCandidate(draftRow, asset) {
    const normalizedDraftName = normalizeName(draftRow?.name);
    const normalizedAssetName = normalizeName(asset?.name);
    if (!normalizedDraftName || !normalizedAssetName) return null;

    const exactName = normalizedDraftName === normalizedAssetName;
    const nameScore = exactName ? 1 : tokenSimilarity(tokenizeName(draftRow.name), tokenizeName(asset.name));
    if (!exactName && nameScore < 0.35) return null;

    let score = nameScore * 0.72;
    if (normalizeComparable(draftRow?.bucket) && normalizeComparable(draftRow?.bucket) === normalizeComparable(asset?.bucket)) {
        score += 0.1;
    }

    const draftSubCategory = normalizeComparable(draftRow?.subCategory || draftRow?.subCategorySuggestion);
    if (draftSubCategory && draftSubCategory === normalizeComparable(asset?.subCategory)) {
        score += 0.08;
    }

    score += tagOverlap(normalizeTags(draftRow?.newTags), normalizeTags(asset?.newTags)) * 0.06;

    if (normalizeText(draftRow?.contactPhone) && normalizeText(draftRow?.contactPhone) === normalizeText(asset?.contactPhone)) {
        score += 0.02;
    }
    if (normalizeText(draftRow?.whatsappContact) && normalizeComparable(draftRow?.whatsappContact) === normalizeComparable(asset?.whatsappContact)) {
        score += 0.02;
    }
    if (normalizeText(draftRow?.contactEmail) && normalizeComparable(draftRow?.contactEmail) === normalizeComparable(asset?.contactEmail)) {
        score += 0.02;
    }
    if (normalizeText(draftRow?.ctaUrl) && normalizeText(draftRow?.ctaUrl) === normalizeText(asset?.ctaUrl)) {
        score += 0.02;
    }

    return {
        id: asset.id,
        name: asset.name,
        bucket: asset.bucket || 'Programmes',
        subCategory: asset.subCategory || '',
        score: Number(Math.min(score, 1).toFixed(2)),
        matchReason: exactName ? 'exact_name' : 'fuzzy_name',
        label: exactName ? 'Exact name match at this host' : 'Likely same-host name match',
    };
}

export function buildMatchCandidatesForDraft(draftRow, existingOfferings) {
    return (existingOfferings || [])
        .map((asset) => scoreCandidate(draftRow, asset))
        .filter(Boolean)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3);
}

function classifyDraftRow(draftRow, topCandidate, existingById, importMode) {
    if (!topCandidate) {
        return { reviewStatus: 'new_offering', suggestedAction: 'create', updateDiffs: [] };
    }

    const existing = existingById.get(topCandidate.id);
    const updateDiffs = existing ? buildUpdateDiffs({ existing, draft: draftRow }) : [];

    if (updateDiffs.length === 0) {
        return { reviewStatus: 'no_change', suggestedAction: 'skip', updateDiffs };
    }
    if (topCandidate.score >= 0.85) {
        return { reviewStatus: 'likely_update', suggestedAction: 'update', updateDiffs };
    }
    if (topCandidate.score >= 0.6) {
        return {
            reviewStatus: 'possible_match',
            suggestedAction: importMode === 'refresh' ? 'update' : 'create',
            updateDiffs,
        };
    }

    return { reviewStatus: 'new_offering', suggestedAction: 'create', updateDiffs: [] };
}

export function buildCollateralReviewRows({ draftRows, existingOfferings, importMode }) {
    const mode = normalizeImportMode(importMode);
    const existingById = new Map((existingOfferings || []).map((asset) => [asset.id, asset]));

    return (draftRows || []).map((draftRow, index) => {
        const matchCandidates = buildMatchCandidatesForDraft(draftRow, existingOfferings || []);
        const topCandidate = matchCandidates[0] || null;
        const classification = classifyDraftRow(draftRow, topCandidate, existingById, mode);

        return {
            id: draftRow?.id || `draft-${index + 1}`,
            ...draftRow,
            matchCandidates,
            reviewStatus: classification.reviewStatus,
            suggestedAction: classification.suggestedAction,
            targetSoftAssetId: topCandidate?.id || '',
            updateDiffs: classification.updateDiffs || [],
        };
    });
}

export function buildMissingOfferingRows({ existingOfferings, reviewRows, importMode }) {
    if (normalizeImportMode(importMode) !== 'refresh') return [];

    const matchedIds = new Set((reviewRows || [])
        .map((row) => parseId(row?.targetSoftAssetId || row?.matchCandidates?.[0]?.id))
        .filter((id) => id !== null));

    return (existingOfferings || [])
        .filter((asset) => !matchedIds.has(Number(asset.id)))
        .map((asset) => ({
            id: `missing-${asset.id}`,
            softAssetId: asset.id,
            name: asset.name,
            bucket: asset.bucket || 'Programmes',
            subCategory: asset.subCategory || '',
            schedule: asset.schedule || '',
            description: asset.description || '',
            suggestedAction: 'review_later',
        }));
}
