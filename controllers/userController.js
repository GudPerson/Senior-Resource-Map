import db from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const getUsers = async (req, res) => {
    try {
        const rows = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            phone: users.phone,
            createdAt: users.createdAt,
        }).from(users);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

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
            phone: users.phone,
        }).from(users).where(eq(users.id, req.user.id));

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

export const updateUserRole = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { role } = req.body;
        if (!['admin', 'partner'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        await db.update(users).set({ role }).where(eq(users.id, id));

        const [updated] = await db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            phone: users.phone,
        }).from(users).where(eq(users.id, id));

        if (!updated) return res.status(404).json({ error: 'User not found' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update role' });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
        await db.delete(users).where(eq(users.id, id));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
