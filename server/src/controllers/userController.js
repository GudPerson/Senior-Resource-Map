import db from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

/**
 * Restricted Create User endpoint
 * super_admin: create any role, any subregion_id
 * regional_admin: create partner roles ONLY, subregion_id MUST match their own
 */
export const createUser = async (req, res) => {
    try {
        const { username, email, password, name, role, subregionId, phone } = req.body;
        const creator = req.user;

        // Validation for super_admin
        if (creator.role === 'super_admin') {
            // Can create any role and assign any subregion
        }
        // Validation for regional_admin
        else if (creator.role === 'regional_admin') {
            // Can ONLY create partner roles
            if (role !== 'partner') {
                return res.status(403).json({ error: 'Regional admins can only create Partner roles.' });
            }
            // subregionId must match creator's subregion
            if (parseInt(subregionId) !== parseInt(creator.subregionId)) {
                return res.status(403).json({ error: 'Regional admins can only create Partners within their own subregion.' });
            }
        }
        else {
            return res.status(403).json({ error: 'Insufficient permissions to create users.' });
        }

        // Check if user already exists
        const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
        if (existingEmail) return res.status(409).json({ error: 'Email already registered.' });

        const [existingUser] = await db.select().from(users).where(eq(users.username, username));
        if (existingUser) return res.status(409).json({ error: 'Username already taken.' });

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

        res.status(201).json(newUser);
    } catch (err) {
        console.error('Create User Error:', err);
        res.status(500).json({ error: 'Failed to create user.' });
    }
};

/**
 * Bulk Create Users
 * Handled similarly to individual creation with role-based scoping
 */
export const bulkCreateUsers = async (req, res) => {
    try {
        const { rows } = req.body;
        const creator = req.user;
        const results = { message: 'Bulk import processed', successful: 0, failed: 0, errors: [] };

        if (!Array.isArray(rows)) {
            return res.status(400).json({ error: 'Invalid data format. Expected an array of rows.' });
        }

        for (const row of rows) {
            try {
                const { username, email, password, name, role, subregionId, phone } = row;

                if (!username) throw new Error('Username is required');
                if (!email) throw new Error('Email is required');

                // Role Validation
                if (creator.role === 'regional_admin') {
                    if (role && role !== 'partner') {
                        throw new Error(`Regional admins can only create partners. Skipping ${email}`);
                    }
                    // If no subregionId provided, default to creator's
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

        res.json(results);
    } catch (err) {
        console.error('Bulk Create Error:', err);
        res.status(500).json({ error: 'Failed to process bulk import.' });
    }
};

/**
 * Scoped User retrieval
 */
export const getUsers = async (req, res) => {
    try {
        const creator = req.user;
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

        // Scope enforcement
        if (creator.role === 'regional_admin') {
            query = query.where(eq(users.subregionId, creator.subregionId));
        } else if (creator.role === 'partner') {
            // Partners can only see themselves/managers? Usually they shouldn't see all users.
            query = query.where(eq(users.id, creator.id));
        }

        const rows = await query;
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
};

/**
 * Standard profile update
 */
export const updateProfile = async (req, res) => {
    try {
        const { name, phone, password } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (phone !== undefined) updates.phone = phone;
        if (password) {
            updates.passwordHash = await bcrypt.hash(password, 12);
        }

        if (Object.keys(updates).length > 0) {
            await db.update(users).set(updates).where(eq(users.id, req.user.id));
        }

        const [updated] = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            subregionId: users.subregionId,
            phone: users.phone,
        }).from(users).where(eq(users.id, req.user.id));

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update profile.' });
    }
};

/**
 * Super admin role/subregion update
 */
export const updateUserRole = async (req, res) => {
    try {
        if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Only super_admin can update roles.' });

        const id = parseInt(req.params.id);
        const { role, subregionId } = req.body;

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

        if (!updated) return res.status(404).json({ error: 'User not found.' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user status.' });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself.' });

        // Scope enforcement: regional_admin only delete in their subregion
        if (req.user.role === 'regional_admin') {
            const [target] = await db.select().from(users).where(and(eq(users.id, id), eq(users.subregionId, req.user.subregionId)));
            if (!target) return res.status(403).json({ error: 'Permission denied or user not found in your region.' });
        }

        await db.delete(users).where(eq(users.id, id));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user.' });
    }
};
