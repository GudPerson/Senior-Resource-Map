import { and, eq, inArray } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { softAssetLocations, userAssetMemberships } from '../db/schema.js';
import { getAgeFromDateOfBirth } from './profileAttributes.js';
import { getSoftAssetLocations, isChildSoftAsset } from './softAssetHierarchy.js';

export const OFFERING_ACCESS = Object.freeze({
    GRANTED: 'GRANTED',
    DENIED: 'DENIED',
    LOCKED_MISSING_DATA: 'LOCKED_MISSING_DATA',
});

function normalizeRuleArray(values) {
    if (!Array.isArray(values)) return [];
    return [...new Set(
        values
            .map((value) => String(value || '').trim().toLowerCase())
            .filter(Boolean)
    )];
}

function normalizeRuleObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export function normalizeEligibilityRules(rawRules) {
    if (!rawRules || typeof rawRules !== 'object' || Array.isArray(rawRules)) {
        return null;
    }

    const version = Number.isInteger(rawRules.version) ? rawRules.version : 1;
    const criteria = normalizeRuleObject(rawRules.criteria) || {};
    const normalized = { version, criteria: {} };

    const age = normalizeRuleObject(criteria.age);
    if (age) {
        const nextAge = {};
        const min = age.min !== undefined ? Number.parseInt(age.min, 10) : null;
        const max = age.max !== undefined ? Number.parseInt(age.max, 10) : null;

        if (min !== null) {
            if (!Number.isInteger(min) || min < 0) {
                const error = new Error('Eligibility age minimum must be a non-negative whole number.');
                error.status = 400;
                throw error;
            }
            nextAge.min = min;
        }

        if (max !== null) {
            if (!Number.isInteger(max) || max < 0) {
                const error = new Error('Eligibility age maximum must be a non-negative whole number.');
                error.status = 400;
                throw error;
            }
            nextAge.max = max;
        }

        if (nextAge.min !== undefined && nextAge.max !== undefined && nextAge.max < nextAge.min) {
            const error = new Error('Eligibility age maximum must be greater than or equal to the minimum.');
            error.status = 400;
            throw error;
        }

        if (Object.keys(nextAge).length > 0) {
            normalized.criteria.age = nextAge;
        }
    }

    const gender = normalizeRuleObject(criteria.gender);
    if (gender) {
        const anyOf = normalizeRuleArray(gender.anyOf);
        if (anyOf.length > 0) {
            normalized.criteria.gender = { anyOf };
        }
    }

    const propertyType = normalizeRuleObject(criteria.propertyType);
    if (propertyType) {
        const anyOf = normalizeRuleArray(propertyType.anyOf);
        if (anyOf.length > 0) {
            normalized.criteria.propertyType = { anyOf };
        }
    }

    return Object.keys(normalized.criteria).length > 0 ? normalized : null;
}

export function getMissingEligibilityProfileFields(rules, user) {
    if (!rules?.criteria) return [];

    const missing = [];
    if (rules.criteria.age && !user?.dateOfBirth) {
        missing.push('dateOfBirth');
    }
    if (rules.criteria.gender && !user?.gender) {
        missing.push('gender');
    }
    if (rules.criteria.propertyType && !user?.propertyType) {
        missing.push('propertyType');
    }
    return missing;
}

function evaluateRuleCriteria(rules, user) {
    if (!rules?.criteria) {
        return { status: OFFERING_ACCESS.GRANTED, missingProfileFields: [] };
    }

    const missingProfileFields = [];
    const hardMismatches = [];
    const age = getAgeFromDateOfBirth(user?.dateOfBirth);

    if (rules.criteria.age) {
        if (age === null) {
            missingProfileFields.push('dateOfBirth');
        } else {
            if (rules.criteria.age.min !== undefined && age < rules.criteria.age.min) {
                hardMismatches.push('age');
            }
            if (rules.criteria.age.max !== undefined && age > rules.criteria.age.max) {
                hardMismatches.push('age');
            }
        }
    }

    if (rules.criteria.gender) {
        const userGender = String(user?.gender || '').trim().toLowerCase();
        if (!userGender) {
            missingProfileFields.push('gender');
        } else if (!rules.criteria.gender.anyOf.includes(userGender)) {
            hardMismatches.push('gender');
        }
    }

    if (rules.criteria.propertyType) {
        const userPropertyType = String(user?.propertyType || '').trim().toLowerCase();
        if (!userPropertyType) {
            missingProfileFields.push('propertyType');
        } else if (!rules.criteria.propertyType.anyOf.includes(userPropertyType)) {
            hardMismatches.push('propertyType');
        }
    }

    if (hardMismatches.length > 0) {
        return { status: OFFERING_ACCESS.DENIED, missingProfileFields: [] };
    }

    if (missingProfileFields.length > 0) {
        return {
            status: OFFERING_ACCESS.LOCKED_MISSING_DATA,
            missingProfileFields: [...new Set(missingProfileFields)],
        };
    }

    return { status: OFFERING_ACCESS.GRANTED, missingProfileFields: [] };
}

export async function buildEligibilityContext(db, user) {
    if (!user?.id) {
        return {
            activeMembershipHardAssetIds: new Set(),
        };
    }

    if (!db?.select || typeof db.select !== 'function') {
        return {
            activeMembershipHardAssetIds: new Set(),
        };
    }

    const rows = await db.select({
        hardAssetId: userAssetMemberships.hardAssetId,
    }).from(userAssetMemberships).where(and(
        eq(userAssetMemberships.userId, user.id),
        eq(userAssetMemberships.status, 'ACTIVE'),
    ));

    return {
        activeMembershipHardAssetIds: new Set(rows.map((row) => row.hardAssetId).filter(Number.isInteger)),
    };
}

export async function getSoftAssetMembershipHostIds(db, asset) {
    if (!asset) return [];
    if (isChildSoftAsset(asset) && Number.isInteger(asset.hostHardAssetId)) {
        return [asset.hostHardAssetId];
    }

    const preloadedLocations = getSoftAssetLocations(asset)
        .map((location) => location?.id)
        .filter(Number.isInteger);

    if (preloadedLocations.length > 0) {
        return [...new Set(preloadedLocations)];
    }

    if (!Number.isInteger(asset.id)) return [];
    if (!db?.select || typeof db.select !== 'function') return [];
    const rows = await db.select({
        hardAssetId: softAssetLocations.hardAssetId,
    }).from(softAssetLocations).where(eq(softAssetLocations.softAssetId, asset.id));
    return [...new Set(rows.map((row) => row.hardAssetId).filter(Number.isInteger))];
}

export async function buildMembershipHostIdMap(db, assets) {
    const childHostIds = new Map();
    const standaloneIdsNeedingLookup = [];

    for (const asset of assets || []) {
        if (!asset?.id) continue;
        if (isChildSoftAsset(asset)) {
            childHostIds.set(asset.id, Number.isInteger(asset.hostHardAssetId) ? [asset.hostHardAssetId] : []);
            continue;
        }

        const preloaded = getSoftAssetLocations(asset)
            .map((location) => location?.id)
            .filter(Number.isInteger);
        if (preloaded.length > 0) {
            childHostIds.set(asset.id, [...new Set(preloaded)]);
        } else {
            standaloneIdsNeedingLookup.push(asset.id);
        }
    }

    if (standaloneIdsNeedingLookup.length > 0 && db?.select && typeof db.select === 'function') {
        const rows = await db.select({
            softAssetId: softAssetLocations.softAssetId,
            hardAssetId: softAssetLocations.hardAssetId,
        }).from(softAssetLocations).where(inArray(softAssetLocations.softAssetId, standaloneIdsNeedingLookup));

        for (const assetId of standaloneIdsNeedingLookup) {
            const hostIds = rows
                .filter((row) => row.softAssetId === assetId)
                .map((row) => row.hardAssetId)
                .filter(Number.isInteger);
            childHostIds.set(assetId, [...new Set(hostIds)]);
        }
    }

    return childHostIds;
}

export function evaluateOfferingAccess(asset, viewer, eligibilityContext, membershipHostIds = []) {
    const rules = normalizeEligibilityRules(asset?.eligibilityRules);
    const criteriaResult = evaluateRuleCriteria(rules, viewer);

    if (criteriaResult.status === OFFERING_ACCESS.DENIED) {
        return criteriaResult;
    }

    const membershipRequired = Boolean(asset?.isMemberOnly);
    if (membershipRequired) {
        const activeMembershipHardAssetIds = eligibilityContext?.activeMembershipHardAssetIds || new Set();
        const hasMatchingMembership = membershipHostIds.some((hardAssetId) => activeMembershipHardAssetIds.has(hardAssetId));
        if (!hasMatchingMembership) {
            return {
                status: OFFERING_ACCESS.DENIED,
                missingProfileFields: [],
            };
        }
    }

    return criteriaResult;
}

export function getOfferingAccessMetadata(asset, viewer, eligibilityContext, membershipHostIdMapOrArray = []) {
    const membershipHostIds = Array.isArray(membershipHostIdMapOrArray)
        ? membershipHostIdMapOrArray
        : membershipHostIdMapOrArray?.get?.(asset?.id) || [];
    const result = evaluateOfferingAccess(asset, viewer, eligibilityContext, membershipHostIds);
    return {
        access: result.status,
        missingProfileFields: result.missingProfileFields || [],
    };
}
