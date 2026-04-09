import { fetchWebsiteMetadata } from './websiteMetadata.js';

const GOOGLE_MAP_HOSTS = new Set([
    'maps.app.goo.gl',
    'goo.gl',
    'share.google',
    'google.com',
    'www.google.com',
    'maps.google.com',
    'www.google.com.sg',
    'google.com.sg',
]);

const PRIMARY_TYPE_TO_SUBCATEGORY = {
    community_center: 'Community Club',
    community_centre: 'Community Club',
    hospital: 'Community Hospital',
    clinic: 'Polyclinic',
    medical_clinic: 'Polyclinic',
    doctor: 'Polyclinic',
    nursing_home: 'Nursing Home',
    assisted_living_facility: 'Nursing Home',
    senior_citizen_center: 'Active Ageing Centre',
    social_services_organization: 'Social Service Office',
    government_office: 'Social Service Office',
    hindu_temple: 'Temple',
    buddhist_temple: 'Temple',
    taoist_temple: 'Temple',
    church: 'Church',
    mosque: 'Mosque',
};

const POSTAL_SEARCH_KEYWORDS = [
    { label: 'Active Ageing Centre', query: 'active ageing centre', boost: 1.25 },
    { label: 'Community Club', query: 'community club', boost: 1.15 },
    { label: 'Community Centre', query: 'community centre', boost: 1.05 },
    { label: 'Polyclinic', query: 'polyclinic', boost: 1.15 },
    { label: 'Clinic', query: 'clinic', boost: 1.0 },
    { label: 'Hospital', query: 'hospital', boost: 1.1 },
    { label: 'Nursing Home', query: 'nursing home', boost: 1.05 },
    { label: 'Social Service Office', query: 'social service office', boost: 1.0 },
    { label: 'Church', query: 'church', boost: 0.95 },
    { label: 'Mosque', query: 'mosque', boost: 0.95 },
    { label: 'Temple', query: 'temple', boost: 0.95 },
];

const POSTAL_SEARCH_LIMITS = {
    anchorSearchCount: 8,
    querySearchCount: 8,
    exactResultCount: 8,
    nearbyResultCount: 12,
};

const SEARCH_FIELD_MASK = 'places.id,places.name,places.displayName,places.formattedAddress,places.postalAddress,places.location,places.nationalPhoneNumber,places.regularOpeningHours,places.websiteUri,places.googleMapsUri,places.primaryType,places.editorialSummary';
const DETAIL_FIELD_MASK = 'id,name,displayName,formattedAddress,postalAddress,location,nationalPhoneNumber,regularOpeningHours,websiteUri,googleMapsUri,primaryType,editorialSummary';

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeSearchText(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitRefineKeywords(value) {
    return normalizeSearchText(value)
        .split(' ')
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizePostalCode(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 6 ? digits : '';
}

function buildUserAgent() {
    return 'CareAroundSGImport/1.0';
}

function placeDisplayName(place) {
    return normalizeText(place?.displayName?.text || place?.displayName);
}

function buildPlaceResourceName(placeOrId) {
    if (typeof placeOrId === 'string') {
        const value = normalizeText(placeOrId);
        if (!value) return '';
        return value.startsWith('places/') ? value : `places/${value}`;
    }

    const resourceName = normalizeText(placeOrId?.name);
    if (resourceName) return resourceName;

    const placeId = normalizeText(placeOrId?.id);
    return placeId ? `places/${placeId}` : '';
}

function ensureGoogleMapsUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(String(rawUrl || '').trim());
    } catch {
        throw new Error('Enter a valid Google Maps share link.');
    }

    const host = parsed.hostname.toLowerCase();
    if (!GOOGLE_MAP_HOSTS.has(host) && !host.endsWith('.google.com')) {
        throw new Error('Only Google Maps share links are supported in this wizard.');
    }

    return parsed;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 8000) {
    const timeoutSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(timeoutMs)
        : undefined;

    return fetch(url, {
        ...init,
        signal: timeoutSignal,
    });
}

function isGoogleShareErrorUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase();
        const pathname = parsed.pathname.toLowerCase();
        if (host === 'share.google' && pathname === '/error') {
            return true;
        }
        if ((host === 'www.google.com' || host === 'google.com') && pathname === '/share.google') {
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

async function resolveFinalGoogleMapsUrl(shareUrl) {
    const firstHop = await fetchWithTimeout(shareUrl, {
        headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': buildUserAgent(),
        },
        redirect: 'manual',
    });

    const firstHopLocation = firstHop.headers.get('location') || '';
    if (isGoogleShareErrorUrl(firstHopLocation)) {
        throw new Error('This Google share link is not resolving to a place. Open it in your browser, wait for the place page to load, then copy that final Google URL instead.');
    }

    const response = await fetchWithTimeout(shareUrl, {
        headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': buildUserAgent(),
        },
        redirect: 'follow',
    });

    if (!response.ok) {
        throw new Error('Google Maps link could not be resolved.');
    }

    if (isGoogleShareErrorUrl(response.url || '')) {
        throw new Error('This Google share link is not resolving to a place. Open it in your browser, wait for the place page to load, then copy that final Google URL instead.');
    }

    return response.url || shareUrl;
}

function extractPathPlaceName(pathname) {
    const placeMatch = pathname.match(/\/maps\/place\/([^/]+)/i);
    if (!placeMatch?.[1]) return '';
    return decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
}

function extractQueryCandidates(rawUrl) {
    const parsed = new URL(rawUrl);
    const params = parsed.searchParams;
    const candidates = [
        params.get('q'),
        params.get('query'),
        params.get('destination'),
        extractPathPlaceName(parsed.pathname),
    ]
        .map((value) => normalizeText(value))
        .filter(Boolean);

    return [...new Set(candidates)];
}

function inferRegionCode(queryCandidates) {
    const combined = queryCandidates.join(' ').toLowerCase();
    if (/\b\d{6}\b/.test(combined) || /\bsingapore\b/.test(combined)) {
        return 'SG';
    }
    return undefined;
}

function computeTokenOverlap(left, right) {
    const leftTokens = new Set(normalizeSearchText(left).split(' ').filter(Boolean));
    const rightTokens = new Set(normalizeSearchText(right).split(' ').filter(Boolean));
    if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

    let matches = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) matches += 1;
    }
    return matches / Math.max(leftTokens.size, rightTokens.size);
}

function scoreCandidate(place, query) {
    const placeName = placeDisplayName(place);
    const address = normalizeText(place?.formattedAddress);
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return 0;

    let score = 0;
    const normalizedPlaceName = normalizeSearchText(placeName);
    const normalizedQueryText = normalizeSearchText(normalizedQuery);

    if (normalizedPlaceName && normalizedQueryText) {
        if (normalizedPlaceName === normalizedQueryText) score += 0.7;
        if (normalizedPlaceName.includes(normalizedQueryText) || normalizedQueryText.includes(normalizedPlaceName)) score += 0.25;
    }

    score += computeTokenOverlap(placeName, normalizedQuery) * 0.5;
    score += computeTokenOverlap(address, normalizedQuery) * 0.2;

    return Math.min(score, 1);
}

function extractPostalCode(place) {
    const direct = normalizePostalCode(place?.postalAddress?.postalCode);
    if (direct) return direct;
    const formatted = normalizeText(place?.formattedAddress);
    const match = formatted.match(/\b\d{6}\b/);
    return match?.[0] || '';
}

function formatOpeningHours(place) {
    const weekdayDescriptions = place?.regularOpeningHours?.weekdayDescriptions;
    if (Array.isArray(weekdayDescriptions) && weekdayDescriptions.length > 0) {
        return weekdayDescriptions.map((line) => normalizeText(line)).filter(Boolean).join('; ');
    }
    return '';
}

function suggestSubCategory(primaryType, availableSubCategories = []) {
    const mapped = PRIMARY_TYPE_TO_SUBCATEGORY[normalizeText(primaryType).toLowerCase()];
    if (!mapped) return '';
    if (!Array.isArray(availableSubCategories) || availableSubCategories.length === 0) return mapped;
    return availableSubCategories.includes(mapped) ? mapped : '';
}

function getGoogleMapsApiKey(env) {
    return env?.GOOGLE_MAPS_API_KEY || env?.GOOGLE_PLACES_API_KEY || '';
}

async function runTextSearch(apiKey, textQuery, { maxResultCount = 5, regionCode, locationBias } = {}) {
    const response = await fetchWithTimeout('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': SEARCH_FIELD_MASK,
        },
        body: JSON.stringify({
            textQuery,
            languageCode: 'en',
            maxResultCount,
            ...(regionCode ? { regionCode } : {}),
            ...(locationBias ? { locationBias } : {}),
        }),
    }, 8000);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Places search failed: ${errorText || response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data?.places) ? data.places : [];
}

function buildLocationBias(anchor, radius = 1000) {
    const latitude = Number(anchor?.latitude);
    const longitude = Number(anchor?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;

    return {
        circle: {
            center: {
                latitude,
                longitude,
            },
            radius,
        },
    };
}

async function fetchPlaceDetails(apiKey, placeOrId) {
    const resourceName = buildPlaceResourceName(placeOrId);
    if (!resourceName) {
        throw new Error('Google place details could not be resolved.');
    }

    const response = await fetchWithTimeout(`https://places.googleapis.com/v1/${resourceName}`, {
        headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': DETAIL_FIELD_MASK,
        },
    }, 8000);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Places details failed: ${errorText || response.status}`);
    }

    return response.json();
}

async function searchPlaces(apiKey, queryCandidates) {
    const regionCode = inferRegionCode(queryCandidates);
    const results = [];

    for (const query of queryCandidates) {
        const places = await runTextSearch(apiKey, query, {
            maxResultCount: 5,
            ...(regionCode ? { regionCode } : {}),
        });

        for (const place of places) {
            results.push({ place, query, score: scoreCandidate(place, query) });
        }

        if (places.length > 0) break;
    }

    if (results.length === 0) {
        throw new Error('No confident Google place match was found from that share link.');
    }

    results.sort((left, right) => right.score - left.score);
    const top = results[0];
    const second = results[1];

    if (top.score < 0.25) {
        throw new Error('The Google Maps link did not resolve to a confident place match.');
    }

    if (second && second.score >= 0.25 && Math.abs(top.score - second.score) < 0.05) {
        throw new Error('The Google Maps link matched multiple possible places. Try a more specific share link.');
    }

    return top.place;
}

async function resolveGooglePlaceFromShareUrl(apiKey, shareUrl) {
    const validatedUrl = ensureGoogleMapsUrl(shareUrl).toString();
    const finalUrl = await resolveFinalGoogleMapsUrl(validatedUrl);
    const queryCandidates = extractQueryCandidates(finalUrl);
    if (queryCandidates.length === 0) {
        throw new Error('That Google Maps link could not be turned into a place search query.');
    }

    const candidatePlace = await searchPlaces(apiKey, queryCandidates);
    const place = await fetchPlaceDetails(apiKey, candidatePlace);

    return {
        place,
        googleMapsUri: normalizeText(place?.googleMapsUri || finalUrl),
    };
}

async function resolveGooglePlaceById(apiKey, googlePlaceId, googleMapsUri = '') {
    const placeId = normalizeText(googlePlaceId);
    if (!placeId) {
        throw new Error('googlePlaceId is required to preview that candidate.');
    }

    const place = await fetchPlaceDetails(apiKey, placeId);
    return {
        place,
        googleMapsUri: normalizeText(place?.googleMapsUri || googleMapsUri),
    };
}

async function resolvePostalAnchor(apiKey, rawPostalCode) {
    const postalCode = normalizePostalCode(rawPostalCode);
    if (!postalCode) {
        throw new Error('Enter a valid 6-digit Singapore postal code.');
    }

    const places = await runTextSearch(apiKey, postalCode, {
        maxResultCount: POSTAL_SEARCH_LIMITS.anchorSearchCount,
        regionCode: 'SG',
    });
    const candidate = places.find((place) => extractPostalCode(place) === postalCode && normalizeText(place?.primaryType).toLowerCase() === 'postal_code')
        || places.find((place) => extractPostalCode(place) === postalCode)
        || places[0];

    if (!candidate) {
        throw new Error('No Google location was found for that postal code.');
    }

    const place = await fetchPlaceDetails(apiKey, candidate);
    const latitude = Number(place?.location?.latitude);
    const longitude = Number(place?.location?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Google did not return coordinates for that postal code.');
    }

    return {
        postalCode,
        address: normalizeText(place?.formattedAddress),
        googleMapsUri: normalizeText(place?.googleMapsUri),
        latitude,
        longitude,
    };
}

function buildPostalSearchQueries(anchor, keywordQuery = '') {
    const trimmedAddress = normalizeText(anchor?.address).replace(new RegExp(`,?\\s*Singapore\\s+${anchor.postalCode}$`, 'i'), '').trim();
    const queryMap = new Map();

    for (const keyword of POSTAL_SEARCH_KEYWORDS) {
        const variants = [
            `${anchor.postalCode} ${keyword.query}`,
            trimmedAddress ? `${trimmedAddress} ${keyword.query}` : '',
        ]
            .map((value) => normalizeText(value))
            .filter(Boolean);

        for (const textQuery of variants) {
            if (!queryMap.has(textQuery)) {
                queryMap.set(textQuery, {
                    textQuery,
                    label: keyword.label,
                    boost: keyword.boost,
                });
            }
        }
    }

    const normalizedKeywordQuery = normalizeText(keywordQuery);
    if (normalizedKeywordQuery) {
        const keywordVariants = [
            `${anchor.postalCode} ${normalizedKeywordQuery}`,
            trimmedAddress ? `${trimmedAddress} ${normalizedKeywordQuery}` : '',
        ]
            .map((value) => normalizeText(value))
            .filter(Boolean);

        for (const textQuery of keywordVariants) {
            if (!queryMap.has(textQuery)) {
                queryMap.set(textQuery, {
                    textQuery,
                    label: normalizedKeywordQuery,
                    boost: 1.3,
                    isRefine: true,
                });
            }
        }
    }

    return [...queryMap.values()];
}

function buildPostalCandidateScore(place, queryMeta, queryIndex, postalCode, keywordQuery = '') {
    const primaryType = normalizeText(place?.primaryType).toLowerCase();
    if (primaryType === 'postal_code') return -Infinity;

    const placeName = placeDisplayName(place);
    const formattedAddress = normalizeText(place?.formattedAddress);
    const samePostal = extractPostalCode(place) === postalCode;
    const normalizedPrimaryType = primaryType.replace(/_/g, ' ');
    const refineKeywords = splitRefineKeywords(keywordQuery);

    let score = queryMeta.boost;
    score += Math.max(0, 1 - queryIndex * 0.04);
    score += computeTokenOverlap(placeName, queryMeta.label) * 0.35;
    score += computeTokenOverlap(formattedAddress, postalCode) * 0.3;

    if (samePostal) score += 1.15;
    if (PRIMARY_TYPE_TO_SUBCATEGORY[primaryType]) score += 0.35;
    if (normalizeSearchText(placeName) === normalizeSearchText(postalCode)) score -= 2;

    if (refineKeywords.length > 0) {
        const refineText = refineKeywords.join(' ');
        const refineOverlap = Math.max(
            computeTokenOverlap(placeName, refineText),
            computeTokenOverlap(formattedAddress, refineText),
            computeTokenOverlap(normalizedPrimaryType, refineText),
        );

        if (refineOverlap === 0 && !samePostal) {
            score -= 0.9;
        } else {
            score += refineOverlap * 0.7;
        }
    }

    return score;
}

async function searchPostalCandidates(apiKey, anchor, availableHardSubCategories = [], keywordQuery = '') {
    const queryPlan = buildPostalSearchQueries(anchor, keywordQuery);
    const candidateMap = new Map();
    const warnings = [];

    for (let queryIndex = 0; queryIndex < queryPlan.length; queryIndex += 1) {
        const queryMeta = queryPlan[queryIndex];
        let places = [];

        try {
            places = await runTextSearch(apiKey, queryMeta.textQuery, {
                maxResultCount: POSTAL_SEARCH_LIMITS.querySearchCount,
                regionCode: 'SG',
                locationBias: buildLocationBias(anchor),
            });
        } catch (error) {
            warnings.push(error.message || `Google Places search failed for "${queryMeta.label}".`);
            continue;
        }

        for (const place of places) {
            const googlePlaceId = normalizeText(place?.id);
            if (!googlePlaceId) continue;

            const score = buildPostalCandidateScore(place, queryMeta, queryIndex, anchor.postalCode, keywordQuery);
            if (!Number.isFinite(score) || score <= 0) continue;

            const existing = candidateMap.get(googlePlaceId);
            const nextCandidate = existing || {
                googlePlaceId,
                googleMapsUri: normalizeText(place?.googleMapsUri),
                name: placeDisplayName(place),
                address: normalizeText(place?.formattedAddress),
                primaryType: normalizeText(place?.primaryType),
                postalCode: extractPostalCode(place),
                subCategorySuggestion: suggestSubCategory(place?.primaryType, availableHardSubCategories),
                matchedKeywords: new Set(),
                score: 0,
            };

            nextCandidate.score = Math.max(nextCandidate.score, score) + (existing ? 0.08 : 0);
            nextCandidate.matchedKeywords.add(queryMeta.label);
            candidateMap.set(googlePlaceId, nextCandidate);
        }

        const samePostalCount = [...candidateMap.values()].filter((candidate) => candidate.postalCode === anchor.postalCode).length;
        if (samePostalCount >= POSTAL_SEARCH_LIMITS.exactResultCount) break;
    }

    const candidates = [...candidateMap.values()];
    const exactCandidates = candidates
        .filter((candidate) => candidate.postalCode === anchor.postalCode)
        .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
        .slice(0, POSTAL_SEARCH_LIMITS.exactResultCount);
    const exactCandidateIds = new Set(exactCandidates.map((candidate) => candidate.googlePlaceId));
    const nearbyCandidates = candidates
        .filter((candidate) => !exactCandidateIds.has(candidate.googlePlaceId))
        .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
        .slice(0, POSTAL_SEARCH_LIMITS.nearbyResultCount);

    if (exactCandidates.length === 0 && nearbyCandidates.length > 0) {
        warnings.push('No exact postal-code matches were found, so nearby Google places are shown instead.');
    }

    return {
        exactCandidates: exactCandidates.map((candidate) => ({
            googlePlaceId: candidate.googlePlaceId,
            googleMapsUri: candidate.googleMapsUri,
            name: candidate.name,
            address: candidate.address,
            primaryType: candidate.primaryType,
            postalCode: candidate.postalCode,
            subCategorySuggestion: candidate.subCategorySuggestion,
            matchedKeywords: [...candidate.matchedKeywords].slice(0, 4),
        })),
        nearbyCandidates: nearbyCandidates.map((candidate) => ({
            googlePlaceId: candidate.googlePlaceId,
            googleMapsUri: candidate.googleMapsUri,
            name: candidate.name,
            address: candidate.address,
            primaryType: candidate.primaryType,
            postalCode: candidate.postalCode,
            subCategorySuggestion: candidate.subCategorySuggestion,
            matchedKeywords: [...candidate.matchedKeywords].slice(0, 4),
        })),
        warnings,
    };
}

export async function searchGooglePlaceCandidatesByPostal(env, postalCode, availableHardSubCategories = [], keywordQuery = '') {
    const apiKey = getGoogleMapsApiKey(env);
    if (!apiKey) {
        throw new Error('Google Places API is not configured on the server.');
    }

    const anchor = await resolvePostalAnchor(apiKey, postalCode);
    const { exactCandidates, nearbyCandidates, warnings } = await searchPostalCandidates(
        apiKey,
        anchor,
        availableHardSubCategories,
        keywordQuery,
    );

    if (exactCandidates.length === 0 && nearbyCandidates.length === 0) {
        warnings.push('No Google place candidates were found for that postal code. Try a Google Maps share link or create the place manually.');
    }

    return {
        resolvedPostal: anchor,
        exactCandidates,
        nearbyCandidates,
        warnings,
    };
}

export async function resolveGooglePlacePreview(env, input, availableHardSubCategories = []) {
    const apiKey = getGoogleMapsApiKey(env);
    if (!apiKey) {
        throw new Error('Google Places API is not configured on the server.');
    }

    const shareUrl = typeof input === 'string' ? normalizeText(input) : normalizeText(input?.shareUrl);
    const googlePlaceId = typeof input === 'object' ? normalizeText(input?.googlePlaceId) : '';
    const googleMapsUri = typeof input === 'object' ? normalizeText(input?.googleMapsUri) : '';

    let resolvedPlace = null;

    if (googlePlaceId) {
        resolvedPlace = await resolveGooglePlaceById(apiKey, googlePlaceId, googleMapsUri);
    } else if (shareUrl) {
        resolvedPlace = await resolveGooglePlaceFromShareUrl(apiKey, shareUrl);
    } else {
        throw new Error('Provide either a Google Maps share link or a selected Google place.');
    }

    const place = resolvedPlace.place;
    const website = normalizeText(place?.websiteUri);
    const websiteMetadata = website ? await fetchWebsiteMetadata(website) : { description: '', logoUrl: '', warnings: [] };
    const description = normalizeText(place?.editorialSummary?.text || place?.editorialSummary || websiteMetadata.description);
    const warnings = [];

    if (!website) {
        warnings.push('Google did not return a website for this place.');
    }
    if (!websiteMetadata.logoUrl) {
        warnings.push('No confident logo was found from the linked website metadata.');
    }
    if (!description) {
        warnings.push('No description was found. Review and add one before saving if needed.');
    }

    for (const warning of websiteMetadata.warnings || []) {
        if (warning && !warnings.includes(warning)) {
            warnings.push(warning);
        }
    }

    const suggestion = {
        name: placeDisplayName(place),
        country: normalizeText(place?.postalAddress?.regionCode) || 'SG',
        postalCode: extractPostalCode(place),
        address: normalizeText(place?.formattedAddress),
        phone: normalizeText(place?.nationalPhoneNumber),
        hours: formatOpeningHours(place),
        description,
        website,
        logoUrl: normalizeText(websiteMetadata.logoUrl),
        subCategorySuggestion: suggestSubCategory(place?.primaryType, availableHardSubCategories),
    };

    if (!suggestion.subCategorySuggestion) {
        warnings.push('Review the suggested sub-category before saving this place.');
    }

    return {
        resolvedSource: {
            googlePlaceId: normalizeText(place?.id),
            googleMapsUri: normalizeText(resolvedPlace.googleMapsUri || place?.googleMapsUri || shareUrl),
            website,
        },
        suggestion,
        warnings,
    };
}
