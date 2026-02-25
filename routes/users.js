import express from 'express';
import db from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// GET /api/users — admin only
router.get('/', authenticateToken, requireRole('admin'), (req, res) => {
    try {
        const rows = db.prepare('SELECT id, email, name, role, phone, created_at FROM users').all();
        res.json(rows.map(u => ({
            id: u.id, email: u.email, name: u.name, role: u.role, phone: u.phone, createdAt: u.created_at,
        })));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// PUT /api/users/me — partner updates own profile (must be before /:id to avoid conflict)
router.put('/me', authenticateToken, async (req, res) => {
    try {
        const { name, phone, password } = req.body;
        if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
        if (phone !== undefined) db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, req.user.id);
        if (password) {
            const hash = await bcrypt.hash(password, 12);
            db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
        }
        const updated = db.prepare('SELECT id, email, name, role, phone FROM users WHERE id = ?').get(req.user.id);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// PUT /api/users/:id/role — admin only
router.put('/:id/role', authenticateToken, requireRole('admin'), (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { role } = req.body;
        if (!['admin', 'partner'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
        const updated = db.prepare('SELECT id, email, name, role, phone FROM users WHERE id = ?').get(id);
        if (!updated) return res.status(404).json({ error: 'User not found' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// DELETE /api/users/:id — admin only
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
