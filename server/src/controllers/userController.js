import { getDb } from '../db/index.js';
import { subregions, users, userSubregions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { ASSIGNABLE_ROLES, canManageRole, getCreatableRoles, normalizeRole } from '../utils/roles.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { normalizePostalCode } from '../utils/postalBoundaries.js';
import { loadScopedBoundaryContext, resolvePostalBoundaryStatus } from '../utils/subregionBoundaryStatus.js';

function accessError(message, status = 403) {
    const error = new Error(message);
    error.status = status;
    return error;
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

function getScopedSubregionIds(user) {
    return parseSubregionIds(user?.subregionIds || []);
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

function resolveScopedSubregions(creator, requestedSubregionIds) {
    const creatorRole = normalizeRole(creator.role);
    const scopedSubregionIds = getScopedSubregionIds(creator);
    const finalSubregionIds = parseSubregionIds(requestedSubregionIds);

    if (creatorRole === 'super_admin') {
        return finalSubregionIds;
    }

    const resolvedSubregionIds = finalSubregionIds.length > 0 ? finalSubregionIds : scopedSubregionIds;

    if (resolvedSubregionIds.length === 0) {
        throw accessError('Account missing required subregion scope.');
    }

    if (!resolvedSubregionIds.every((id) => scopedSubregionIds.includes(id))) {
        throw accessError('You can only assign users to subregions within your scope.');
    }

    return resolvedSubregionIds;
}

function sharesScopedSubregion(creator, targetSubregionIds) {
    const creatorScope = new Set(getScopedSubregionIds(creator));
    return targetSubregionIds.some((id) => creatorScope.has(id));
}

function validateRoleScope(role, subregionIds) {
    if (['regional_admin', 'partner'].includes(normalizeRole(role)) && subregionIds.length === 0) {
        throw accessError('Regional Admin and Partner accounts require at least one subregion.', 400);
    }
}

function normalizeOptionalPostalCode(value) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return '';
    }

    const postalCode = normalizePostalCode(value);
    if (!postalCode) {
        throw accessError('Postal code must be a valid 6-digit code.', 400);
    }

    return postalCode;
}

async function loadUserWithSubregions(db, id) {
    const [userRow] = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        name: users.name,
        role: users.role,
        phone: users.phone,
        postalCode: users.postalCode,
        createdAt: users.createdAt,
    }).from(users).where(eq(users.id, id));

    if (!userRow) return null;

    const subregionRows = await db.select().from(userSubregions).where(eq(userSubregions.userId, id));
    return {
        ...userRow,
        role: normalizeRole(userRow.role),
        subregionIds: subregionRows.map((row) => row.subregionId),
    };
}

export const createUser = async (c) => {
    try {
        const body = await c.req.json();
        const { username, email, password, name, role, subregionIds = [], phone } = body;
        const creator = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db);

        const creatorRole = normalizeRole(creator.role);
        if (getCreatableRoles(creatorRole).length === 0) {
            return c.json({ error: 'Insufficient permissions to create users.' }, 403);
        }

        const finalRole = resolveRequestedRole(role, creatorRole);
        const requestedSubregionIds = await resolveSubregionIds(db, subregionIds);
        const finalSubregionIds = resolveScopedSubregions(creator, requestedSubregionIds);
        const postalCode = normalizeOptionalPostalCode(body.postalCode);
        validateRoleScope(finalRole, finalSubregionIds);

        const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
        if (existingEmail) return c.json({ error: 'Email already registered.' }, 409);

        const [existingUser] = await db.select().from(users).where(eq(users.username, username));
        if (existingUser) return c.json({ error: 'Username already taken.' }, 409);

        const passwordHash = await bcrypt.hash(password, 12);

        const [newUser] = await db.insert(users).values({
            username,
            email,
            passwordHash,
            name,
            role: finalRole,
            phone,
            postalCode
        }).returning({
            id: users.id,
            username: users.username,
            email: users.email,
            name: users.name,
            role: users.role,
            phone: users.phone,
            postalCode: users.postalCode,
        });

        if (finalSubregionIds.length > 0) {
            const values = finalSubregionIds.map(id => ({ userId: newUser.id, subregionId: id }));
            await db.insert(userSubregions).values(values);
        }

        newUser.role = normalizeRole(newUser.role);
        newUser.subregionIds = finalSubregionIds;

        return c.json(newUser, 201);
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
        await ensureBoundarySchema(db);
        const results = { message: 'Bulk import processed', successful: 0, failed: 0, errors: [] };

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
                const { username, email, password, name, role, subregionIds: rawSubregionIds, phone } = row;
                let subregionIds = await resolveSubregionIds(db, rawSubregionIds ?? row.subregions ?? row.subregionCode);
                const postalCode = normalizeOptionalPostalCode(row.postalCode ?? row['Postal Code']);

                if (!username) throw new Error('Username is required');
                if (!email) throw new Error('Email is required');

                const finalRole = resolveRequestedRole(role, creatorRole);
                subregionIds = resolveScopedSubregions(creator, subregionIds);
                validateRoleScope(finalRole, subregionIds);

                const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
                if (existingEmail) throw new Error(`${email} already registered`);

                const [existingUser] = await db.select().from(users).where(eq(users.username, username));
                if (existingUser) throw new Error(`Username ${username} already taken`);

                const passwordHash = await bcrypt.hash(password || 'SRM2024!temp', 12);

                const [newUser] = await db.insert(users).values({
                    username,
                    email,
                    passwordHash,
                    name: name || username,
                    role: finalRole,
                    phone,
                    postalCode
                }).returning();

                if (subregionIds && subregionIds.length > 0) {
                    const values = subregionIds.map(id => ({ userId: newUser.id, subregionId: id }));
                    await db.insert(userSubregions).values(values);
                }
                results.successful++;
            } catch (err) {
                results.failed++;
                results.errors.push(err.message);
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
        await ensureBoundarySchema(db);
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
            },
            with: {
                subregions: {
                    columns: {
                        subregionId: true
                    }
                }
            }
        });

        if (creatorRole !== 'super_admin') {
            usersData = usersData.filter((u) => {
                const targetRole = normalizeRole(u.role);
                const targetSubregionIds = u.subregions.map((r) => r.subregionId);
                return canManageRole(creatorRole, targetRole) && sharesScopedSubregion(creator, targetSubregionIds);
            });
        }

        const rows = usersData.map(u => {
            const row = {
                ...u,
                role: normalizeRole(u.role),
                subregionIds: u.subregions.map(r => r.subregionId),
                boundaryStatus: resolvePostalBoundaryStatus(u.postalCode, boundaryContext),
            };
            delete row.subregions;
            return row;
        });

        return c.json(rows);
    } catch (err) {
        console.error('getUsers Error:', err);
        return c.json({ error: 'Failed to fetch users.' }, 500);
    }
};

export const updateProfile = async (c) => {
    try {
        const body = await c.req.json();
        const { name, phone, password } = body;
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db);
        const updates = {};

        if (name) updates.name = name;
        if (phone !== undefined) updates.phone = phone;
        if (body.postalCode !== undefined) updates.postalCode = normalizeOptionalPostalCode(body.postalCode);
        if (password) {
            updates.passwordHash = await bcrypt.hash(password, 12);
        }

        if (Object.keys(updates).length > 0) {
            await db.update(users).set(updates).where(eq(users.id, user.id));
        }

        const [updated] = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            phone: users.phone,
            postalCode: users.postalCode,
        }).from(users).where(eq(users.id, user.id));

        return c.json(updated);
    } catch (err) {
        return c.json({ error: 'Failed to update profile.' }, 500);
    }
};

export const updateUserRole = async (c) => {
    try {
        const creator = c.get('user');
        if (normalizeRole(creator.role) !== 'super_admin') return c.json({ error: 'Only super admins can update roles.' }, 403);

        const id = parseInt(c.req.param('id'));
        const body = await c.req.json();
        const { role, subregionIds } = body;
        const db = getDb(c.env);
        await ensureBoundarySchema(db);
        const existingUser = await loadUserWithSubregions(db, id);

        if (!existingUser) return c.json({ error: 'User not found.' }, 404);

        if (role && !ASSIGNABLE_ROLES.includes(normalizeRole(role))) {
            return c.json({ error: 'Invalid role specified.' }, 400);
        }

        const nextRole = normalizeRole(role || existingUser.role);
        const nextSubregionIds = subregionIds !== undefined ? parseSubregionIds(subregionIds) : existingUser.subregionIds;
        validateRoleScope(nextRole, nextSubregionIds);

        if (role) {
            await db.update(users).set({ role: normalizeRole(role) }).where(eq(users.id, id));
        }

        if (subregionIds !== undefined) {
            await db.delete(userSubregions).where(eq(userSubregions.userId, id));
            const finalSubregionIds = await resolveSubregionIds(db, subregionIds);
            if (finalSubregionIds.length > 0) {
                const values = finalSubregionIds.map(subId => ({ userId: id, subregionId: subId }));
                await db.insert(userSubregions).values(values);
            }
        }

        const [updated] = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            postalCode: users.postalCode,
        }).from(users).where(eq(users.id, id));

        const userSubs = await db.select().from(userSubregions).where(eq(userSubregions.userId, id));
        updated.role = normalizeRole(updated.role);
        updated.subregionIds = userSubs.map(s => s.subregionId);

        return c.json(updated);
    } catch (err) {
        console.error('updateUserRole Error:', err);
        return c.json({ error: 'Failed to update user status.' }, 500);
    }
};

export const deleteUser = async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const creator = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db);
        const creatorRole = normalizeRole(creator.role);

        if (id === creator.id) return c.json({ error: 'Cannot delete yourself.' }, 400);

        const targetUser = await loadUserWithSubregions(db, id);
        if (!targetUser) {
            return c.json({ error: 'User not found.' }, 404);
        }

        if (creatorRole !== 'super_admin') {
            if (!canManageRole(creatorRole, targetUser.role)) {
                return c.json({ error: 'You can only delete accounts directly below your role.' }, 403);
            }

            if (!sharesScopedSubregion(creator, targetUser.subregionIds)) {
                return c.json({ error: 'Permission denied or user not found in your scope.' }, 403);
            }
        }

        await db.delete(users).where(eq(users.id, id));
        return c.json({ success: true });
    } catch (err) {
        console.error('deleteUser Error:', err);
        return c.json({ error: 'Failed to delete user.' }, 500);
    }
};
