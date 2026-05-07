import { userPhoneIdentities } from '../db/schema.js';
import { normalizeSingaporePhoneIdentity } from './phoneIdentity.js';
import { maskPhoneIdentity } from './phoneIdentityAudit.js';

export const LEGACY_PHONE_IDENTITY_STATUS = 'legacy_unverified';
export const LEGACY_PHONE_IDENTITY_SOURCE = 'legacy_profile';

function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === '';
}

function serializeAccount(row) {
    return {
        id: row.id,
        username: row.username || '',
        role: row.role || '',
        managerUserId: row.managerUserId ?? null,
    };
}

function normalizeIdentityRow(row) {
    return {
        userId: row?.userId ?? row?.user_id ?? null,
        phoneE164: row?.phoneE164 ?? row?.phone_e164 ?? null,
    };
}

function buildInsertRow(user, phoneE164) {
    return {
        userId: user.id,
        phoneE164,
        countryCode: '+65',
        nationalNumber: phoneE164.slice(3),
        status: LEGACY_PHONE_IDENTITY_STATUS,
        source: LEGACY_PHONE_IDENTITY_SOURCE,
    };
}

export function buildPhoneIdentityBackfillPlan(userRows, existingIdentityRows = []) {
    const usersList = Array.isArray(userRows) ? userRows : [];
    const identitiesList = Array.isArray(existingIdentityRows) ? existingIdentityRows : [];
    const existingUserIds = new Set();
    const existingPhones = new Set();

    for (const row of identitiesList) {
        const identity = normalizeIdentityRow(row);
        if (identity.userId !== null && identity.userId !== undefined) {
            existingUserIds.add(identity.userId);
        }
        if (!isBlank(identity.phoneE164)) {
            existingPhones.add(String(identity.phoneE164).trim());
        }
    }

    const validEntriesByPhone = new Map();
    const invalidOrSkippedUsers = [];
    let usersWithPhoneValues = 0;

    for (const user of usersList) {
        if (!isBlank(user?.phone)) {
            usersWithPhoneValues += 1;
        }

        const phoneE164 = normalizeSingaporePhoneIdentity(user?.phone);
        if (!phoneE164) {
            invalidOrSkippedUsers.push({
                ...serializeAccount(user || {}),
                reason: isBlank(user?.phone) ? 'blank_phone' : 'invalid_phone',
            });
            continue;
        }

        if (!validEntriesByPhone.has(phoneE164)) {
            validEntriesByPhone.set(phoneE164, []);
        }
        validEntriesByPhone.get(phoneE164).push({ user, phoneE164 });
    }

    const duplicateGroups = [];
    const duplicatePhones = new Set();
    for (const [phoneE164, entries] of validEntriesByPhone.entries()) {
        if (entries.length <= 1) continue;
        duplicatePhones.add(phoneE164);
        duplicateGroups.push({
            phone: maskPhoneIdentity(phoneE164),
            accountCount: entries.length,
            accounts: entries.map((entry) => serializeAccount(entry.user)),
        });
    }

    duplicateGroups.sort((left, right) => right.accountCount - left.accountCount || left.phone.localeCompare(right.phone));

    const existingIdentitySkips = [];
    const eligibleUsers = [];
    const insertRows = [];

    for (const [phoneE164, entries] of validEntriesByPhone.entries()) {
        if (duplicatePhones.has(phoneE164)) continue;
        const [{ user }] = entries;
        const existingReasons = [];
        if (existingUserIds.has(user.id)) existingReasons.push('user_already_has_identity');
        if (existingPhones.has(phoneE164)) existingReasons.push('phone_already_has_identity');

        if (existingReasons.length > 0) {
            existingIdentitySkips.push({
                ...serializeAccount(user),
                phone: maskPhoneIdentity(phoneE164),
                reasons: existingReasons,
            });
            continue;
        }

        eligibleUsers.push({
            ...serializeAccount(user),
            phone: maskPhoneIdentity(phoneE164),
        });
        insertRows.push(buildInsertRow(user, phoneE164));
    }

    return {
        totalUsersChecked: usersList.length,
        usersWithPhoneValues,
        validNormalizedSgPhones: [...validEntriesByPhone.values()].reduce((total, entries) => total + entries.length, 0),
        invalidOrSkippedPhones: invalidOrSkippedUsers.length,
        duplicatePhoneGroupsCount: duplicateGroups.length,
        accountsInvolvedInDuplicateGroups: duplicateGroups.reduce((total, group) => total + group.accountCount, 0),
        existingIdentityRows: identitiesList.length,
        existingIdentitySkippedCount: existingIdentitySkips.length,
        eligibleBackfillCount: insertRows.length,
        duplicateGroups,
        invalidOrSkippedUsers,
        existingIdentitySkips,
        eligibleUsers,
        insertRows,
    };
}

export async function applyPhoneIdentityBackfillPlan(db, plan, options = {}) {
    const apply = options.apply === true;
    const insertRows = Array.isArray(plan?.insertRows) ? plan.insertRows : [];

    if (!apply || insertRows.length === 0) {
        return {
            mode: apply ? 'apply' : 'dry-run',
            insertedCount: 0,
        };
    }

    await db.insert(userPhoneIdentities)
        .values(insertRows)
        .onConflictDoNothing();

    return {
        mode: 'apply',
        insertedCount: insertRows.length,
    };
}

export function serializePhoneIdentityBackfillReport(plan, result = {}) {
    return {
        mode: result.mode || 'dry-run',
        totalUsersChecked: plan.totalUsersChecked,
        usersWithPhoneValues: plan.usersWithPhoneValues,
        validNormalizedSgPhones: plan.validNormalizedSgPhones,
        invalidOrSkippedPhones: plan.invalidOrSkippedPhones,
        duplicatePhoneGroupsCount: plan.duplicatePhoneGroupsCount,
        accountsInvolvedInDuplicateGroups: plan.accountsInvolvedInDuplicateGroups,
        existingIdentityRows: plan.existingIdentityRows,
        existingIdentitySkippedCount: plan.existingIdentitySkippedCount,
        eligibleBackfillCount: plan.eligibleBackfillCount,
        insertedCount: result.insertedCount || 0,
        duplicateGroups: plan.duplicateGroups,
        invalidOrSkippedUsers: plan.invalidOrSkippedUsers,
        existingIdentitySkips: plan.existingIdentitySkips,
        eligibleUsers: plan.eligibleUsers,
        note: result.mode === 'apply'
            ? 'Apply mode was explicitly requested with --apply.'
            : 'Dry run only. No phone identity rows were inserted.',
    };
}
