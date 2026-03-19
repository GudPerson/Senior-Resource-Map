import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { subregions, users, userSubregions } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { normalizePostalCode } from '../utils/postalBoundaries.js';
import { getOwnershipStatus, canDirectlyManageUser, canRoleOwnUser } from '../utils/ownership.js';
import { resolveSingleSubregionByPostal, syncUserDerivedSubregion } from '../utils/subregionRouting.js';
import { loadScopedBoundaryContext, resolvePostalBoundaryStatus } from '../utils/subregionBoundaryStatus.js';
import { ASSIGNABLE_ROLES, getCreatableRoles, normalizeRole } from '../utils/roles.js';
import { createSessionToken, needsPostalCodeCompletion, setAuthCookie } from '../utils/sessionAuth.js';

function accessError(message, status = 403) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function normalizeText(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function parseSubregionIds(rawSubregionIds) {
    const input = Array.isArray(rawSubregionIds)
        ? rawSubregionIds
        : [rawSubregionIds].filter(Boolean);

    return [...new Set(
        input
            .flatMap((value) => typeof value === 'string' ? value.split(',') : [value])
            .map((value) => Number.parseInt(String(value).trim(), 10))
            .filter(Number.isInteger)
    )];
}

function parseSubregionReferences(rawSubregionIds) {
    const input = Array.isArray(rawSubregionIds)
        ? rawSubregionIds
        : [rawSubregionIds].filter(Boolean);

    return [...new Set(
        input
            .flatMap((value) => typeof value === 'string' ? value.split(',') : [value])
            .map((value) => String(value).trim())
            .filter(Boolean)
    )];
}

async function resolveSubregionIds(db, rawSubregionIds) {
    const references = parseSubregionReferences(rawSubregionIds);
    if (references.length === 0) return [];

    const numericIds = [];
    const textRefs = [];

    for (const reference of references) {
        const numeric = Number.parseInt(reference, 10);
        if (String(numeric) === reference && Number.isInteger(numeric)) {
            numericIds.push(numeric);
        } else {
            textRefs.push(reference.toLowerCase());
        }
    }

    if (textRefs.length === 0) {
        return [...new Set(numericIds)];
    }

    const availableSubregions = await db.select({
        id: subregions.id,
        subregionCode: subregions.subregionCode,
        name: subregions.name,
    }).from(subregions);

    const byCode = new Map();
    const byName = new Map();
    for (const item of availableSubregions) {
        if (item.subregionCode) byCode.set(String(item.subregionCode).trim().toLowerCase(), item.id);
        if (item.name) byName.set(String(item.name).trim().toLowerCase(), item.id);
    }

    const resolvedIds = [...numericIds];
    for (const reference of textRefs) {
        const resolved = byCode.get(reference) ?? byName.get(reference);
        if (!resolved) {
            throw accessError(`Unknown subregion reference: ${reference}`, 400);
        }
        resolvedIds.push(resolved);
    }

    return [...new Set(resolvedIds)];
}

function isDuplicateUserImportIssue(message) {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('already registered') || normalized.includes('already taken');
}

function getScopedSubregionIds(user) {
    return parseSubregionIds(user?.subregionIds || []);
}

function normalizeRequiredPostalCode(value) {
    const normalized = normalizePostalCode(value);
    if (!normalized) {
        throw accessError('Postal code must be a valid 6-digit code.', 400);
    }
    return normalized;
}

function normalizeOptionalPostalCode(value) {
    if (value === undefined || value === null || String(value).trim() === '') return '';
    return normalizeRequiredPostalCode(value);
}

function resolveRequestedRole(requestedRole, creatorRole) {
    const allowedRoles = getCreatableRoles(creatorRole);
    const normalizedRole = normalizeRole(requestedRole || allowedRoles[0]);

    if (!ASSIGNABLE_ROLES.includes(normalizedRole)) {
        throw accessError('Invalid role specified.', 400);
    }

    if (!allowedRoles.includes(normalizedRole)) {
        const managerLabel = normalizeRole(creatorRole) === 'regional_admin' ? 'Regional admins' : 'Partners';
        throw accessError(`${managerLabel} can only create ${allowedRoles[0] === 'partner' ? 'Partner' : 'User'} accounts.`);
    }

    return normalizedRole;
}

async function loadUserWithSubregions(db, id) {
    const userRow = await db.query.users.findFirst({
        where: eq(users.id, id),
        columns: {
            id: true,
            username: true,
            email: true,
            name: true,
            role: true,
            phone: true,
            postalCode: true,
            createdAt: true,
            managerUserId: true,
        },
        with: {
            manager: {
                columns: {
                    id: true,
                    name: true,
                    role: true,
                    username: true,
                },
            },
            subregions: {
                columns: {
                    subregionId: true,
                },
                with: {
                    subregion: {
                        columns: {
                            id: true,
                            name: true,
                            subregionCode: true,
                        },
                    },
                },
            },
        },
    });

    if (!userRow) return null;

    return {
        id: userRow.id,
        username: userRow.username,
        email: userRow.email,
        name: userRow.name,
        role: normalizeRole(userRow.role),
        phone: userRow.phone,
        postalCode: userRow.postalCode,
        createdAt: userRow.createdAt,
        managerUserId: userRow.managerUserId,
        managerName: userRow.manager?.name || null,
        managerRole: normalizeRole(userRow.manager?.role),
        managerUsername: userRow.manager?.username || null,
        subregionIds: userRow.subregions.map((item) => item.subregionId),
        derivedSubregionId: userRow.subregions[0]?.subregion?.id || null,
        derivedSubregionCode: userRow.subregions[0]?.subregion?.subregionCode || null,
        derivedSubregionName: userRow.subregions[0]?.subregion?.name || null,
    };
}

async function loadUserByReference(db, { userId, username }) {
    const normalizedUsername = normalizeText(username);
    if (Number.isInteger(userId)) {
        return await loadUserWithSubregions(db, userId);
    }

    if (!normalizedUsername) return null;

    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.username, normalizedUsername));
    if (!row) return null;
    return await loadUserWithSubregions(db, row.id);
}

function ensureSubregionWithinManagerScope(managerUser, derivedSubregionId) {
    if (!managerUser || !derivedSubregionId) return;
    if (normalizeRole(managerUser.role) === 'super_admin') return;
    if (!Array.isArray(managerUser.subregionIds) || !managerUser.subregionIds.includes(derivedSubregionId)) {
        throw accessError('Derived subregion is outside the selected manager scope.', 400);
    }
}

function ensureLegacySubregionInputMatches(legacySubregionIds, derivedSubregionId) {
    if (legacySubregionIds.length === 0) return;
    if (legacySubregionIds.length !== 1 || legacySubregionIds[0] !== derivedSubregionId) {
        throw accessError('Provided subregionIds do not match the postal-code-derived subregion.', 400);
    }
}

async function resolveManagerForCreate(db, creator, targetRole, body) {
    const creatorRole = normalizeRole(creator.role);
    const requestedManagerId = Number.parseInt(String(body.managerUserId ?? ''), 10);
    const requestedManagerUsername = body.managerUsername;
    const hasRequestedManagerId = Number.isInteger(requestedManagerId);
    const hasRequestedManagerUsername = normalizeText(requestedManagerUsername).length > 0;

    if (targetRole === 'super_admin') {
        return null;
    }

    if (creatorRole === 'regional_admin') {
        return creator;
    }

    if (creatorRole === 'partner') {
        return creator;
    }

    if (creatorRole !== 'super_admin') {
        return null;
    }

    if (targetRole === 'regional_admin') {
        if (!hasRequestedManagerId && !hasRequestedManagerUsername) {
            return creator;
        }
    } else if (!hasRequestedManagerId && !hasRequestedManagerUsername) {
        throw accessError('managerUserId or managerUsername is required for this role.', 400);
    }

    const manager = await loadUserByReference(db, {
        userId: hasRequestedManagerId ? requestedManagerId : undefined,
        username: requestedManagerUsername,
    });

    if (!manager) {
        throw accessError('Assigned manager was not found.', 404);
    }

    if (!canRoleOwnUser(manager.role, targetRole)) {
        throw accessError('Assigned manager role is invalid for target role.', 400);
    }

    return manager;
}

function validateManagerForTarget(managerUser, targetRole, derivedSubregionId) {
    const normalizedTargetRole = normalizeRole(targetRole);

    if (normalizedTargetRole === 'super_admin') {
        if (managerUser) {
            throw accessError('Super Admin accounts cannot have a manager.', 400);
        }
        return;
    }

    if (normalizedTargetRole === 'regional_admin') {
        if (!managerUser) return;
        if (normalizeRole(managerUser.role) !== 'super_admin') {
            throw accessError('Regional Admin accounts may only be assigned to a Super Admin.', 400);
        }
        return;
    }

    if (normalizedTargetRole === 'partner') {
        if (!managerUser || normalizeRole(managerUser.role) !== 'regional_admin') {
            throw accessError('Partner accounts must be assigned to a Regional Admin.', 400);
        }
        ensureSubregionWithinManagerScope(managerUser, derivedSubregionId);
        return;
    }

    if (normalizedTargetRole === 'standard') {
        if (!managerUser) return;
        if (normalizeRole(managerUser.role) !== 'partner') {
            throw accessError('User accounts may only be assigned to a Partner.', 400);
        }
        ensureSubregionWithinManagerScope(managerUser, derivedSubregionId);
    }
}

async function validateAndResolveDerivedSubregion(db, targetRole, postalCode, legacySubregionIds = []) {
    if (normalizeRole(targetRole) === 'super_admin') {
        return null;
    }

    const derivedSubregion = await resolveSingleSubregionByPostal(db, postalCode, 'Postal code');
    ensureLegacySubregionInputMatches(legacySubregionIds, derivedSubregion.id);
    return derivedSubregion;
}

async function ensureUniqueUserIdentifiers(db, username, email) {
    const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
    if (existingEmail) throw accessError('Email already registered.', 409);

    const [existingUser] = await db.select().from(users).where(eq(users.username, username));
    if (existingUser) throw accessError('Username already taken.', 409);
}

function buildUserResponse(userRow, boundaryContext) {
    return {
        id: userRow.id,
        username: userRow.username,
        email: userRow.email,
        name: userRow.name,
        role: normalizeRole(userRow.role),
        phone: userRow.phone,
        postalCode: userRow.postalCode,
        createdAt: userRow.createdAt,
        managerUserId: userRow.managerUserId || null,
        managerName: userRow.managerName || null,
        managerRole: userRow.managerRole || null,
        managerUsername: userRow.managerUsername || null,
        subregionIds: userRow.subregionIds || [],
        derivedSubregionId: userRow.derivedSubregionId || null,
        derivedSubregionCode: userRow.derivedSubregionCode || null,
        derivedSubregionName: userRow.derivedSubregionName || null,
        needsPostalCode: needsPostalCodeCompletion(userRow),
        ownershipStatus: getOwnershipStatus(userRow),
        boundaryStatus: resolvePostalBoundaryStatus(userRow.postalCode, boundaryContext),
    };
}

export const createUser = async (c) => {
    try {
        const body = await c.req.json();
        const { username, email, password, name, role, phone } = body;
        const creator = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const creatorRole = normalizeRole(creator.role);
        if (getCreatableRoles(creatorRole).length === 0) {
            return c.json({ error: 'Insufficient permissions to create users.' }, 403);
        }

        const finalRole = resolveRequestedRole(role, creatorRole);
        const legacySubregionIds = await resolveSubregionIds(db, body.subregionIds);
        const postalCode = normalizeRole(finalRole) === 'super_admin'
            ? normalizeOptionalPostalCode(body.postalCode)
            : normalizeRequiredPostalCode(body.postalCode);

        const derivedSubregion = await validateAndResolveDerivedSubregion(db, finalRole, postalCode, legacySubregionIds);
        const managerUser = await resolveManagerForCreate(db, creator, finalRole, body);
        validateManagerForTarget(managerUser, finalRole, derivedSubregion?.id);

        await ensureUniqueUserIdentifiers(db, username, email);

        const passwordHash = await bcrypt.hash(password, 12);

        const [newUser] = await db.insert(users).values({
            username,
            email,
            passwordHash,
            name,
            role: finalRole,
            managerUserId: managerUser?.id || null,
            phone: phone || null,
            postalCode,
        }).returning({ id: users.id });

        if (derivedSubregion) {
            await syncUserDerivedSubregion(db, newUser.id, derivedSubregion.id);
        }

        const created = await loadUserWithSubregions(db, newUser.id);
        return c.json(buildUserResponse(created, await loadScopedBoundaryContext(db, creator)), 201);
    } catch (err) {
        console.error('Create User Error:', err);
        return c.json({ error: err.message || 'Failed to create user.' }, err.status || 500);
    }
};

export const bulkCreateUsers = async (c) => {
    try {
        const body = await c.req.json();
        const { rows } = body;
        const creator = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const results = {
            message: 'Bulk import processed',
            successful: 0,
            skipped: 0,
            failed: 0,
            errors: [],
            skippedItems: [],
        };

        if (!Array.isArray(rows)) {
            return c.json({ error: 'Invalid data format. Expected an array of rows.' }, 400);
        }

        const creatorRole = normalizeRole(creator.role);
        const creatableRoles = getCreatableRoles(creatorRole);
        if (creatableRoles.length === 0) {
            return c.json({ error: 'Insufficient permissions to create users.' }, 403);
        }

        for (const row of rows) {
            try {
                const username = normalizeText(row.username);
                const email = normalizeText(row.email);
                const finalRole = resolveRequestedRole(row.role, creatorRole);
                const legacySubregionIds = await resolveSubregionIds(db, row.subregionIds ?? row.subregions ?? row.subregionCode);
                const postalCode = normalizeRole(finalRole) === 'super_admin'
                    ? normalizeOptionalPostalCode(row.postalCode ?? row['Postal Code'])
                    : normalizeRequiredPostalCode(row.postalCode ?? row['Postal Code']);

                if (!username) throw accessError('Username is required', 400);
                if (!email) throw accessError('Email is required', 400);

                const derivedSubregion = await validateAndResolveDerivedSubregion(db, finalRole, postalCode, legacySubregionIds);
                const managerUser = await resolveManagerForCreate(db, creator, finalRole, {
                    managerUserId: row.managerUserId,
                    managerUsername: row.managerUsername,
                });
                validateManagerForTarget(managerUser, finalRole, derivedSubregion?.id);

                await ensureUniqueUserIdentifiers(db, username, email);

                const passwordHash = await bcrypt.hash(normalizeText(row.password) || 'SRM2024!temp', 12);
                const [newUser] = await db.insert(users).values({
                    username,
                    email,
                    passwordHash,
                    name: normalizeText(row.name) || username,
                    role: finalRole,
                    managerUserId: managerUser?.id || null,
                    phone: normalizeText(row.phone) || null,
                    postalCode,
                }).returning({ id: users.id });

                if (derivedSubregion) {
                    await syncUserDerivedSubregion(db, newUser.id, derivedSubregion.id);
                }

                results.successful += 1;
            } catch (err) {
                const message = err.message || 'Unknown import error';
                if (isDuplicateUserImportIssue(message)) {
                    results.skipped += 1;
                    results.skippedItems.push(message);
                } else {
                    results.failed += 1;
                    results.errors.push(message);
                }
            }
        }

        return c.json(results);
    } catch (err) {
        console.error('Bulk Create Error:', err);
        return c.json({ error: 'Failed to process bulk import.' }, 500);
    }
};

export const getUsers = async (c) => {
    try {
        const creator = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const creatorRole = normalizeRole(creator.role);
        const boundaryContext = await loadScopedBoundaryContext(db, creator);

        let usersData = await db.query.users.findMany({
            columns: {
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                postalCode: true,
                createdAt: true,
                managerUserId: true,
            },
            with: {
                manager: {
                    columns: {
                        id: true,
                        name: true,
                        role: true,
                        username: true,
                    },
                },
                subregions: {
                    columns: {
                        subregionId: true,
                    },
                    with: {
                        subregion: {
                            columns: {
                                id: true,
                                name: true,
                                subregionCode: true,
                            },
                        },
                    },
                },
            },
        });

        usersData = usersData.filter((candidate) => {
            if (creatorRole === 'super_admin') return true;
            return canDirectlyManageUser(creator, candidate);
        });

        const rows = usersData.map((userRow) => buildUserResponse({
            ...userRow,
            managerName: userRow.manager?.name || null,
            managerRole: normalizeRole(userRow.manager?.role),
            managerUsername: userRow.manager?.username || null,
            subregionIds: userRow.subregions.map((item) => item.subregionId),
            derivedSubregionId: userRow.subregions[0]?.subregion?.id || null,
            derivedSubregionCode: userRow.subregions[0]?.subregion?.subregionCode || null,
            derivedSubregionName: userRow.subregions[0]?.subregion?.name || null,
        }, boundaryContext));

        return c.json(rows);
    } catch (err) {
        console.error('getUsers Error:', err);
        return c.json({ error: 'Failed to fetch users.' }, 500);
    }
};

export const updateProfile = async (c) => {
    try {
        const body = await c.req.json();
        const user = c.get('user');
        const currentRole = normalizeRole(user.role);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const updates = {};

        if (body.name) updates.name = body.name;
        if (body.phone !== undefined) updates.phone = body.phone;
        if (body.postalCode !== undefined) {
            updates.postalCode = currentRole === 'super_admin' || currentRole === 'standard'
                ? normalizeOptionalPostalCode(body.postalCode)
                : normalizeRequiredPostalCode(body.postalCode);
        }
        if (body.password) {
            updates.passwordHash = await bcrypt.hash(body.password, 12);
        }

        if (Object.keys(updates).length > 0) {
            await db.update(users).set(updates).where(eq(users.id, user.id));
        }

        if (body.postalCode !== undefined) {
            if (updates.postalCode && currentRole !== 'super_admin') {
                const current = await loadUserWithSubregions(db, user.id);
                const derivedSubregion = await resolveSingleSubregionByPostal(db, updates.postalCode, 'Postal code');
                if (current.managerUserId) {
                    const manager = await loadUserWithSubregions(db, current.managerUserId);
                    validateManagerForTarget(manager, current.role, derivedSubregion.id);
                }
                await syncUserDerivedSubregion(db, user.id, derivedSubregion.id);
            } else if (!updates.postalCode) {
                await db.delete(userSubregions).where(eq(userSubregions.userId, user.id));
            }
        }

        const updated = await loadUserWithSubregions(db, user.id);
        const token = await createSessionToken(updated, c);
        setAuthCookie(c, token);
        return c.json(buildUserResponse(updated, await loadScopedBoundaryContext(db, updated)));
    } catch (err) {
        return c.json({ error: err.message || 'Failed to update profile.' }, err.status || 500);
    }
};

export const updateUserRole = async (c) => {
    try {
        const creator = c.get('user');
        if (normalizeRole(creator.role) !== 'super_admin') {
            return c.json({ error: 'Only super admins can update roles.' }, 403);
        }

        const id = Number.parseInt(c.req.param('id'), 10);
        if (!Number.isInteger(id)) {
            return c.json({ error: 'Invalid user id.' }, 400);
        }
        if (id === creator.id) {
            return c.json({ error: 'Super admins cannot change their own role.' }, 400);
        }

        const body = await c.req.json();
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const existingUser = await loadUserWithSubregions(db, id);
        if (!existingUser) return c.json({ error: 'User not found.' }, 404);

        const nextRole = normalizeRole(body.role || existingUser.role);
        if (!ASSIGNABLE_ROLES.includes(nextRole)) {
            return c.json({ error: 'Invalid role specified.' }, 400);
        }

        const nextManagerId = body.managerUserId !== undefined
            ? Number.parseInt(String(body.managerUserId), 10)
            : existingUser.managerUserId;

        const managerUser = Number.isInteger(nextManagerId)
            ? await loadUserWithSubregions(db, nextManagerId)
            : null;

        const derivedSubregionId = existingUser.derivedSubregionId
            || (existingUser.postalCode ? (await resolveSingleSubregionByPostal(db, existingUser.postalCode, 'Existing postal code')).id : null);

        validateManagerForTarget(managerUser, nextRole, derivedSubregionId);

        await db.update(users).set({
            role: nextRole,
            managerUserId: nextRole === 'super_admin' ? null : (managerUser?.id || null),
        }).where(eq(users.id, id));

        const updated = await loadUserWithSubregions(db, id);
        return c.json(buildUserResponse(updated, await loadScopedBoundaryContext(db, creator)));
    } catch (err) {
        console.error('updateUserRole Error:', err);
        return c.json({ error: err.message || 'Failed to update user status.' }, err.status || 500);
    }
};

export const updateUserManager = async (c) => {
    try {
        const creator = c.get('user');
        if (normalizeRole(creator.role) !== 'super_admin') {
            return c.json({ error: 'Only super admins can update user ownership.' }, 403);
        }

        const id = Number.parseInt(c.req.param('id'), 10);
        if (!Number.isInteger(id)) {
            return c.json({ error: 'Invalid user id.' }, 400);
        }
        if (id === creator.id) {
            return c.json({ error: 'You cannot reassign yourself.' }, 400);
        }

        const body = await c.req.json();
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const targetUser = await loadUserWithSubregions(db, id);
        if (!targetUser) return c.json({ error: 'User not found.' }, 404);

        let managerUser = null;
        if (body.managerUserId !== null && body.managerUserId !== undefined && body.managerUserId !== '') {
            const managerUserId = Number.parseInt(String(body.managerUserId), 10);
            if (!Number.isInteger(managerUserId)) {
                return c.json({ error: 'Invalid manager user id.' }, 400);
            }
            managerUser = await loadUserWithSubregions(db, managerUserId);
            if (!managerUser) {
                return c.json({ error: 'Assigned manager was not found.' }, 404);
            }
        }

        validateManagerForTarget(managerUser, targetUser.role, targetUser.derivedSubregionId);

        await db.update(users).set({
            managerUserId: managerUser?.id || null,
        }).where(eq(users.id, id));

        const updated = await loadUserWithSubregions(db, id);
        return c.json(buildUserResponse(updated, await loadScopedBoundaryContext(db, creator)));
    } catch (err) {
        console.error('updateUserManager Error:', err);
        return c.json({ error: err.message || 'Failed to update ownership.' }, err.status || 500);
    }
};

export const deleteUser = async (c) => {
    try {
        const id = Number.parseInt(c.req.param('id'), 10);
        const creator = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const creatorRole = normalizeRole(creator.role);

        if (id === creator.id) return c.json({ error: 'Cannot delete yourself.' }, 400);

        const targetUser = await loadUserWithSubregions(db, id);
        if (!targetUser) {
            return c.json({ error: 'User not found.' }, 404);
        }

        if (creatorRole !== 'super_admin' && !canDirectlyManageUser(creator, targetUser)) {
            return c.json({ error: 'You can only delete accounts directly assigned to you.' }, 403);
        }

        await db.delete(users).where(eq(users.id, id));
        return c.json({ success: true });
    } catch (err) {
        console.error('deleteUser Error:', err);
        return c.json({ error: 'Failed to delete user.' }, 500);
    }
};
