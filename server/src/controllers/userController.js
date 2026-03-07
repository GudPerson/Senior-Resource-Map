import { getDb } from '../db/index.js';
import { users, userSubregions } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const createUser = async (c) => {
    try {
        const body = await c.req.json();
        const { username, email, password, name, role, subregionIds = [], phone } = body;
        const creator = c.get('user');
        const db = getDb(c.env);

        let finalSubregionIds = Array.isArray(subregionIds) ? subregionIds : [subregionIds].filter(Boolean);

        if (creator.role === 'super_admin') {
            // unrestricted
        }
        else if (creator.role === 'regional_admin') {
            if (role !== 'partner') {
                return c.json({ error: 'Regional admins can only create Partner roles.' }, 403);
            }
            if (!finalSubregionIds.every(id => creator.subregionIds?.includes(parseInt(id)))) {
                return c.json({ error: 'Regional admins can only assign regions they manage.' }, 403);
            }
        }
        else {
            return c.json({ error: 'Insufficient permissions to create users.' }, 403);
        }

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
            role,
            phone
        }).returning({
            id: users.id,
            username: users.username,
            email: users.email,
            name: users.name,
            role: users.role,
            phone: users.phone
        });

        if (finalSubregionIds.length > 0) {
            const values = finalSubregionIds.map(id => ({ userId: newUser.id, subregionId: parseInt(id) }));
            await db.insert(userSubregions).values(values);
        }

        newUser.subregionIds = finalSubregionIds.map(id => parseInt(id));

        return c.json(newUser, 201);
    } catch (err) {
        console.error('Create User Error:', err);
        return c.json({ error: 'Failed to create user.' }, 500);
    }
};

export const bulkCreateUsers = async (c) => {
    try {
        const body = await c.req.json();
        const { rows } = body;
        const creator = c.get('user');
        const db = getDb(c.env);
        const results = { message: 'Bulk import processed', successful: 0, failed: 0, errors: [] };

        if (!Array.isArray(rows)) {
            return c.json({ error: 'Invalid data format. Expected an array of rows.' }, 400);
        }

        for (const row of rows) {
            try {
                const { username, email, password, name, role, subregionIds: rawSubregionIds, phone } = row;

                let subregionIds = [];
                if (typeof rawSubregionIds === 'string') {
                    subregionIds = rawSubregionIds.split(',').map(id => id.trim()).filter(Boolean);
                } else if (Array.isArray(rawSubregionIds)) {
                    subregionIds = rawSubregionIds;
                }

                if (!username) throw new Error('Username is required');
                if (!email) throw new Error('Email is required');

                if (creator.role === 'regional_admin') {
                    if (role && role !== 'partner') {
                        throw new Error(`Regional admins can only create partners. Skipping ${email}`);
                    }
                    if (subregionIds.length === 0) {
                        subregionIds = creator.subregionIds || [];
                    }
                    if (!subregionIds.every(id => creator.subregionIds?.includes(parseInt(id)))) {
                        throw new Error(`Subregion mismatch for ${email}. You can only create users in your own regions.`);
                    }
                }

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
                    role: role || (creator.role === 'regional_admin' ? 'partner' : 'standard'),
                    phone
                }).returning();

                if (subregionIds && subregionIds.length > 0) {
                    const values = subregionIds.map(id => ({ userId: newUser.id, subregionId: parseInt(id) }));
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

        let usersData = await db.query.users.findMany({
            columns: {
                id: true,
                username: true,
                email: true,
                name: true,
                role: true,
                phone: true,
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

        if (creator.role === 'regional_admin') {
            usersData = usersData.filter(u =>
                u.subregions.some(r => creator.subregionIds?.includes(r.subregionId))
            );
        } else if (creator.role === 'partner') {
            usersData = usersData.filter(u => u.id === creator.id);
        }

        const rows = usersData.map(u => {
            const row = { ...u, subregionIds: u.subregions.map(r => r.subregionId) };
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
        const updates = {};

        if (name) updates.name = name;
        if (phone !== undefined) updates.phone = phone;
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
        }).from(users).where(eq(users.id, user.id));

        return c.json(updated);
    } catch (err) {
        return c.json({ error: 'Failed to update profile.' }, 500);
    }
};

export const updateUserRole = async (c) => {
    try {
        const creator = c.get('user');
        if (creator.role !== 'super_admin') return c.json({ error: 'Only super_admin can update roles.' }, 403);

        const id = parseInt(c.req.param('id'));
        const body = await c.req.json();
        const { role, subregionIds } = body;
        const db = getDb(c.env);

        if (role) {
            await db.update(users).set({ role }).where(eq(users.id, id));
        }

        if (subregionIds !== undefined) {
            await db.delete(userSubregions).where(eq(userSubregions.userId, id));
            const finalSubregionIds = Array.isArray(subregionIds) ? subregionIds : [subregionIds].filter(Boolean);
            if (finalSubregionIds.length > 0) {
                const values = finalSubregionIds.map(subId => ({ userId: id, subregionId: parseInt(subId) }));
                await db.insert(userSubregions).values(values);
            }
        }

        const [updated] = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
        }).from(users).where(eq(users.id, id));

        if (!updated) return c.json({ error: 'User not found.' }, 404);

        const userSubs = await db.select().from(userSubregions).where(eq(userSubregions.userId, id));
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

        if (id === creator.id) return c.json({ error: 'Cannot delete yourself.' }, 400);

        if (creator.role === 'regional_admin') {
            const userSubs = await db.select().from(userSubregions).where(eq(userSubregions.userId, id));
            const hasCommonRegion = userSubs.some(s => creator.subregionIds?.includes(s.subregionId));
            if (!hasCommonRegion) return c.json({ error: 'Permission denied or user not found in your regions.' }, 403);
        }

        await db.delete(users).where(eq(users.id, id));
        return c.json({ success: true });
    } catch (err) {
        console.error('deleteUser Error:', err);
        return c.json({ error: 'Failed to delete user.' }, 500);
    }
};
