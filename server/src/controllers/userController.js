import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { env } from 'hono/adapter';

export const createUser = async (c) => {
    try {
        const body = await c.req.json();
        const { username, email, password, name, role, subregionId, phone } = body;
        const creator = c.get('user');
        const db = getDb(c.env);

        if (creator.role === 'super_admin') {
            // unrestricted
        }
        else if (creator.role === 'regional_admin') {
            if (role !== 'partner') {
                return c.json({ error: 'Regional admins can only create Partner roles.' }, 403);
            }
            if (parseInt(subregionId) !== parseInt(creator.subregionId)) {
                return c.json({ error: 'Regional admins can only create Partners within their own subregion.' }, 403);
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
            subregionId: subregionId ? parseInt(subregionId) : null,
            phone
        }).returning({
            id: users.id,
            username: users.username,
            email: users.email,
            name: users.name,
            role: users.role,
            subregionId: users.subregionId,
            phone: users.phone
        });

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
                const { username, email, password, name, role, subregionId, phone } = row;

                if (!username) throw new Error('Username is required');
                if (!email) throw new Error('Email is required');

                if (creator.role === 'regional_admin') {
                    if (role && role !== 'partner') {
                        throw new Error(`Regional admins can only create partners. Skipping ${email}`);
                    }
                    const finalSubregionId = subregionId || creator.subregionId;
                    if (parseInt(finalSubregionId) !== parseInt(creator.subregionId)) {
                        throw new Error(`Subregion mismatch for ${email}. You can only create users in your own region.`);
                    }
                }

                const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
                if (existingEmail) throw new Error(`${email} already registered`);

                const [existingUser] = await db.select().from(users).where(eq(users.username, username));
                if (existingUser) throw new Error(`Username ${username} already taken`);

                const passwordHash = await bcrypt.hash(password || 'SRM2024!temp', 12);

                await db.insert(users).values({
                    username,
                    email,
                    passwordHash,
                    name: name || username,
                    role: role || (creator.role === 'regional_admin' ? 'partner' : 'standard'),
                    subregionId: subregionId ? parseInt(subregionId) : (creator.role === 'regional_admin' ? creator.subregionId : null),
                    phone
                });
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
        let query = db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            name: users.name,
            role: users.role,
            subregionId: users.subregionId,
            phone: users.phone,
            createdAt: users.createdAt,
        }).from(users);

        if (creator.role === 'regional_admin') {
            query = query.where(eq(users.subregionId, creator.subregionId));
        } else if (creator.role === 'partner') {
            query = query.where(eq(users.id, creator.id));
        }

        const rows = await query;
        return c.json(rows);
    } catch (err) {
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
            subregionId: users.subregionId,
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
        const { role, subregionId } = body;
        const db = getDb(c.env);

        const updates = {};
        if (role) updates.role = role;
        if (subregionId !== undefined) updates.subregionId = subregionId;

        await db.update(users).set(updates).where(eq(users.id, id));

        const [updated] = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            subregionId: users.subregionId,
        }).from(users).where(eq(users.id, id));

        if (!updated) return c.json({ error: 'User not found.' }, 404);
        return c.json(updated);
    } catch (err) {
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
            const [target] = await db.select().from(users).where(and(eq(users.id, id), eq(users.subregionId, creator.subregionId)));
            if (!target) return c.json({ error: 'Permission denied or user not found in your region.' }, 403);
        }

        await db.delete(users).where(eq(users.id, id));
        return c.json({ success: true });
    } catch (err) {
        return c.json({ error: 'Failed to delete user.' }, 500);
    }
};
