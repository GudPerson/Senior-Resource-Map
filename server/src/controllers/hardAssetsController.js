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
import { enrichHardAssetDraftFromGooglePlaces, resolveGooglePlacePreview, searchGooglePlaceCandidatesByPostal } from '../utils/googlePlaceImport.js';
import { enrichPlaceCandidatesWithVertex, searchVertexGroundedPlaceSuggestions } from '../utils/vertexGroundedPlaceSearch.js';
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

const ENRICHMENT_STOP_WORDS = new Set([
    'active',
    'ageing',
    'aging',
    'centre',
    'center',
    'singapore',
    'sg',
    'the',
    'and',
    'for',
]);

const FEI_YUE_ACTIVE_AGEING_DESCRIPTION = 'Fei Yue Community Service promotes social engagement and well-being of seniors through Active Ageing Centres and community programmes.';
const FEI_YUE_ACTIVE_AGEING_SERVICES = ['active ageing', 'senior activities', 'community programmes'];
const FEI_YUE_ACTIVE_AGEING_ENTRIES = [
    {
        name: 'Fei Yue Active Ageing Centre (Hougang)',
        postalCode: '531174',
        address: 'Blk 174A Hougang Avenue 1 #01-1505, Singapore 531174',
        phone: '6538 0234',
        hours: 'Monday to Friday, 9.30am to 6pm',
    },
    {
        name: 'Fei Yue Active Ageing Centre (Hougang Dewcourt)',
        postalCode: '533376',
        address: 'Blk 376C Hougang Street 32 #01-32, Singapore 533376',
        phone: '6202 4699',
        hours: 'Monday to Friday, 9.30am to 6pm',
    },
    {
        name: 'Fei Yue Active Ageing Centre (Holland Close)',
        postalCode: '271001',
        address: 'Blk 1 Holland Close #02-115, Singapore 271001',
        phone: '6774 4044',
        hours: 'Monday to Friday, 9.30am to 6pm',
    },
    {
        name: 'Fei Yue Active Ageing Centre (Commonwealth)',
        postalCode: '140107',
        address: 'Blk 107 Commonwealth Crescent #01-230, Singapore 140107',
        phone: '6471 2022',
        hours: 'Monday to Friday, 2pm to 5:30pm',
    },
    {
        name: 'Fei Yue Active Ageing Centre (Bukit Batok)',
        postalCode: '650183',
        address: 'Blk 183 Bukit Batok West Ave 8 #01-101, Singapore 650183',
        phone: '6561 4404',
        hours: 'Monday to Friday, 9.30am to 6pm',
    },
    {
        name: 'Fei Yue Active Ageing Centre (Bukit Batok extension)',
        postalCode: '651210',
        address: 'Blk 210A Bukit Batok St 21 #01-294, Singapore 651210',
        phone: '6563 3662',
        hours: 'Monday to Friday, 9.30am to 6pm',
    },
    {
        name: 'Fei Yue Active Ageing Centre (Teck Whye)',
        postalCode: '680009',
        address: 'Blk 9 Teck Whye Lane #01-268, Singapore 680009',
        phone: '6893 6606',
        hours: 'Monday to Friday, 9.30am to 6pm',
    },
    {
        name: 'Fei Yue Active Ageing Centre (Teck Whye extension)',
        postalCode: '681165',
        address: 'Blk 165A Teck Whye Crescent #01-331, Singapore 681165',
        phone: '6380 9155',
        hours: 'Monday to Friday, 2pm to 6pm',
    },
    {
        name: 'Fei Yue Active Ageing Centre (Senja)',
        postalCode: '672634',
        address: 'Blk 634B Senja Road #02-227, Singapore 672634',
        phone: '6351 9555',
        hours: 'Monday to Friday, 9.30am to 6pm',
    },
    {
        name: 'Fei Yue Active Ageing Centre (Limbang)',
        postalCode: '680536',
        address: 'Blk 536 Choa Chu Kang Street 51 #01-142, Singapore 680536',
        phone: '6659 0616',
        hours: 'Monday to Friday, 9.30am to 6pm',
    },
    {
        name: 'Fei Yue Active Ageing Centre (Limbang Green)',
        postalCode: '680574',
        address: 'Blk 574 Choa Chu Kang St 52 #01-296, Singapore 680574',
        phone: '6661 9499',
        hours: 'Monday to Friday, 9.30am to 6pm',
    },
    {
        name: 'Fei Yue Active Ageing Centre (Sunshine Court)',
        postalCode: '683476',
        address: 'Blk 476C Choa Chu Kang Avenue 5 #01-43, Singapore 683476',
        phone: '6334 0180',
        hours: 'Monday to Friday, 9.30am to 6pm',
    },
    {
        name: 'Fei Yue Active Ageing Centre (Brickland)',
        postalCode: '681809',
        address: 'Blk 809A Choa Chu Kang Ave 1 #01-628, Singapore 681809',
        phone: '6950 6322',
        hours: 'Monday to Friday, 9.30am to 6pm',
    },
];

const OFFICIAL_DIRECTORY_SOURCES = [
    {
        label: 'Fei Yue Active Ageing Centres',
        url: 'https://fycs.org/active-ageing-centres/',
        matches: (candidate) => /\bfei\s+yue\b/i.test(candidate?.name || ''),
        description: FEI_YUE_ACTIVE_AGEING_DESCRIPTION,
        services: FEI_YUE_ACTIVE_AGEING_SERVICES,
        entries: FEI_YUE_ACTIVE_AGEING_ENTRIES,
    },
];

function tokenizeEnrichmentText(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter((token) => token.length > 1 && !ENRICHMENT_STOP_WORDS.has(token));
}

function computeTokenOverlap(left, right) {
    const leftTokens = new Set(tokenizeEnrichmentText(left));
    if (leftTokens.size === 0) return 0;
    const rightTokens = new Set(tokenizeEnrichmentText(right));
    if (rightTokens.size === 0) return 0;

    let matches = 0;
    leftTokens.forEach((token) => {
        if (rightTokens.has(token)) matches += 1;
    });
    return matches / leftTokens.size;
}

function hasUsefulEnrichment(enrichment) {
    return Boolean(
        enrichment?.address
        || enrichment?.phone
        || enrichment?.website
        || enrichment?.hours
        || enrichment?.description
        || enrichment?.logoUrl
        || (Array.isArray(enrichment?.services) && enrichment.services.length > 0)
    );
}

function needsCorePlaceEnrichment(enrichment) {
    return !normalizeText(enrichment?.address)
        || !normalizeText(enrichment?.website)
        || !normalizeText(enrichment?.phone)
        || !normalizeText(enrichment?.hours)
        || !normalizeText(enrichment?.description)
        || !Array.isArray(enrichment?.services)
        || enrichment.services.length === 0;
}

function scoreGroundedDraftSuggestion(candidate, suggestion) {
    const nameOverlap = computeTokenOverlap(candidate?.name, suggestion?.name);
    const evidenceText = [
        suggestion?.name,
        suggestion?.address,
        suggestion?.description,
        suggestion?.sourceSnippet,
        ...(Array.isArray(suggestion?.suggestedTags) ? suggestion.suggestedTags : []),
    ].filter(Boolean).join(' ');
    const categoryOverlap = computeTokenOverlap(candidate?.subCategory, evidenceText);
    const samePostalCode = normalizeText(candidate?.postalCode) && normalizeText(candidate?.postalCode) === normalizeText(suggestion?.postalCode);

    let score = nameOverlap * 3;
    if (samePostalCode) score += 3;
    if (categoryOverlap > 0) score += categoryOverlap;
    if (suggestion?.description) score += 1;
    if (suggestion?.logoUrl) score += 0.75;
    if (suggestion?.sourceUrl || suggestion?.website) score += 0.5;
    if (nameOverlap === 0 && !samePostalCode) score -= 2;

    return score;
}

function mapGroundedDraftSuggestionToEnrichment(suggestion) {
    if (!suggestion) return null;

    return {
        index: 0,
        googlePlaceId: '',
        address: suggestion.address || '',
        postalCode: suggestion.postalCode || '',
        website: suggestion.website || '',
        phone: suggestion.phone || '',
        hours: suggestion.hours || '',
        description: suggestion.description || '',
        services: Array.isArray(suggestion.suggestedTags) ? suggestion.suggestedTags : [],
        logoUrl: suggestion.logoUrl || '',
        sourceUrl: suggestion.sourceUrl || suggestion.website || '',
        sourceTitle: suggestion.sourceTitle || suggestion.name || '',
        confidence: Number.isFinite(Number(suggestion.confidence)) ? Number(suggestion.confidence) : 0.5,
    };
}

function mapOfficialDirectoryEntryToEnrichment(entry, source) {
    if (!entry) return null;

    return {
        index: 0,
        googlePlaceId: '',
        address: entry.address || '',
        postalCode: entry.postalCode || '',
        website: source.url,
        phone: entry.phone || '',
        hours: entry.hours || '',
        description: source.description || '',
        services: Array.isArray(source.services) ? source.services : [],
        logoUrl: '',
        sourceUrl: source.url,
        sourceTitle: source.label,
        confidence: 0.95,
    };
}

function findOfficialDirectoryEntry(candidate, source) {
    const entries = Array.isArray(source?.entries) ? source.entries : [];
    if (entries.length === 0) return null;

    const postalCode = normalizeText(candidate?.postalCode);
    if (postalCode) {
        const exactPostalMatch = entries.find((entry) => normalizeText(entry.postalCode) === postalCode);
        if (exactPostalMatch) return exactPostalMatch;
    }

    const candidateTokens = tokenizeEnrichmentText(candidate?.name);
    if (candidateTokens.length < 3) return null;

    return entries
        .map((entry) => ({
            entry,
            score: computeTokenOverlap(candidate?.name, entry.name),
        }))
        .filter(({ score }) => score >= 0.75)
        .sort((left, right) => right.score - left.score)[0]?.entry || null;
}

function enrichDraftFromStaticOfficialDirectory(candidate) {
    const source = OFFICIAL_DIRECTORY_SOURCES.find((entry) => entry.matches(candidate));
    if (!source) return null;

    return mapOfficialDirectoryEntryToEnrichment(findOfficialDirectoryEntry(candidate, source), source);
}

function mergeEnrichmentWithFallback(enrichment, fallback) {
    if (!fallback) return enrichment;
    if (!enrichment) return fallback;

    const merged = { ...fallback, ...enrichment };
    ['address', 'postalCode', 'website', 'phone', 'hours', 'description', 'logoUrl', 'sourceUrl', 'sourceTitle'].forEach((field) => {
        if (!normalizeText(enrichment[field]) && normalizeText(fallback[field])) {
            merged[field] = fallback[field];
        }
    });

    const services = [...(fallback.services || []), ...(enrichment.services || [])]
        .map((service) => normalizeText(service))
        .filter(Boolean);
    merged.services = [...new Set(services)];
    merged.confidence = Math.max(Number(enrichment.confidence) || 0, Number(fallback.confidence) || 0);

    return merged;
}

function decodeBasicHtmlEntities(value) {
    return String(value || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

function htmlToDirectoryText(html) {
    return decodeBasicHtmlEntities(String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\r/g, '\n'))
        .split('\n')
        .map((line) => normalizeText(line))
        .filter(Boolean)
        .join('\n');
}

function extractOfficialDirectoryBlock(text, candidate) {
    const lines = String(text || '').split('\n').map(normalizeText).filter(Boolean);
    if (lines.length === 0) return [];

    const postalCode = normalizeText(candidate?.postalCode);
    const nameTokens = tokenizeEnrichmentText(candidate?.name);
    const startIndex = lines.findIndex((line, index) => {
        const nextLines = lines.slice(index, index + 8).join(' ');
        const samePostal = postalCode && nextLines.includes(postalCode);
        const nameOverlap = computeTokenOverlap(candidate?.name, line);
        return samePostal && (nameOverlap >= 0.45 || nameTokens.some((token) => line.toLowerCase().includes(token)));
    });

    if (startIndex < 0) return [];

    const block = [];
    for (let index = startIndex; index < lines.length; index += 1) {
        const line = lines[index];
        if (index > startIndex && /^fei\s+yue\b/i.test(line) && !line.includes(postalCode)) break;
        block.push(line);
        if (/^operating\s+hours\s*:/i.test(line)) break;
        if (block.length >= 12) break;
    }

    return block;
}

function parseOfficialDirectoryBlock(block, source, metadata = {}) {
    if (!Array.isArray(block) || block.length === 0) return null;

    const addressLines = [];
    let phone = '';
    let hours = '';
    let postalCode = '';

    for (const line of block.slice(1)) {
        const telMatch = line.match(/^tel\s*:\s*(.+)$/i);
        if (telMatch) {
            phone = normalizeText(telMatch[1]);
            continue;
        }

        const hoursMatch = line.match(/^operating\s+hours\s*:\s*(.+)$/i);
        if (hoursMatch) {
            hours = normalizeText(hoursMatch[1]);
            continue;
        }

        if (/^(fax|email|centre\s+head)\s*:/i.test(line)) continue;

        const postalMatch = line.match(/\b(\d{6})\b/);
        if (postalMatch) postalCode = postalMatch[1];
        addressLines.push(line);
    }

    const address = normalizeText(addressLines.join(', '));
    if (!address && !phone && !hours) return null;

    return {
        index: 0,
        googlePlaceId: '',
        address,
        postalCode,
        website: source.url,
        phone,
        hours,
        description: metadata.description || source.description || '',
        services: Array.isArray(source.services) ? source.services : [],
        logoUrl: '',
        sourceUrl: source.url,
        sourceTitle: source.label,
        confidence: 0.9,
    };
}

async function enrichDraftFromOfficialDirectory(candidate) {
    const source = OFFICIAL_DIRECTORY_SOURCES.find((entry) => entry.matches(candidate));
    if (!source) return null;

    const staticEnrichment = enrichDraftFromStaticOfficialDirectory(candidate);
    if (staticEnrichment) return staticEnrichment;

    try {
        const response = await fetch(source.url, {
            headers: {
                Accept: 'text/html,application/xhtml+xml',
                'User-Agent': 'CareAroundSGImport/1.0',
            },
            redirect: 'follow',
        });
        if (!response.ok) return null;

        const html = await response.text();
        const text = htmlToDirectoryText(html);
        const block = extractOfficialDirectoryBlock(text, candidate);
        const metadata = await fetchWebsiteMetadata(source.url);
        return parseOfficialDirectoryBlock(block, source, metadata);
    } catch (err) {
        console.warn('enrichHardAssetDraft: official directory fallback skipped.', err?.message);
        return null;
    }
}

async function enrichDraftWithGroundedSearch(env, candidate) {
    if (!candidate?.name || !candidate?.postalCode) return null;

    try {
        const { candidates = [] } = await searchVertexGroundedPlaceSuggestions({
            env,
            anchor: {
                postalCode: candidate.postalCode,
                address: candidate.address,
            },
            keywordQuery: [candidate.name, candidate.subCategory].filter(Boolean).join(' '),
            categoryHints: [candidate.subCategory, 'Active Ageing Centre', 'senior activities'].filter(Boolean),
            preferredResultCount: 4,
            radiusLabel: 'Singapore',
        });

        const bestSuggestion = candidates
            .map((suggestion) => ({
                suggestion,
                score: scoreGroundedDraftSuggestion(candidate, suggestion),
            }))
            .filter((entry) => entry.score > 0)
            .sort((left, right) => right.score - left.score)[0]?.suggestion || null;

        return mapGroundedDraftSuggestionToEnrichment(bestSuggestion);
    } catch (err) {
        console.warn('enrichHardAssetDraft: grounded fallback skipped.', err?.message);
        return null;
    }
}

async function enrichDraftWithGooglePlaces(env, candidate) {
    if (!candidate?.name || !candidate?.postalCode) return null;

    try {
        return await enrichHardAssetDraftFromGooglePlaces(env, candidate);
    } catch (err) {
        console.warn('enrichHardAssetDraft: Google Places fallback skipped.', err?.message);
        return null;
    }
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
            postalCode: body.postalCode || '',
            website: body.website || '',
            subCategory: body.subCategory || '',
        };
        const officialDirectoryEnrichment = enrichDraftFromStaticOfficialDirectory(candidate);
        
        const enrichmentMap = await enrichPlaceCandidatesWithVertex({
            env: c.env,
            candidates: [candidate],
            keywordQuery: candidate.name,
        });

        let enrichment = enrichmentMap.get(candidate.googlePlaceId) || enrichmentMap.get(`_idx:0`);
        enrichment = mergeEnrichmentWithFallback(enrichment, officialDirectoryEnrichment);
        if (needsCorePlaceEnrichment(enrichment)) {
            const googlePlacesEnrichment = await enrichDraftWithGooglePlaces(c.env, candidate);
            enrichment = mergeEnrichmentWithFallback(enrichment, googlePlacesEnrichment);
            enrichment = mergeEnrichmentWithFallback(enrichment, officialDirectoryEnrichment);
        }
        if (!hasUsefulEnrichment(enrichment)) {
            enrichment = await enrichDraftWithGroundedSearch(c.env, candidate) || enrichment;
            enrichment = mergeEnrichmentWithFallback(enrichment, officialDirectoryEnrichment);
        }
        if (!hasUsefulEnrichment(enrichment)) {
            enrichment = await enrichDraftFromOfficialDirectory(candidate) || enrichment;
        }
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
